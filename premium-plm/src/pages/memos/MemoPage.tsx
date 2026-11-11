import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";

import { getCurrentUserId } from "../../apicalls/authStorage";
import { SHOW_INITIATIVES } from "../../config/features";
import { getInitiativeById } from "../../service/InitiativeService";
import {
  canCreateInitiativeMemo,
  fetchMemoPdfForAuthor,
  getMemo,
  getMemoSteps,
  isEditableStatus,
  isMine,
  isRejectedAtSignOff,
  listMyMemoApprovals,
  memoKeys,
  memoStatusClass,
  memoStatusText,
} from "../../service/MemoService";
import { getMemoReview, memoReviewKeys, memoStage, withReviewerNames } from "../../service/MemoReviewService";
import { getAllUsers } from "../../service/UserService";
import { openPdfInTab } from "../../service/PdfService";
import { MEMO_STATUS } from "../../types/memoTypes";
import type { MemoPendingApproval } from "../../types/memoTypes";
import BackLink from "../../components/common/BackLink";
import MemoForm from "../../components/memos/MemoForm";
import MemoAttachmentsList from "../../components/memos/MemoAttachmentsList";
import MemoReadOnlyView from "../../components/memos/MemoReadOnlyView";
import MemoReviewForm from "../../components/memos/MemoReviewForm";
import MemoReviewPanel from "../../components/memos/MemoReviewPanel";
import MemoSignForm from "../../components/memos/MemoSignForm";
import MemoSignedView from "../../components/memos/MemoSignedView";
import MemoSignOffPanel from "../../components/memos/MemoSignOffPanel";
import { CopyButton } from "../../components/ui/CopyButton";

const SIGNING_STAGES: string[] = [MEMO_STATUS.reviewed, MEMO_STATUS.readyForApproval, MEMO_STATUS.inApproval, MEMO_STATUS.approved];
const REVIEW_STAGES: string[] = [MEMO_STATUS.inReview, MEMO_STATUS.reviewRejected];

