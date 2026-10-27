import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, Eye, Plus, Send, Trash2 } from "lucide-react";

import {
  approvalKeys,
  fetchFinalSignedPdf,
  fetchReviewPdf,
  fetchSubmittedPdf,
  getWorkflowForDocument,
  sendWorkflow,
  setUpWorkflow,
} from "../../service/ApprovalWorkflowService";
import { downloadBlob, openPdfInTab } from "../../service/PdfService";
import { getAllUsers, isUserListForbidden } from "../../service/UserService";
import type { PLMUser } from "../../types/userTypes";
import type { ApprovalWorkflow, ApproverInput } from "../../types/approvalTypes";
import type { ProductDocument } from "../../types/documentTypes";
import { isUserActive } from "../../utils/userStatus";
import { canSignOff } from "../../utils/roleRouting";
import { formatPersonName, formatRoleName } from "../../utils/text";
import { useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../common/DraftRestoredNotice";
import ApprovalSignOff from "./ApprovalSignOff";

const EMPTY_ROW: ApproverInput = { userId: "", name: "", role: "" };

// 1 → "1st approver", 2 → "2nd approver"…
function approverLevel(position: number): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] ?? "th");

  return `${position}${suffix} approver`;
}

// The people to choose from, by full name, A–Z. Their role shows beside
// the dropdown once chosen, so it isn't repeated in the list.
function sortByName(users: PLMUser[]): PLMUser[] {
  return [...users].sort((a, b) => formatPersonName(a).localeCompare(formatPersonName(b)));
}

function workflowSummary(workflow: ApprovalWorkflow): string {
  const signed = workflow.steps.filter((step) => step.status === "Signed").length;
  const current = workflow.steps.find((step) => step.status === "Pending");

  if (workflow.status === "Approved") {
    return `Signed by all ${workflow.steps.length} approvers.`;
  }

  if (workflow.status === "Draft") {
    return "The approvers are saved, but the document hasn't been sent to the first one yet.";
  }

  return current
    ? `With ${current.approverName} (${current.approverRole}) — ${signed} of ${workflow.steps.length} signed.`
    : `${signed} of ${workflow.steps.length} signed.`;
}

interface ApprovalWorkflowPanelProps {
  document: ProductDocument;
  initiativeName: string;
  // Only the Product Manager sets up the approvers; others just see progress.
  canManage: boolean;
}

