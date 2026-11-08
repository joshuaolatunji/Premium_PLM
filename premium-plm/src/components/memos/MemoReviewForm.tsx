import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { sileo } from "sileo";
import { AnimatePresence } from "motion/react";

import { fetchMemoPreviewPdf, memoKeys } from "../../service/MemoService";
import { decideMemoReview } from "../../service/MemoReviewService";
import { openPdfInTab } from "../../service/PdfService";
import type { MemoPendingReview } from "../../types/memoTypes";
import { clearDraft } from "../../utils/useDraftState";
import PdfCoverPreview from "../documents/PdfCoverPreview";
import MemoAttachmentsList from "./MemoAttachmentsList";
import DecisionModal from "../review/DecisionModal";
import type { Decision } from "../review/DecisionModal";

interface MemoReviewFormProps {
  // The user's review step on this memo (their turn).
  pending: MemoPendingReview;
  title: string;
}

// When it's the signed-in user's turn to review a memo, laid out like an
// approval page: the memo's PDF, then their decision. Reviewers don't sign;
// approving passes it to the next reviewer, declining (with a reason) sends
// it back to its author.
function MemoReviewForm({ pending, title }: MemoReviewFormProps) {
  const { review, step } = pending;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [pdfError, setPdfError] = useState("");
  const declineDraftKey = `memo-review-decline:${step.id}`;

  // Fetched once for the front-page preview, and reused when it's opened.
  const pdfQuery = useQuery({
    queryKey: ["memo-pdf-preview", review.memoId],
    queryFn: () => fetchMemoPreviewPdf(review.memoId),
    retry: false,
    staleTime: 5 * 60_000,
  });

  function openPdf() {
    setPdfError("");
    const loaded = pdfQuery.data;

    openPdfInTab(
      () => (loaded ? Promise.resolve(loaded) : fetchMemoPreviewPdf(review.memoId)),
      window.open("", "_blank"),
    ).catch((error: unknown) => {
      console.error("Memo PDF failed:", error);
      setPdfError("Couldn't open the memo. Try again.");
    });
  }

  // Either way the memo leaves the reviewer's queue, so they go back to it.
  const decideMutation = useMutation({
    mutationFn: ({ approve, comment }: { approve: boolean; comment: string }) =>
      decideMemoReview(review.memoId, step.id, approve ? "Approve" : "Decline", comment),
    onSuccess: async (_data, { approve }) => {
      clearDraft(declineDraftKey);
      setDecision(null);
      sileo.success(
        approve
          ? { title: "Memo approved", description: "It moves on to the next reviewer, or back to its author." }
          : { title: "Memo declined", description: "It's gone back to its author with your reason." },
      );
      navigate("/dashboard?filter=review", { replace: true });
      await queryClient.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: (error) =>
      sileo.error({ title: "Couldn't record your decision", description: error instanceof Error ? error.message : "Try again." }),
  });

  const isLast = step.sequence === review.steps.length;

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
        hint="Open the memo to read it before you decide."
        onOpen={openPdf}
        openLabel="Open memo"
      />

      <MemoAttachmentsList memoId={review.memoId} />

      {review.changeNote && (
        <p className="memo-review-note">
          <strong>What the author changed:</strong> {review.changeNote}
        </p>
      )}

      <p className="mock-data-notice">
        Reviews are kept in this browser until the backend adds them (gaps file M34).
      </p>

      <div className="bdo-action-bar bdo-action-bar--static">
        <div>
          <p className="bdo-action-bar_hint">
            Read the memo? Approve it to pass it {isLast ? "back to its author for signing" : "to the next reviewer"}, or
            decline it with a reason to send it back to its author.
          </p>
        </div>

        <div className="brd-reviews-actions">
          <button
            type="button"
            className="button button--secondary brd-reject-button"
            onClick={() => {
              setDecision("reject");
            }}
            disabled={decideMutation.isPending}
          >
            Decline
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setDecision("approve");
            }}
            disabled={decideMutation.isPending}
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            Approve
          </button>
        </div>
      </div>

      <AnimatePresence>
        {decision && (
          <DecisionModal
            decision={decision}
            draftKey={declineDraftKey}
            approveTitle="Approve the memo"
            rejectTitle="Decline the memo"
            approveBody={
              isLast
                ? "You're the last reviewer. Its author can then send it for signing."
                : "It moves to the next reviewer. This can't be undone."
            }
            rejectLabel="Reason"
            rejectPlaceholder="What should the author change?"
            isPending={decideMutation.isPending}
            onCancel={() => setDecision(null)}
            onConfirm={(comment) => decideMutation.mutate({ approve: decision === "approve", comment })}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default MemoReviewForm;