// One memo. What shows depends on its stage and who's looking:
//   Draft / Changes requested: its author edits it, chooses the reviewers
//     and sends it for review (again, after changes).
//   In review: the reviewer whose turn it is approves it, asks for changes
//     or rejects it; its author follows the review.
//   Reviewed: its author chooses who signs it and starts the signing.
//   Out for sign-off: the approver whose turn it is signs or rejects it; its
//     author follows the signatures. An author who is also an approver gets
//     the same signing screen as every other approver while it's their turn,
//     then their author's view once they've signed.
//   Fully signed: the signed PDF.
// Only its author, and the reviewer or approver whose turn it is, can open
// it. Reviewers and approvers get an approval-page layout: the PDF, then
// their decision. /dashboard/memos/new starts one (?initiative=<id>
// attaches it to that initiative).
function MemoPage() {
  const { memoId } = useParams<{ memoId: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !memoId;
  // Initiatives are hidden for now (config/features.ts), so new memos are
  // all standalone.
  const newInitiativeId = isNew && SHOW_INITIATIVES ? searchParams.get("initiative") : null;
  const [pdfError, setPdfError] = useState("");
  // The step the user has just signed: an approver then sees the signed copy
  // until they leave, though the memo has left their queue.
  const [signedItem, setSignedItem] = useState<MemoPendingApproval | null>(null);

  const memoQuery = useQuery({
    queryKey: memoKeys.one(memoId ?? ""),
    queryFn: () => getMemo(memoId as string),
    enabled: !isNew,
  });

  const memo = memoQuery.data ?? null;
  const initiativeId = memo?.initiativeId ?? newInitiativeId;
  const isAuthor = memo ? isMine(memo) : true;

  // Its review, once its reviewers are set.
  const reviewWorkflowId = memo?.reviewerWorkflowId ?? null;
  const reviewQuery = useQuery({
    queryKey: memoReviewKeys.one(reviewWorkflowId ?? ""),
    queryFn: () => getMemoReview(reviewWorkflowId as string),
    enabled: Boolean(reviewWorkflowId),
  });

  // Reviewers' names, from the staff list when the author can read it (the
  // review has only their ids, gaps file M39).
  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
    enabled: isAuthor && Boolean(reviewQuery.data),
  });

  const review = withReviewerNames(reviewQuery.data ?? null, usersQuery.data ?? []);
  const stage = memo ? memoStage(memo.status, review) : MEMO_STATUS.draft;

  // The initiative's name, for the PM and the Group Head (who can read it).
  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", initiativeId],
    queryFn: () => getInitiativeById(initiativeId as string),
    enabled: SHOW_INITIATIVES && Boolean(initiativeId) && canCreateInitiativeMemo(),
  });

  // The user's own step, if the memo is waiting for their signature.
  const pendingQuery = useQuery({
    queryKey: memoKeys.pending,
    queryFn: listMyMemoApprovals,
    enabled: memo?.status === MEMO_STATUS.inApproval,
  });

  // The memo's sign-off, and its signatures so far (the same request as the
  // signing panel's, so it isn't fetched twice), for "Open memo".
  const signOffWorkflowId =
    memo?.workflowId ??
    signedItem?.workflowId ??
    (memo ? (pendingQuery.data ?? []).find((item) => item.memoId === memo.id)?.workflowId : undefined) ??
    null;
  const stepsQuery = useQuery({
    queryKey: memoKeys.steps(signOffWorkflowId ?? ""),
    queryFn: () => getMemoSteps(signOffWorkflowId as string),
    enabled: Boolean(signOffWorkflowId) && isAuthor,
  });
  const signedCount = (stepsQuery.data ?? []).filter((step) => step.status === "Signed").length;
  const fullySigned = memo?.status === MEMO_STATUS.approved;

  async function previewPdf() {
    setPdfError("");

    try {
      await openPdfInTab(
        () => fetchMemoPdfForAuthor(memoId as string, signOffWorkflowId, signedCount, fullySigned),
        window.open("", "_blank"),
      );
    } catch (error) {
      console.error("Memo preview failed:", error);
      setPdfError("Couldn't open the memo. Try again.");
    }
  }

  const back = <BackLink fallbackTo="/dashboard/memos" fallbackLabel="Back to memos" />;

  // Waits for the user's signing step too, so an author who signs doesn't
  // see their author's view flash up first.
  if (memoQuery.isLoading || reviewQuery.isLoading || (memo && pendingQuery.isLoading)) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading memo…</p>
      </div>
    );
  }

  if (!isNew && !memo) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this memo. It may have been removed, or the server is unavailable. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (isNew && newInitiativeId && !canCreateInitiativeMemo()) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiative-detail-message">
          Only the Product Manager and the Group Head can write a memo for an initiative.
        </p>
      </div>
    );
  }

  const myId = getCurrentUserId();
  const myItem = memo ? ((pendingQuery.data ?? []).find((item) => item.memoId === memo.id) ?? null) : null;
  const myReviewStep =
    review?.status === "InReview"
      ? (review.steps.find((step) => step.status === "Pending" && step.reviewerUserId === myId) ?? null)
      : null;
  const myReview = review && myReviewStep ? { review, step: myReviewStep } : null;
  const title = memo?.subject || "Memo";

  // A reviewer or approver sees the memo only while it's their turn, which
  // the review and my-pending-approvals decide.
  if (memo && !isAuthor && !myReview && !myItem && !signedItem) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiative-detail-message">
          This memo isn't available to you. Only its author, and the reviewer or approver whose turn it is, can open
          it.
        </p>
      </div>
    );
  }

  // A reviewer or approver: the PDF and their decision, like a document's
  // approval page. Its author too, while it's their turn to sign: everyone
  // signing gets the same screen.
  const authorSigning = isAuthor && Boolean(myItem) && !signedItem;

  if (memo && (!isAuthor || authorSigning)) {
    const signing = signedItem ?? myItem;
    const badge = signedItem
      ? { className: "status-badge status-badge--approved", text: "Signed by you" }
      : signing
        ? { className: "status-badge status-badge--brd-under-review", text: "Awaiting your signature" }
        : { className: "status-badge status-badge--brd-under-review", text: "Awaiting your review" };

    return (
      <div className="dashboard-page">
        {back}

        <header className="dashboard-header initiative-detail-header">
          <div className="dashboard-header__content">
            <p className="dashboard-breadcrumb">PremiumPLM / Memos / {title}</p>

            <h1 className="dashboard-title">{title}</h1>

            <p className="dashboard-subtitle initiative-detail-badges">
              <span className="memo-number">
                Memo{memo.memoNumber ? ` · ${memo.memoNumber}` : ""}
                {memo.memoNumber && <CopyButton value={memo.memoNumber} label="Copy" className="memo-number__copy" />}
              </span>
              <span className={badge.className}>{badge.text}</span>
              <span className="brd-version-tag">
                {signing
                  ? `Approver ${signing.sequence}`
                  : myReview
                    ? `Reviewer ${myReview.step.sequence} of ${myReview.review.steps.length}`
                    : ""}
              </span>
            </p>
          </div>
        </header>

        {signedItem ? (
          <MemoSignedView
            item={signedItem}
            title={title}
            // Read from the memo, re-read after signing: fully signed once
            // the last approver has signed.
            outcome={memoQuery.isFetching ? "checking" : memo.status === MEMO_STATUS.approved ? "final" : "next"}
          />
        ) : signing ? (
          <MemoSignForm item={signing} title={title} onSigned={setSignedItem} />
        ) : (
          myReview && <MemoReviewForm pending={myReview} title={title} />
        )}
      </div>
    );
  }

  // Its author.
  const initiativeName = initiativeQuery.data?.projectName ?? null;
  const editable = isNew || isEditableStatus(stage);
  const inSigning = SIGNING_STAGES.includes(stage) || isRejectedAtSignOff(stage);
  // Before the signing starts, the panel sits below the memo, where the
  // approvers are chosen after reading it; once it has, above, so the
  // signatures so far are the first thing they see.
  const signingStarted = inSigning && stage !== MEMO_STATUS.reviewed && stage !== MEMO_STATUS.readyForApproval;

  const signOffPanel = memo && (
    <MemoSignOffPanel
      memo={memo}
      stage={stage}
      isAuthor={isAuthor}
      workflowId={signOffWorkflowId}
      currentStepId={myItem?.stepId}
    />
  );

  return (
    <div className="dashboard-page">
      {back}

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Memos{initiativeName ? ` / ${initiativeName}` : ""}</p>

          <h1 className="dashboard-title">{memo?.subject || "New memo"}</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span className="memo-number">
              {!SHOW_INITIATIVES
                ? "Memo"
                : initiativeId
                  ? initiativeName
                    ? `Memo for ${initiativeName}`
                    : "Initiative memo"
                  : "Standalone memo"}
              {memo?.memoNumber ? ` · ${memo.memoNumber}` : ""}
              {memo?.memoNumber && <CopyButton value={memo.memoNumber} label="Copy" className="memo-number__copy" />}
            </span>
            {memo && <span className={memoStatusClass(stage)}>{memoStatusText(stage)}</span>}
            {memo && <span>v{memo.version}</span>}
          </p>
        </div>

        {memo && (
          <div className="dashboard-header__actions">
            <button type="button" className="button button--dark" onClick={() => void previewPdf()}>
              <Eye size={17} aria-hidden="true" />
              Open memo
            </button>
          </div>
        )}
      </header>

      {pdfError && (
        <p className="form-error" role="alert">
          {pdfError}
        </p>
      )}

      {editable ? (
        <MemoForm memo={memo} initiativeId={newInitiativeId} review={review} reviewersLoading={reviewQuery.isLoading} />
      ) : (
        memo && (
          <>
            {/* Once the signing is under way: the signatures first, then the
                finished review, then the memo. */}
            {signingStarted && signOffPanel}
            {review && signingStarted && <MemoReviewPanel review={review} />}

            {/* The review, while it's under way or just finished. */}
            {review && !signingStarted && <MemoReviewPanel review={review} />}
            {!review && REVIEW_STAGES.includes(stage) && reviewQuery.isError && (
              <p className="form-error" role="alert">
                Couldn't load the memo's review. Refresh the page to try again.
              </p>
            )}

            <MemoReadOnlyView memo={memo} />

            <MemoAttachmentsList memoId={memo.id} />

            {inSigning && !signingStarted && signOffPanel}
          </>
        )
      )}
    </div>
  );
}

export default MemoPage;
