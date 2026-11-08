import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Plus, RotateCcw, Send } from "lucide-react";
import { sileo } from "sileo";

import {
  activateMemoSignOff,
  assignMemoApprovers,
  fetchFinalMemoPdf,
  getMemoSteps,
  isRejectedAtSignOff,
  memoKeys,
  resubmitMemoSignOff,
} from "../../service/MemoService";
import { downloadBlob, openPdfInTab } from "../../service/PdfService";
import { getAllUsers, isUserListForbidden } from "../../service/UserService";
import type { ApproverInput } from "../../types/approvalTypes";
import { MEMO_STATUS } from "../../types/memoTypes";
import type { Memo, MemoResubmissionMode, MemoStatus } from "../../types/memoTypes";
import { EMPTY_APPROVER, approverLevel, approverRowsError } from "../../utils/approvers";
import { isUserActive } from "../../utils/userStatus";
import { clearDraft, useDraftState } from "../../utils/useDraftState";
import ApprovalSignOff from "../approvals/ApprovalSignOff";
import ApproverRowsEditor from "../approvals/ApproverRowsEditor";
import DraftRestoredNotice from "../common/DraftRestoredNotice";
import ModalShell from "../common/ModalShell";

interface MemoSignOffPanelProps {
  memo: Memo;
  // Its stage, including the review stage (see memoStage).
  stage: MemoStatus;
  isAuthor: boolean;
  // The memo's sign-off: from the memo once the API sends it (gaps file
  // M27), or from the user's own pending step.
  workflowId: string | null;
  // Highlights the signed-in approver's own space.
  currentStepId?: string;
}

const RESUBMIT_MODES: { value: MemoResubmissionMode; label: string; hint: string }[] = [
  {
    value: "ResumeFromRejectingApprover",
    label: "Continue from the approver who rejected it",
    hint: "Signatures already given are kept.",
  },
  { value: "FullRestart", label: "Start again from the first approver", hint: "Everyone signs again." },
];

// Plain words on screen; the server's own message goes to the console.
function failure(action: string, error: unknown): string {
  console.error(`Memo sign-off: ${action} failed:`, error);
  const message = error instanceof Error ? error.message : "";

  // activate-approval-route before anyone has set the approvers.
  if (/no pending approval route/i.test(message)) {
    return "No approvers have been set for this memo yet. Choose them above, then start the sign-off.";
  }

  // Until the backend's new flow is in, it still expects the old Group Head
  // review and lets only the Group Head start the signing.
  if (/group head/i.test(message) || /forbidden|403/i.test(message)) {
    return "The server doesn't let you start the signing yet (gaps file M35).";
  }

  return message || `Couldn't ${action}. Try again.`;
}