// Sign-off after the Group Head's approval. The PM chooses who approves this
// document for this project, in order; it then goes to each in turn to sign.
function ApprovalWorkflowPanel({ document, initiativeName, canManage }: ApprovalWorkflowPanelProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfError, setPdfError] = useState("");

  const [rows, setRows, rowsDraft] = useDraftState<ApproverInput[]>(`approval-setup:v2:${document.type}:${document.id}`, [EMPTY_ROW]);

  const workflowQuery = useQuery({
    queryKey: approvalKeys.forDocument(document.id),
    queryFn: () => getWorkflowForDocument(document.id),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
    enabled: canManage,
  });

  // Only people who can be on a sign-off (not Developers or Lead Engineers).
  const directory = (usersQuery.data ?? []).filter((user) => isUserActive(user) && canSignOff(user.role));
  const sortedDirectory = sortByName(directory);
  // The API refuses the user list to some roles (gaps file R7 / M3).
  const directoryUnavailable = usersQuery.isError || (usersQuery.isSuccess && isUserListForbidden());

  const sendMutation = useMutation({
    mutationFn: () => setUpWorkflow(document, initiativeName, rows),
    onSuccess: async () => {
      setConfirming(false);
      setErrorMessage("");
      setRows([EMPTY_ROW]);
      await queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
    onError: (error) => {
      setConfirming(false);
      setErrorMessage(error instanceof Error ? error.message : "Couldn't send the document for sign-off.");
    },
  });

  // Approvers saved but not sent (sending failed) — send again.
  const resendMutation = useMutation({
    mutationFn: (workflowId: string) => sendWorkflow(workflowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: approvalKeys.all }),
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't send it. Try again."),
  });

  function updateRow(index: number, change: Partial<ApproverInput>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...change } : row)));
  }

  function chooseUser(index: number, userId: string) {
    const user = directory.find((entry) => entry.userId === userId);

    // Their role is their title on the sign-off, e.g. "Risk Officer".
    updateRow(index, {
      userId,
      name: user ? formatPersonName(user) : "",
      role: user?.role[0] ? formatRoleName(user.role[0]) : "",
    });
  }

  function moveRow(index: number, offset: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + offset, 0, row);
      return next;
    });
  }

  function startSend() {
    const filled = rows.filter((row) => row.userId.trim());

    if (filled.length === 0) {
      setErrorMessage("Add at least one approver.");
      return;
    }

    if (rows.some((row) => !row.userId)) {
      setErrorMessage("Choose a person for every approval level, or remove the empty ones.");
      return;
    }

    if (new Set(rows.map((row) => row.userId.trim())).size !== rows.length) {
      setErrorMessage("Each person can only appear once.");
      return;
    }

    setErrorMessage("");
    setConfirming(true);
  }

  function openPdf(load: () => Promise<Blob>) {
    setPdfError("");
    const tab = window.open("", "_blank");

    openPdfInTab(load, tab).catch((error: unknown) => {
      console.error(error);
      setPdfError("Couldn't load the PDF from the server. Try again shortly.");
    });
  }

  async function downloadSigned(workflow: ApprovalWorkflow) {
    setPdfError("");

    try {
      downloadBlob(await fetchFinalSignedPdf(workflow.id), `${initiativeName} - ${document.type} (signed).pdf`);
    } catch (error) {
      console.error(error);
      setPdfError("Couldn't download the signed PDF. Try again shortly.");
    }
  }

  const workflow = workflowQuery.data ?? null;
  const showSetup = canManage && (!workflow || workflow.status === "Rejected");
  const rejectedStep = workflow?.status === "Rejected" ? workflow.steps.find((step) => step.status === "Rejected") : null;

  return (
    <section className="dashboard-panel initiative-detail-panel approval-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Approval &amp; sign-off</h2>
          <p>
            {workflow && workflow.status !== "Rejected"
              ? workflowSummary(workflow)
              : `Choose who signs off this ${document.type}, in order. It goes to each person in turn.`}
          </p>
        </div>

        {workflow && workflow.status !== "Rejected" && (
          <span
            className={
              workflow.status === "Approved"
                ? "status-badge status-badge--approved"
                : "status-badge status-badge--brd-under-review"
            }
          >
            {workflow.status === "Approved" ? "Fully signed" : workflow.status === "Draft" ? "Not sent" : "Collecting signatures"}
          </span>
        )}
      </div>

      {workflowQuery.isLoading && <p className="initiatives-empty">Loading sign-off…</p>}

      {rejectedStep && (
        <div className="document-returned-note" role="status">
          <strong>
            Rejected by {rejectedStep.approverName} ({rejectedStep.approverRole})
          </strong>
          <p>{rejectedStep.comment || "No reason was given."}</p>
        </div>
      )}

      {workflow && workflow.status !== "Rejected" && (
        <div className="proposal-section">
          <ApprovalSignOff steps={workflow.steps} />

          {workflow.status === "Draft" && canManage && (
            <div className="approval-panel_actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => resendMutation.mutate(workflow.id)}
                disabled={resendMutation.isPending}
              >
                <Send size={17} aria-hidden="true" />
                {resendMutation.isPending ? "Sending…" : `Send to ${workflow.steps[0]?.approverName ?? "the first approver"}`}
              </button>
            </div>
          )}

          {errorMessage && workflow.status === "Draft" && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="approval-panel_actions">
            <button type="button" className="button button--dark" onClick={() => openPdf(() => fetchSubmittedPdf(workflow.id))}>
              <Eye size={17} aria-hidden="true" />
              PDF as sent
            </button>

            <button type="button" className="button button--dark" onClick={() => openPdf(() => fetchReviewPdf(workflow.id))}>
              <Eye size={17} aria-hidden="true" />
              PDF with signatures so far
            </button>

            {workflow.status === "Approved" && (
              <button type="button" className="button button--primary" onClick={() => void downloadSigned(workflow)}>
                <Download size={17} aria-hidden="true" />
                Download signed {document.type}
              </button>
            )}
          </div>

          {pdfError && (
            <p className="form-error" role="alert">
              {pdfError}
            </p>
          )}

          <p className="mock-data-notice">
            Signing progress shown here is recorded on this browser until the backend can return a
            document's workflow (gaps file M13). The PDFs come from the server.
          </p>
        </div>
      )}

      {!workflowQuery.isLoading && !showSetup && !workflow && (
        <p className="initiatives-empty">The Product Manager hasn't set up sign-off for this {document.type} yet.</p>
      )}

      {!workflowQuery.isLoading && showSetup && (
        <div className="proposal-section">
          <DraftRestoredNotice
            savedAt={rowsDraft.restoredAt}
            onDiscard={rowsDraft.discard}
            keepHint="Send the document for sign-off to keep them."
          />

          {directoryUnavailable && (
            <div className="document-returned-note" role="alert">
              <strong>Couldn't load the staff list</strong>
              <p>
                {usersQuery.isError
                  ? "The staff list didn't load, so approvers can't be chosen. Refresh the page to try again."
                  : "Your account isn't allowed to read the staff list, so approvers can't be chosen. Ask an administrator to check your role."}
              </p>
            </div>
          )}

          <ol className="approver-list">
            {rows.map((row, index) => (
              <li key={index} className="approver-row">
                <span className="approver-row_level">
                  <span className="approver-row_number">{index + 1}</span>
                  {approverLevel(index + 1)}
                  {rows.length > 1 && index === rows.length - 1 && <em>Final</em>}
                </span>

                <div className="form-field">
                  <label htmlFor={`approver-user-${index}`} className="sr-only">
                    {approverLevel(index + 1)}
                  </label>
                  <select
                    className="approver-picker"
                    id={`approver-user-${index}`}
                    value={row.userId}
                    onChange={(event) => chooseUser(index, event.target.value)}
                    disabled={usersQuery.isLoading || directoryUnavailable}
                  >
                    <option value="" disabled>
                      {usersQuery.isLoading ? "Loading staff…" : "Select a person"}
                    </option>

                    {sortedDirectory.map((user) => (
                      <option
                        key={user.userId}
                        value={user.userId}
                        // Each person can only sign once.
                        disabled={rows.some((other, otherIndex) => otherIndex !== index && other.userId === user.userId)}
                      >
                        {formatPersonName(user)}
                      </option>
                    ))}
                  </select>
                </div>

                <span className={row.role ? "approver-row_role" : "approver-row_role approver-row_role--empty"}>
                  {row.role || "No one chosen"}
                </span>

                <div className="approver-row_tools">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${approverLevel(index + 1)} up`}
                    title="Sign earlier"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move ${approverLevel(index + 1)} down`}
                    title="Sign later"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                    disabled={rows.length === 1}
                    aria-label={`Remove ${approverLevel(index + 1)}`}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="approval-panel_actions">
            <button
              type="button"
              className="button button--dark"
              onClick={() => setRows((current) => [...current, EMPTY_ROW])}
              disabled={directoryUnavailable}
            >
              <Plus size={17} aria-hidden="true" />
              Add {approverLevel(rows.length + 1)}
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={startSend}
              disabled={sendMutation.isPending || directoryUnavailable}
            >
              <Send size={17} aria-hidden="true" />
              {sendMutation.isPending ? "Sending…" : workflow ? "Send for sign-off again" : "Send for sign-off"}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-overlay" role="presentation" onClick={() => !sendMutation.isPending && setConfirming(false)}>
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-send-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="approval-send-title">Send for sign-off</h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                The {document.type} goes to these people in this order. Each one signs before it moves to
                the next; their names and signature spaces are added to the document.
              </p>

              <ol className="approver-confirm-list">
                {rows.map((row, index) => (
                  <li key={index}>
                    <strong>{approverLevel(index + 1)}:</strong> {row.name} ({row.role})
                  </li>
                ))}
              </ol>
            </div>

            <div className="modal-panel_footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setConfirming(false)}
                disabled={sendMutation.isPending}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ApprovalWorkflowPanel;
