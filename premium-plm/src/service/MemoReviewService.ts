// A memo's review stage: its author sends it to reviewers they choose, who
// approve it one after another (no signature). A reviewer can decline it
// with a reason; the author then edits it and sends it again, to the same or
// different reviewers. Once every reviewer has approved, the author sets up
// the signing workflow (MemoSignOffPanel).
//
// Simulated (gaps file M34): the backend has no review endpoints yet, so
// reviews are kept in this browser's storage. A reviewer sees a memo only if
// they sign in on the same browser. Each function here stands in for one
// endpoint, so swapping in the real calls changes nothing else.

import { getCurrentUserId } from "../apicalls/authStorage";
import { listRows, makeLocalId, readRow, simulateLatency, writeRow } from "../mocks/localStore";
import type { ApproverInput } from "../types/approvalTypes";
import { MEMO_STATUS } from "../types/memoTypes";
import type { Memo, MemoPendingReview, MemoReview, MemoReviewStep, MemoStatus } from "../types/memoTypes";

const TABLE = "memo-reviews";

export const memoReviewKeys = {
  // Under memoKeys.all, so invalidating every memo query refreshes these too.
  all: ["memos", "reviews"] as const,
  one: (memoId: string) => ["memos", "reviews", "one", memoId] as const,
};

function now() {
  return new Date().toISOString();
}

// Stands in for: GET a memo's review (gaps file M34).
export async function getMemoReview(memoId: string): Promise<MemoReview | null> {
  return simulateLatency(readRow<MemoReview>(TABLE, memoId));
}

// Stands in for: GET every review (used to pick out the author's memos'
// stages; the real API would put the stage on the memo itself).
export async function listMemoReviews(): Promise<MemoReview[]> {
  return simulateLatency(listRows<MemoReview>(TABLE));
}

// Stands in for: GET the memos waiting for the signed-in user's review.
// Only the step whose turn it is counts, so the next reviewer sees nothing
// until the one before them approves.
export async function listMyPendingReviews(): Promise<MemoPendingReview[]> {
  const myId = getCurrentUserId();
  const reviews = listRows<MemoReview>(TABLE);

  return simulateLatency(
    reviews.flatMap((review) => {
      const step =
        review.status === "InReview"
          ? review.steps.find((item) => item.status === "Pending" && item.reviewerUserId === myId)
          : undefined;
      return step ? [{ review, step }] : [];
    }),
  );
}

// Stands in for: POST send a memo for review, with its reviewers in order
// (and, after a decline, a note of what changed). Starts a new round.
export async function sendMemoForReview(memo: Memo, reviewers: ApproverInput[], changeNote: string | null): Promise<MemoReview> {
  const previous = readRow<MemoReview>(TABLE, memo.id);
  const sentAt = now();

  const steps: MemoReviewStep[] = reviewers.map((reviewer, index) => ({
    id: makeLocalId("memo-review-step"),
    sequence: index + 1,
    reviewerUserId: reviewer.userId,
    reviewerName: reviewer.name,
    reviewerRole: reviewer.role,
    status: index === 0 ? "Pending" : "Waiting",
    sentAt: index === 0 ? sentAt : null,
    decidedAt: null,
    comment: null,
  }));

  const review: MemoReview = {
    memoId: memo.id,
    memoNumber: memo.memoNumber,
    subject: memo.subject,
    from: memo.from,
    to: memo.to,
    authorUserId: memo.createdByUserId || getCurrentUserId() || "",
    round: (previous?.round ?? 0) + 1,
    status: "InReview",
    steps,
    changeNote: changeNote?.trim() || null,
    sentAt,
    updatedAt: sentAt,
  };

  writeRow(TABLE, memo.id, review);
  return simulateLatency(review);
}

// Stands in for: POST a reviewer's decision. Approving passes the memo to
// the next reviewer, or (the last one) completes the review; declining sends
// it back to its author with the reason. Only the reviewer whose turn it is
// can decide.
export async function decideMemoReview(
  memoId: string,
  stepId: string,
  decision: "Approve" | "Decline",
  comment: string,
): Promise<MemoReview> {
  const review = readRow<MemoReview>(TABLE, memoId);
  const step = review?.steps.find((item) => item.id === stepId);

  if (!review || !step || review.status !== "InReview" || step.status !== "Pending") {
    throw new Error("This memo isn't waiting for your review any more.");
  }

  if (step.reviewerUserId !== getCurrentUserId()) {
    throw new Error("Only the reviewer whose turn it is can decide.");
  }

  if (decision === "Decline" && !comment.trim()) {
    throw new Error("Give a reason for declining.");
  }

  const decidedAt = now();
  const next = review.steps.find((item) => item.sequence === step.sequence + 1);

  const steps = review.steps.map((item): MemoReviewStep => {
    if (item.id === step.id) {
      return { ...item, status: decision === "Approve" ? "Approved" : "Declined", decidedAt, comment: comment.trim() || null };
    }

    if (decision === "Approve" && item.id === next?.id) {
      return { ...item, status: "Pending", sentAt: decidedAt };
    }

    return item;
  });

  const updated: MemoReview = {
    ...review,
    steps,
    status: decision === "Decline" ? "Declined" : next ? "InReview" : "Approved",
    updatedAt: decidedAt,
  };

  writeRow(TABLE, memoId, updated);
  return simulateLatency(updated);
}

// A memo's stage, from the server's status and its review. Through the
// review the server memo stays Draft, so the review decides the stage; from
// the signing stage on, the server's own status does.
export function memoStage(serverStatus: MemoStatus, review: MemoReview | null): MemoStatus {
  if (serverStatus !== MEMO_STATUS.draft || !review) {
    return serverStatus;
  }

  if (review.status === "InReview") return MEMO_STATUS.inReview;
  if (review.status === "Declined") return MEMO_STATUS.reviewDeclined;
  return MEMO_STATUS.reviewed;
}

// The reviewer who declined it in the latest round, if one did.
export function declinedStep(review: MemoReview | null): MemoReviewStep | null {
  return review?.status === "Declined" ? (review.steps.find((step) => step.status === "Declined") ?? null) : null;
}