// A memo's signing, once every reviewer has approved it:
//   1. its author chooses who signs it, in order, and starts the signing;
//   2. each approver signs in turn (MemoSignForm), and the backend builds
//      the signed PDF.
// After a rejection, the author sends it round again.
function MemoSignOffPanel({ memo, stage, isAuthor, workflowId, currentStepId }: MemoSignOffPanelProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"activate" | "resubmit" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const approversDraftKey = `memo-approvers:${memo.id}`;
  const [rows, setRows, rowsDraft] = useDraftState<ApproverInput[]>(approversDraftKey, [EMPTY_APPROVER]);
  const resubmitDraftKey = `memo-resubmit:${memo.id}`;
  const [resubmitComment, setResubmitComment] = useDraftState(resubmitDraftKey, "");
  const [mode, setMode] = useState<MemoResubmissionMode>("ResumeFromRejectingApprover");

  // Reviewed (or, on an old memo, accepted by the Group Head).
  const ready = stage === MEMO_STATUS.reviewed || stage === MEMO_STATUS.readyForApproval;
  const rejected = isRejectedAtSignOff(memo.status);
  const showPicker = ready && isAuthor;

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
    enabled: showPicker,
  });

  const stepsQuery = useQuery({
    queryKey: memoKeys.steps(workflowId ?? ""),
    queryFn: () => getMemoSteps(workflowId as string),
    enabled: Boolean(workflowId),
  });

  // Anyone active can be picked to sign, whatever their role.
  const directory = (usersQuery.data ?? []).filter(isUserActive);
  const directoryUnavailable = usersQuery.isError || (usersQuery.isSuccess && isUserListForbidden());

  async function done(title: string, description: string) {
    setConfirming(null);
    setErrorMessage("");
    sileo.success({ title, description });
    await queryClient.invalidateQueries({ queryKey: memoKeys.all });
  }

  // The author sets the approvers and starts the signing in one go.
  const activateMutation = useMutation({
    mutationFn: async () => {
      await assignMemoApprovers(memo.id, rows);
      await activateMemoSignOff(memo.id);
    },
    onSuccess: () => {
      rowsDraft.markSaved();
      clearDraft(approversDraftKey);
      return done("Signing started", "The memo is with its first approver.");
    },
    onError: (error) => {
      setConfirming(null);
      sileo.error({ title: "Couldn't start the signing", description: failure("start the signing", error) });
    },
  });

  function startActivate() {
    const problem = approverRowsError(rows);
    setErrorMessage(problem ?? "");
    setConfirming(problem ? null : "activate");
  }

  const resubmitMutation = useMutation({
    mutationFn: () => resubmitMemoSignOff(workflowId as string, mode, resubmitComment.trim()),
    onSuccess: () => {
      clearDraft(resubmitDraftKey);
      return done("Sent for sign-off again", "The approvers have been asked to sign.");
    },
    onError: (error) => {
      setConfirming(null);
      sileo.error({ title: "Couldn't send it round again", description: failure("send it round again", error) });
    },
  });

  const isBusy = activateMutation.isPending || resubmitMutation.isPending;

  async function finalPdf(action: "view" | "download") {
    if (!workflowId) {
      return;
    }

    setPdfBusy(true);
    setErrorMessage("");

    try {
      if (action === "view") {
        await openPdfInTab(() => fetchFinalMemoPdf(workflowId), window.open("", "_blank"));
      } else {
        downloadBlob(await fetchFinalMemoPdf(workflowId), `${memo.memoNumber || "memo"}-signed.pdf`);
      }
    } catch (error) {
      sileo.error({ title: "Couldn't open the signed PDF", description: failure("open the signed PDF", error) });
    } finally {
      setPdfBusy(false);
    }
  }

  const steps = stepsQuery.data ?? [];
  const signed = steps.filter((step) => step.status === "Signed").length;
  const current = steps.find((step) => step.status === "Pending");

  const summary = ready
    ? isAuthor
      ? "Every reviewer has approved it. Choose who signs it, in order, then start the signing."
      : "Reviewed. Its author chooses who signs it next."
    : memo.status === MEMO_STATUS.approved
        ? "Signed by every approver."
        : rejected
          ? "Rejected at sign-off. Its author can send it round again."
          : current
            ? `With ${current.approverName}${current.approverRole ? ` (${current.approverRole})` : ""}: ${signed} of ${steps.length} signed.`
            : "Out for sign-off.";

  const badge = ready
    ? { className: "status-badge status-badge--brd-drafting", text: "Not started" }
    : memo.status === MEMO_STATUS.approved
      ? { className: "status-badge status-badge--approved", text: "Fully signed" }
      : rejected
        ? { className: "status-badge status-badge--bdo-documentation-rejected", text: "Rejected" }
        : { className: "status-badge status-badge--brd-under-review", text: "Collecting signatures" };

  return (
    <section className="dashboard-panel initiative-detail-panel approval-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Signing</h2>
          <p>{summary}</p>
        </div>

        <span className={badge.className}>{badge.text}</span>
      </div>

      {/* The approvers' cards, once the sign-off has started (it has a workflowId). */}
      {workflowId && (
        <div className="proposal-section">
          {stepsQuery.isLoading && <p className="initiatives-empty">Loading the approvers…</p>}
          {stepsQuery.isError && (
            <p className="initiatives-empty initiatives-empty--error">Couldn't load the approvers. Try refreshing the page.</p>
          )}
          {steps.length > 0 && <ApprovalSignOff steps={steps} currentStepId={currentStepId} />}
        </div>
      )}

      {showPicker && (
        <div className="proposal-section">
          <DraftRestoredNotice
            savedAt={rowsDraft.restoredAt}
            onDiscard={rowsDraft.discard}
            keepHint="Start the signing to keep them."
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

          <ApproverRowsEditor
            rows={rows}
            setRows={setRows}
            users={directory}
            usersLoading={usersQuery.isLoading}
            disabled={directoryUnavailable || isBusy}
            idPrefix="memo-approver"
          />
        </div>
      )}

      {rejected && isAuthor && workflowId && (
        <div className="proposal-section">
          <fieldset className="memo-resubmit-modes">
            <legend>How should it go round again?</legend>

            {RESUBMIT_MODES.map((option) => (
              <label key={option.value} className="memo-resubmit-mode">
                <input
                  type="radio"
                  name="memo-resubmit-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  disabled={isBusy}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="form-field">
            <label htmlFor="memo-resubmit-comment">What changed</label>
            <textarea
              id="memo-resubmit-comment"
              rows={3}
              placeholder="What you changed after the rejection"
              value={resubmitComment}
              onChange={(event) => setResubmitComment(event.target.value)}
              disabled={isBusy}
            />
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="proposal-section">
          {errorMessage && !confirming && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {(showPicker || (rejected && isAuthor && workflowId) || (memo.hasFinalPdf && workflowId)) && (
        <div className="approval-panel_actions">
          {showPicker && (
            <button
              type="button"
              className="button button--dark"
              onClick={() => setRows((currentRows) => [...currentRows, EMPTY_APPROVER])}
              disabled={directoryUnavailable || isBusy}
            >
              <Plus size={17} aria-hidden="true" />
              Add {approverLevel(rows.length + 1)}
            </button>
          )}

          {showPicker && (
            <button
              type="button"
              className="button button--primary"
              onClick={startActivate}
              disabled={directoryUnavailable || isBusy}
            >
              <Send size={17} aria-hidden="true" />
              {activateMutation.isPending ? "Starting…" : "Start signing"}
            </button>
          )}

          {rejected && isAuthor && workflowId && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setConfirming("resubmit")}
              disabled={isBusy || !resubmitComment.trim()}
            >
              <RotateCcw size={17} aria-hidden="true" />
              Send round again
            </button>
          )}

          {memo.hasFinalPdf && workflowId && (
            <>
              <button type="button" className="button button--dark" onClick={() => void finalPdf("view")} disabled={pdfBusy}>
                <Eye size={17} aria-hidden="true" />
                Open signed memo
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={() => void finalPdf("download")}
                disabled={pdfBusy}
              >
                <Download size={17} aria-hidden="true" />
                Download signed memo
              </button>
            </>
          )}
        </div>
      )}

      <ModalShell
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        busy={isBusy}
        labelledBy="memo-signoff-title"
        className="modal-panel--compact"
      >
        <div className="modal-panel_header">
          <h2 id="memo-signoff-title">
            {confirming === "activate" ? "Start signing" : "Send round again"}
          </h2>
        </div>

        <div className="modal-panel_body">
          <p className="brd-confirm-copy">
            {confirming === "activate"
              ? "The memo goes to these people in this order. Each one signs before it moves to the next."
              : mode === "FullRestart"
                  ? "Every approver signs the memo again, starting from the first."
                  : "The memo goes back to the approver who rejected it, keeping the signatures already given."}
          </p>

          {confirming === "activate" && (
            <ol className="approver-confirm-list">
              {rows.map((row, index) => (
                <li key={index}>
                  <strong>{approverLevel(index + 1)}:</strong> {row.name} ({row.role})
                </li>
              ))}
            </ol>
          )}

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="modal-panel_footer">
          <button type="button" className="button button--secondary" onClick={() => setConfirming(null)} disabled={isBusy}>
            Cancel
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={() => (confirming === "activate" ? activateMutation.mutate() : resubmitMutation.mutate())}
            disabled={isBusy}
          >
            {isBusy ? "Working…" : "Confirm"}
          </button>
        </div>
      </ModalShell>
    </section>
  );
}

export default MemoSignOffPanel;
