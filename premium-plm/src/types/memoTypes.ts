// A memo: either attached to an initiative (shown with its PID, FRD, BRD and
// SWR) or standalone (the Memos page). Its author (the initiator):
//   1. writes it and sends it to reviewers they choose, who approve it in
//      order (no signature); a reviewer can decline it with a reason, and
//      the author edits it and sends it again;
//   2. once every reviewer has approved, sets up the signing workflow and
//      starts it; the workflow approvers sign in order, and the backend adds
//      the signatures to the memo's PDF.
// The Group Head has no special part in it.

// A memo's stage. The review stage comes from the memo's reviewer workflow
// when it's loaded (see memoStage), and otherwise from the server's status.
// Kept as a plain string so a status the API adds later still shows, as its
// own words.
export type MemoStatus = string;

export const MEMO_STATUS = {
  draft: "Draft",
  // Review stage. A reviewer can ask for changes (the author edits it and
  // sends it again) or reject it outright.
  inReview: "InReview",
  reviewDeclined: "ReviewDeclined",
  reviewRejected: "ReviewRejected",
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
// them now; Declined: they asked for changes; Rejected: they rejected it.
export type MemoReviewStepStatus = "Waiting" | "Pending" | "Approved" | "Declined" | "Rejected";

export interface MemoReviewStep {
  id: string;
  sequence: number;
  reviewerUserId: string;
  // The API sends only the user id; the page fills the name in from the
  // staff list when it can read it (gaps file M39).
  reviewerName: string | null;
  reviewerRole: string;
  status: MemoReviewStepStatus;
  // When it reached them, and when they decided.
  sentAt: string | null;
  decidedAt: string | null;
  comment: string | null;
}

// A memo's review (get-reviewer-workflow): the reviewers its author chose,
// in order. Each resend after changes starts a new round, with the same
// reviewers; only the latest round is kept here.
export interface MemoReview {
  workflowId: string;
  memoId: string;
  memoVersion: number;
  round: number;
  status: "InReview" | "Declined" | "Rejected" | "Approved" | "Cancelled";
  steps: MemoReviewStep[];
  // What the author changed, when they sent it again.
  changeNote: string | null;
  updatedAt: string;
}

// After changes, where the review picks up again.
export type MemoReviewResumeMode = "ResumeFromRequestingReviewer" | "FullRestart" | "ResumeFromSelectedReviewer";

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
  // The memo's sign-off, once its approvers are set.
  workflowId: string | null;
  // The memo's review, once its reviewers are set.
  reviewerWorkflowId: string | null;
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

// A memo the signed-in user is a reviewer on (my-assigned-memo): their step
// in its review, and whether it's their turn.
export interface MemoAssignedReview {
  memo: MemoSummary;
  reviewerWorkflowId: string | null;
  stepId: string | null;
  sequence: number;
  // True while the step waits on them (stepStatus AwaitingAction).
  myTurn: boolean;
  assignedAt: string | null;
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
