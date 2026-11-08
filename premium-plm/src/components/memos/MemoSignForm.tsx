import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { sileo } from "sileo";
import { AnimatePresence } from "motion/react";

import { getStoredUser } from "../../apicalls/authStorage";
import { fetchMemoPdfToSign, memoKeys, rejectMemo, signMemo } from "../../service/MemoService";
import { openPdfInTab } from "../../service/PdfService";
import type { MemoPendingApproval } from "../../types/memoTypes";
import { capitalize } from "../../utils/text";
import { clearDraft, useDraftState } from "../../utils/useDraftState";
import SignaturePad from "../approvals/SignaturePad";
import DraftRestoredNotice from "../common/DraftRestoredNotice";
import PdfCoverPreview from "../documents/PdfCoverPreview";
import MemoAttachmentsList from "./MemoAttachmentsList";
import DecisionModal from "../review/DecisionModal";
import ModalShell from "../common/ModalShell";

interface MemoSignFormProps {
  // The user's step on this memo, from my-pending-approvals.
  item: MemoPendingApproval;
  // The memo's subject, for the PDF card.
  title: string;
  // After signing, so the page can show the signed copy.
  onSigned: (item: MemoPendingApproval) => void;
}

// When it's the signed-in user's turn, laid out like a document's approval
// page: the memo's PDF first, then their signature. They sign it, or reject
// it with a reason (which sends it back to its author).
function MemoSignForm({ item, title, onSigned }: MemoSignFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signature, setSignature] = useState<string | null>(null);
  const [comment, setComment, commentDraft] = useDraftState(`memo-sign-comment:${item.stepId}`, "");
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
  const myName = capitalize(getStoredUser()?.userName ?? "");
  const rejectDraftKey = `memo-reject:${item.stepId}`;

  // Fetched once for the front-page preview, and reused when it's opened.
  const pdfQuery = useQuery({
    queryKey: ["memo-pdf-to-sign", item.workflowId, item.stepId],
    queryFn: () => fetchMemoPdfToSign(item),
    retry: false,
    staleTime: 5 * 60_000,
  });

  function clearDrafts() {
    clearDraft(`memo-sign-comment:${item.stepId}`);
    clearDraft(rejectDraftKey);
    setConfirming(null);
  }

  function openPdf() {
    setPdfError("");
    const loaded = pdfQuery.data;

    openPdfInTab(() => (loaded ? Promise.resolve(loaded) : fetchMemoPdfToSign(item)), window.open("", "_blank")).catch(
      (error: unknown) => {
        console.error("Memo PDF failed:", error);
        setPdfError("Couldn't open the memo's PDF. Try again.");
      },
    );
  }

  const signMutation = useMutation({
    mutationFn: () => signMemo(item, signature as string, comment),
    onSuccess: async () => {
      clearDrafts();
      sileo.success({ title: "Memo signed", description: "Your signature has been added." });
      onSigned(item);
      await queryClient.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: (error) =>
      sileo.error({ title: "Couldn't sign the memo", description: error instanceof Error ? error.message : "Try again." }),
  });

  // A rejected memo goes back to its author, and leaves the approver's queue.
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectMemo(item, reason),
    onSuccess: async () => {
      clearDrafts();
      sileo.success({ title: "Memo rejected", description: "It's gone back to its author with your reason." });
      navigate("/dashboard?filter=sign", { replace: true });
      await queryClient.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: (error) =>
      sileo.error({ title: "Couldn't reject the memo", description: error instanceof Error ? error.message : "Try again." }),
  });

  const isBusy = signMutation.isPending || rejectMutation.isPending;

  function startApprove() {
    if (!signature) {
      setErrorMessage("Draw or upload your signature first.");
      return;
    }

    setErrorMessage("");
    setConfirming("approve");
  }

  return (
    <>
      {pdfError && (
        <p className="form-error" role="alert">
          {pdfError}
        </p>
      )}

      <PdfCoverPreview
        blob={pdfQuery.data}
        isLoading={pdfQuery.isLoading}
        isError={pdfQuery.isError}
        title={title}
        hint={
          item.sequence === 1
            ? "Open the memo to read it before signing."
            : "Open the memo to read it, with the signatures so far, before signing."
        }
        onOpen={openPdf}
        openLabel="Open memo"
      />

      <MemoAttachmentsList memoId={item.memoId} />

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Your signature</h2>
            <p>
              Signing as <strong>{myName || "you"}</strong>
              {item.approverRole ? `, ${item.approverRole}` : ""}. It's added beside your name on the memo.
            </p>
          </div>
        </div>

        <div className="proposal-section">
          <DraftRestoredNotice savedAt={commentDraft.restoredAt} onDiscard={commentDraft.discard} keepHint="Sign or reject to keep it." />

          <SignaturePad value={signature} onChange={setSignature} disabled={isBusy} />

          <div className="form-field">
            <label htmlFor="memo-sign-comment">Comment (optional)</label>
            <textarea
              id="memo-sign-comment"
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
          Read the memo? Sign to approve it, or reject it with a reason to send it back to its author.
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

      <ModalShell
        open={Boolean(confirming === "approve" && signature)}
        onClose={() => setConfirming(null)}
        busy={isBusy}
        labelledBy="memo-sign-title"
        className="modal-panel--compact"
      >
        <div className="modal-panel_header">
          <h2 id="memo-sign-title">Approve &amp; sign</h2>
        </div>

        <div className="modal-panel_body">
          <p className="brd-confirm-copy">
            Your signature is added to the memo beside your name, and it moves to the next approver. This
            can't be undone.
          </p>

          <div className="signature-confirm">
            <img src={signature ?? undefined} alt="Your signature" />
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
      </ModalShell>

      <AnimatePresence>
        {confirming === "reject" && (
          <DecisionModal
            decision="reject"
            draftKey={rejectDraftKey}
            approveTitle=""
            rejectTitle="Reject the memo"
            approveBody=""
            rejectLabel="Reason"
            rejectPlaceholder="What needs to change before you can sign it?"
            isPending={rejectMutation.isPending}
            errorMessage={errorMessage}
            onCancel={() => setConfirming(null)}
            onConfirm={(reason) => rejectMutation.mutate(reason)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default MemoSignForm;
