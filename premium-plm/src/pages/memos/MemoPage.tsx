import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";

import { getCurrentUserId } from "../../apicalls/authStorage";
import { SHOW_INITIATIVES } from "../../config/features";
import { getInitiativeById } from "../../service/InitiativeService";
import {
  canCreateInitiativeMemo,
  fetchMemoPreviewPdf,
  getMemo,
  getMemoVersions,
  isEditableStatus,
  isMine,
  isRejectedAtSignOff,
  listMyMemoApprovals,
  memoKeys,
  memoStatusClass,
  memoStatusText,
} from "../../service/MemoService";
import { getMemoReview, memoReviewKeys, memoStage } from "../../service/MemoReviewService";
import { openPdfInTab } from "../../service/PdfService";
import { MEMO_STATUS } from "../../types/memoTypes";
import type { MemoPendingApproval, MemoPendingReview } from "../../types/memoTypes";
import { formatDate } from "../../utils/ticketStatus";
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

// One memo. What shows depends on its stage and who's looking:
//   Draft / Declined in review: its author edits it, chooses the reviewers
//     and sends it for review.
//   In review: the reviewer whose turn it is approves or declines it; its
//     author follows the review.
//   Reviewed: its author chooses who signs it and starts the signing.
//   Out for sign-off: the approver whose turn it is signs or rejects it; its
//     author follows the signatures.
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

  // Kept in the browser until the backend has reviews (gaps file M34).
  const reviewQuery = useQuery({
    queryKey: memoReviewKeys.one(memoId ?? ""),
    queryFn: () => getMemoReview(memoId as string),
    enabled: !isNew,
  });

  const review = reviewQuery.data ?? null;
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

  const versionsQuery = useQuery({
    queryKey: memoKeys.versions(memoId ?? ""),
    queryFn: () => getMemoVersions(memoId as string),
    enabled: Boolean(memo && memo.version > 1 && isAuthor),
  });

  async function previewPdf() {
    setPdfError("");

    try {
      await openPdfInTab(() => fetchMemoPreviewPdf(memoId as string), window.open("", "_blank"));
    } catch (error) {
      console.error("Memo preview failed:", error);
      setPdfError("Couldn't open the memo. Try again.");
    }
  }

  const back = <BackLink fallbackTo="/dashboard/memos" fallbackLabel="Back to memos" />;

  if (memoQuery.isLoading || reviewQuery.isLoading || (memo && !isAuthor && pendingQuery.isLoading)) {
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
    stage === MEMO_STATUS.inReview
      ? (review?.steps.find((step) => step.status === "Pending" && step.reviewerUserId === myId) ?? null)
      : null;
  const myReview: MemoPendingReview | null = review && myReviewStep ? { review, step: myReviewStep } : null;
  const title = memo?.subject || "Memo";

  // A reviewer or approver sees the memo only while it's their turn, which
  // the review (M34) and my-pending-approvals decide.
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

  // A reviewer or approver (not its author): the PDF and their decision,
  // like a document's approval page.
  if (memo && !isAuthor) {
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
          <MemoSignedView item={signedItem} title={title} />
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
  const versions = versionsQuery.data ?? [];

  const signOffPanel = memo && (
    <MemoSignOffPanel
      memo={memo}
      stage={stage}
      isAuthor={isAuthor}
      workflowId={memo.workflowId ?? myItem?.workflowId ?? null}
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
        <MemoForm memo={memo} initiativeId={newInitiativeId} review={review} />
      ) : (
        memo && (
          <>
            {signingStarted && signOffPanel}

            {/* The review, while it's under way or just finished. */}
            {review && !signingStarted && <MemoReviewPanel review={review} />}

            <MemoReadOnlyView memo={memo} />

            <MemoAttachmentsList memoId={memo.id} />

            {inSigning && !signingStarted && signOffPanel}

            {/* Its review, for the record, once the signing is under way. */}
            {review && signingStarted && <MemoReviewPanel review={review} />}

            {/* The author, when they're also one of the approvers. */}
            {myItem && !signedItem && <MemoSignForm item={myItem} title={title} onSigned={setSignedItem} />}
          </>
        )
      )}

      {versions.length > 1 && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>Versions</h2>
              <p>Each saved edit makes a new version.</p>
            </div>
          </div>

          <ol className="memo-versions">
            {versions.map((version) => (
              <li key={version.id}>
                <strong>Version {version.version}</strong>
                <span>{formatDate(version.createdAt)}</span>
                {version.comment && <p>{version.comment}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default MemoPage;
