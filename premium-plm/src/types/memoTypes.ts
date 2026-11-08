// A memo: either attached to an initiative (shown with its PID, FRD, BRD and
// SWR) or standalone (the Memos page). Its author (the initiator):
//   1. writes it and sends it to reviewers they choose, who approve it in
//      order (no signature); a reviewer can decline it with a reason, and
//      the author edits it and sends it again;
//   2. once every reviewer has approved, sets up the signing workflow and
//      starts it; the workflow approvers sign in order, and the backend adds
//      the signatures to the memo's PDF.
// The Group Head has no special part in it.

// A memo's stage. The review stage isn't on the server yet (gaps file M34):
// the server memo stays Draft through it, and these three stages come from
// the review kept in the browser (see memoStage). Kept as a plain string so a
// status the API adds later still shows, as its own words.
export type MemoStatus = string;

export const MEMO_STATUS = {
  draft: "Draft",
  // Review stage (kept in the browser until gaps file M34).
  inReview: "InReview",
  reviewDeclined: "ReviewDeclined",
  reviewed: "Reviewed",
  // Signing stage (the server's own statuses).
  readyForApproval: "ReadyForApproval",
  inApproval: "InApproval",
  approved: "Approved",
  // Memos from the old Group Head review, before this flow.
  withGroupHead: "PendingGroupHeadReview",
  changesRequested: "ChangesRequestedByGroupHead",
} as const;

// What the author fills in.
export interface MemoFields {
  to: string;
  thru: string;
  from: string;
  // yyyy-mm-dd
  date: string;
  subject: string;
  // "Memo details": HTML from the rich-text editor (the API's contentHtml).
  details: string;
}

export const EMPTY_MEMO_FIELDS: MemoFields = {
  to: "",
  thru: "",
  from: "",
  date: "",
  subject: "",
  details: "",
};

// The Group Head's last review, on memos from before the reviewer flow.
export interface MemoGroupHeadReview {
  decision: string;
  comment: string | null;
  reviewedAt: string | null;
}

// One reviewer, in review order. Waiting: not their turn yet; Pending: with
// them now.
export type MemoReviewStepStatus = "Waiting" | "Pending" | "Approved" | "Declined";

export interface MemoReviewStep {
  id: string;
  sequence: number;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  status: MemoReviewStepStatus;
  // When it reached them, and when they decided.
  sentAt: string | null;
  decidedAt: string | null;
  comment: string | null;
}

// A memo's review: the reviewers its author sent it to, in order. Each
// resend after a decline starts a new round.
export interface MemoReview {
  memoId: string;
  memoNumber: string;
  subject: string;
  from: string;
  to: string;
  authorUserId: string;
  round: number;
  status: "InReview" | "Declined" | "Approved";
  steps: MemoReviewStep[];
  // What the author changed, when they sent it again after a decline.
  changeNote: string | null;
  sentAt: string;
  updatedAt: string;
}

// A memo waiting for the signed-in user's review.
export interface MemoPendingReview {
  review: MemoReview;
  step: MemoReviewStep;
}

// One memo in full (get-memo-byId).
export interface Memo extends MemoFields {
  id: string;
  // e.g. "MEMO-2026-AD81F007".
  memoNumber: string;
  // Null for a standalone memo.
  initiativeId: string | null;
  // Not sent by the API, but kept as-is when saving.
  introduction: string | null;
  status: MemoStatus;
  // Goes up by one with each saved edit.
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  groupHeadReview: MemoGroupHeadReview | null;
  // The memo's sign-off, once its approvers are set. The API doesn't send
  // it on the memo yet (gaps file M27); read here so it's used once it does.
  workflowId: string | null;
  hasFinalPdf: boolean;
}

// One row of get-memos.
export interface MemoSummary {
  id: string;
  memoNumber: string;
  to: string;
  from: string;
  subject: string;
  status: MemoStatus;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string | null;
}

// A memo waiting for the signed-in user's signature (my-pending-approvals),
// with the workflow and step ids that signing needs.
export interface MemoPendingApproval {
  workflowId: string;
  memoId: string;
  stepId: string;
  memoNumber: string;
  subject: string;
  from: string;
  memoVersion: number;
  // 1 for the first to sign, 2 for the next, and so on.
  sequence: number;
  approverRole: string;
  assignedAt: string | null;
}

// One saved version of a memo (memo-historical-flow).
export interface MemoVersion {
  id: string;
  version: number;
  // Why it was revised, when resubmitted after changes were asked for.
  comment: string;
  createdAt: string;
}

// After a rejection at sign-off: everyone signs again, or it picks up from
// the approver who rejected it.
export type MemoResubmissionMode = "FullRestart" | "ResumeFromRejectingApprover";

// A memo as one row of a list, whichever list it came from.
// The user's part in a memo, on the Memos register.
export type MemoPart = "Author" | "Reviewer" | "Signer";

export interface MemoRegisterRow extends MemoRow {
  parts: MemoPart[];
  // Waiting on the user right now, and so what the row's button does.
  waiting: "review" | "sign" | "action" | null;
}

export interface MemoRow {
  id: string;
  memoNumber: string;
  subject: string;
  from: string;
  to: string;
  status: MemoStatus;
  // When it was last updated, or (waiting for a signature) sent to the user.
  date: string | null;
}
