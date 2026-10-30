import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";

import {
  approvalKeys,
  fetchPdfToSign,
  getMyPendingApprovals,
  rejectApproval,
  signAndApprove,
} from "../../service/ApprovalWorkflowService";
import { getInitiativeDocuments } from "../../service/DocumentService";
import type { PendingApproval } from "../../types/approvalTypes";
import { openPdfInTab } from "../../service/PdfService";
import { DOCUMENT_META } from "../../types/documentTypes";
import { documentsQueryKey } from "../../utils/documentStatus";
import { clearDraft, useDraftState } from "../../utils/useDraftState";
import { capitalize } from "../../utils/text";
import { getStoredUser } from "../../apicalls/authStorage";
import BackLink from "../../components/common/BackLink";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";
import DocumentReadOnlyView from "../../components/documents/DocumentReadOnlyView";
import PdfCoverPreview from "../../components/documents/PdfCoverPreview";
import SignaturePad from "../../components/approvals/SignaturePad";
import DecisionModal from "../../components/review/DecisionModal";

// An approver reads the document, then signs it (drawn or uploaded
// signature) or rejects it with a reason. Signing passes it to the next
// approver; the backend adds the signature beside their name on the PDF.
// Approvers see only their own place in the sign-off, never the others.
function ApprovalSign() {
  const { workflowId, stepId } = useParams<{ workflowId: string; stepId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The signature itself isn't kept as a draft on the device; the comment is.
  const [signature, setSignature] = useState<string | null>(null);
  const [comment, setComment, commentDraft] = useDraftState(`approval-comment:${stepId}`, "");
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfError, setPdfError] = useState("");

  const pendingQuery = useQuery({
    queryKey: approvalKeys.pending,
    queryFn: getMyPendingApprovals,
  });

  const item = pendingQuery.data?.find((entry) => entry.workflowId === workflowId && entry.stepId === stepId) ?? null;

  // Fetched once for the front-page preview, and reused when it's opened.
  // The first approver reads the approved document; later approvers read it
  // with the signatures so far.
  const pdfQuery = useQuery({
    queryKey: ["approval-pdf-to-sign", workflowId, stepId],
    queryFn: () => fetchPdfToSign(item as PendingApproval),
    enabled: Boolean(item),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(item?.initiativeId),
    queryFn: () => getInitiativeDocuments(item?.initiativeId as string),
    enabled: Boolean(item?.initiativeId),
    // Approvers outside the delivery team may not be allowed to read
    // documents directly; the PDF still works, so don't retry.
    retry: false,
  });

  const document = item?.documentType ? (documentsQuery.data?.[item.documentType] ?? null) : null;
  const decisionDraftKey = `decision:approval:${stepId}`;

  async function finish() {
    commentDraft.discard();
    clearDraft(decisionDraftKey);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: approvalKeys.all }),
      // The document's status names who has it next.
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(item?.initiativeId) }),
    ]);
    navigate("/dashboard/approvals");
  }

  const signMutation = useMutation({
    mutationFn: () => signAndApprove(workflowId as string, stepId as string, signature as string, comment.trim()),
    onSuccess: finish,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't record your signature."),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectApproval(workflowId as string, stepId as string, reason),
    onSuccess: finish,
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't record your decision."),
  });

  const isBusy = signMutation.isPending || rejectMutation.isPending;

  function openPdf() {
    setPdfError("");
    const tab = window.open("", "_blank");
    const loaded = pdfQuery.data;

    openPdfInTab(() => (loaded ? Promise.resolve(loaded) : fetchPdfToSign(item as PendingApproval)), tab).catch((error: unknown) => {
      console.error(error);
      setPdfError("Couldn't load the PDF from the server. Try again shortly.");
    });
  }

  function startApprove() {
    if (!signature) {
      setErrorMessage("Add your signature first — draw it or upload an image.");
      return;
    }

    setErrorMessage("");
    setConfirming("approve");
  }

  const back = <BackLink fallbackTo="/dashboard/approvals" fallbackLabel="Back to approvals" />;

  if (pendingQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiative-detail-message">
          {pendingQuery.isError
            ? "Couldn't load your approvals. Try refreshing the page."
            : "This document isn't waiting for your signature. It may already have been signed or rejected."}
        </p>
      </div>
    );
  }

  const type = item.documentType;
  const title = type ? DOCUMENT_META[type].name : "Document";
  const myName = capitalize(getStoredUser()?.userName ?? "");

  return (
    <div className="dashboard-page">
      {back}

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Approvals / {item.initiativeName ?? title}</p>

          <h1 className="dashboard-title">
            {item.initiativeName && type ? `${item.initiativeName} ${type}` : title}
          </h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span>{title}</span>
            <span className="status-badge status-badge--brd-under-review">Awaiting your signature</span>
            {item.sequence && item.totalSteps && (
              <span className="brd-version-tag">
                Approver {item.sequence} of {item.totalSteps}
              </span>
            )}
          </p>
        </div>
      </header>

      {pdfError && (
        <p className="form-error" role="alert">
          {pdfError}
        </p>
      )}

      <PdfCoverPreview
        blob={pdfQuery.data}
        isLoading={pdfQuery.isLoading}
        isError={pdfQuery.isError}
        title={item.initiativeName && type ? `${item.initiativeName} ${type}` : title}
        hint="Open the PDF to read the document before signing."
        onOpen={openPdf}
      />

      {document && <DocumentReadOnlyView document={document} initiativeName={item.initiativeName ?? undefined} />}

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Your signature</h2>
            <p>
              Signing as <strong>{myName || "you"}</strong>
              {item.approverRole ? `, ${item.approverRole}` : ""}. It's added beside your name on the document.
            </p>
          </div>
        </div>

        <div className="proposal-section">
          <DraftRestoredNotice
            savedAt={commentDraft.restoredAt}
            onDiscard={commentDraft.discard}
            keepHint="Sign or reject to keep it."
          />

          <SignaturePad value={signature} onChange={setSignature} disabled={isBusy} />

          <div className="form-field">
            <label htmlFor="approval-comment">Comment (optional)</label>
            <textarea
              id="approval-comment"
              rows={2}
              placeholder="Anything to note with your approval"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={isBusy}
            />
          </div>

          {errorMessage && !confirming && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </section>

      <div className="bdo-action-bar bdo-action-bar--static">
        <p className="bdo-action-bar_hint">
          Read the document? Sign to approve it, or reject it with a reason to send it back to the Product
          Manager.
        </p>

        <div className="brd-reviews-actions">
          <button
            type="button"
            className="button button--secondary brd-reject-button"
            onClick={() => {
              setErrorMessage("");
              setConfirming("reject");
            }}
            disabled={isBusy}
          >
            Reject
          </button>

          <button type="button" className="button button--primary" onClick={startApprove} disabled={isBusy}>
            <PenLine size={17} aria-hidden="true" />
            Approve &amp; sign
          </button>
        </div>
      </div>

      {confirming === "approve" && signature && (
        <div className="modal-overlay" role="presentation" onClick={() => !isBusy && setConfirming(null)}>
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="sign-confirm-title">Approve &amp; sign</h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                This signature will be added to the {type ?? "document"} beside your name, and the document
                moves to the next approver. This can't be undone.
              </p>

              <div className="signature-confirm">
                <img src={signature} alt="Your signature" />
                <span>
                  {myName}
                  {item.approverRole ? ` · ${item.approverRole}` : ""}
                </span>
              </div>

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

              <button type="button" className="button button--primary" onClick={() => signMutation.mutate()} disabled={isBusy}>
                {signMutation.isPending ? "Signing…" : "Sign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming === "reject" && (
        <DecisionModal
          decision="reject"
          draftKey={decisionDraftKey}
          approveTitle=""
          rejectTitle={`Reject the ${type ?? "document"}`}
          approveBody=""
          rejectLabel="Reason"
          rejectPlaceholder="What needs to change before you can sign it?"
          isPending={rejectMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
        />
      )}
    </div>
  );
}

export default ApprovalSign;
