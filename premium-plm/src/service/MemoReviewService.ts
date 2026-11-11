// A memo's review stage, before signing: its author sends it to reviewers
// they choose, who approve it one after another (no signature). A reviewer
// can ask for changes (the author edits it and sends it again) or reject it.
// Once every reviewer has approved, the author sets up the signing
// (MemoSignOffPanel).
//
//   MemoReviewers
//     POST api/memos/{memoId}/submit-memo                                    first: ends the draft
//     POST api/memo-reviewers/{memoId}/create-reviewer-workflow              then the reviewers, in order
//     GET  api/memo-reviewers/{wf}/get-reviewer-workflow                     rounds and steps
//     POST api/memo-reviewers/workflow/{wf}/steps/{step}/reviewer-decision   Approve / RequestChanges / Reject
//     POST api/memo-reviewers/memos/{memoId}/resubmit-memo-after-changes     the author, after changes
//     POST api/memo-reviewers/memos/{memoId}/resume-reviewer-workflow        where the review picks up
//
// The memos waiting for the signed-in user's review come from
// api/memos/my-assigned-memo (MemoService). Not on the API yet (gaps file
// M39): reviewers' names on the steps.

import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";
import type { ApproverInput } from "../types/approvalTypes";
import { MEMO_STATUS } from "../types/memoTypes";
import type { MemoReview, MemoReviewResumeMode, MemoReviewStep, MemoReviewStepStatus, MemoStatus } from "../types/memoTypes";
import { isRecord, readList, readNumber, readString, statusKey, unwrapData } from "../utils/apiShape";
import type { ApiRecord } from "../utils/apiShape";
import type { PLMUser } from "../types/userTypes";
import { formatPersonName, formatRoleName, toApiRoleName } from "../utils/text";

function auth() {
  return { token: getToken() ?? undefined };
}

export const memoReviewKeys = {
  // Under memoKeys.all, so invalidating every memo query refreshes these too.
  all: ["memos", "reviews"] as const,
  one: (workflowId: string) => ["memos", "reviews", "one", workflowId] as const,
};

// ---------------------------------------------------------------------------
// Reading

// Step statuses: Pending (not their turn yet), AwaitingAction (their turn),
// Approved, ChangesRequested, Rejected, Superseded (an earlier round's).
function toStepStatus(value: unknown): MemoReviewStepStatus {
  const key = statusKey(value);

  if (key === "awaitingaction") return "Pending";
  if (key === "approved") return "Approved";
  if (key === "changesrequested") return "Declined";
  if (key === "rejected") return "Rejected";
  return "Waiting";
}

// Workflow statuses: InProgress, ChangesRequested, Rejected, Completed,
// Cancelled.
function toReviewStatus(value: unknown): MemoReview["status"] {
  const key = statusKey(value);

  if (key === "changesrequested") return "Declined";
  if (key === "rejected") return "Rejected";
  if (key === "completed") return "Approved";
  if (key === "cancelled") return "Cancelled";
  return "InReview";
}

function toStep(row: ApiRecord, index: number): MemoReviewStep | null {
  const id = readString(row, "stepId", "id");
  const role = readString(row, "reviewerRole");

  return id
    ? {
        id,
        sequence: readNumber(row, "sequence") ?? index + 1,
        reviewerUserId: readString(row, "reviewerUserId") ?? "",
        reviewerName: readString(row, "reviewerName"),
        reviewerRole: role ? formatRoleName(role) : "",
        status: toStepStatus(readString(row, "status")),
        sentAt: readString(row, "assignedAt"),
        decidedAt: readString(row, "respondedAt"),
        comment: readString(row, "comment"),
      }
    : null;
}

export async function getMemoReview(workflowId: string): Promise<MemoReview | null> {
  const body = await apiClient<unknown>(`api/memo-reviewers/${workflowId}/get-reviewer-workflow`, { ...auth() });
  const data = unwrapData(body);

  if (!isRecord(data)) {
    return null;
  }

  // The latest round; earlier ones are superseded.
  const round = readNumber(data, "currentExecutionNumber") ?? 1;
  const executions = readList(data.executions);
  const current =
    executions.find((execution) => readNumber(execution, "executionNumber") === round) ?? executions.at(-1) ?? null;

  const steps = readList(current?.steps)
    .map(toStep)
    .filter((step): step is MemoReviewStep => step !== null)
    .sort((a, b) => a.sequence - b.sequence);

  const dates = [
    readString(data, "completedAt"),
    readString(data, "activatedAt"),
    readString(data, "createdAt"),
    ...steps.flatMap((step) => [step.decidedAt, step.sentAt]),
  ].filter((date): date is string => Boolean(date));

  return {
    workflowId: readString(data, "workflowId") ?? workflowId,
    memoId: readString(data, "memoId") ?? "",
    memoVersion: readNumber(data, "memoVersion") ?? 1,
    round,
    status: toReviewStatus(readString(data, "status")),
    steps,
    changeNote: current ? readString(current, "resumptionComment") : null,
    updatedAt: dates.sort().at(-1) ?? "",
  };
}

// ---------------------------------------------------------------------------
// The author

// Sets the reviewers, in order. Returns the review's id.
export async function createMemoReview(memoId: string, reviewers: ApproverInput[]): Promise<string | null> {
  const body = await apiClient<unknown>(`api/memo-reviewers/${memoId}/create-reviewer-workflow`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      reviewers: reviewers.map((reviewer, index) => ({
        reviewerUserId: reviewer.userId,
        // The API's role name ("RiskOfficer"), not the label shown on screen.
        reviewerRole: toApiRoleName(reviewer.role),
        sequence: index + 1,
      })),
    }),
  });

  const data = unwrapData(body);
  return isRecord(data) ? readString(data, "reviewerWorkflowId", "workflowId") : null;
}

// Ends the draft. Must come before createMemoReview (the API refuses
// reviewers for a memo that hasn't been submitted).
export async function submitMemo(memoId: string): Promise<void> {
  await apiClient<unknown>(`api/memos/${memoId}/submit-memo`, { method: "POST", ...auth() });
}

// After a reviewer asked for changes and the author has made them: records
// what changed.
export async function resubmitMemoAfterChanges(memoId: string, revisionComment: string): Promise<void> {
  await apiClient<unknown>(`api/memo-reviewers/memos/${memoId}/resubmit-memo-after-changes`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ revisionComment }),
  });
}

// Where the review picks up again: the reviewer who asked for changes, the
// first reviewer, or a chosen one (by their place in the order).
export async function resumeMemoReview(
  memoId: string,
  mode: MemoReviewResumeMode,
  fromSequence: number | null,
  comment: string,
): Promise<void> {
  await apiClient<unknown>(`api/memo-reviewers/memos/${memoId}/resume-reviewer-workflow`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      resumptionMode: mode,
      resumeFromSequence: mode === "ResumeFromSelectedReviewer" ? fromSequence : null,
      comment,
    }),
  });
}

// ---------------------------------------------------------------------------
// The reviewer

export type MemoReviewDecision = "Approve" | "RequestChanges" | "Reject";

export async function decideMemoReview(
  workflowId: string,
  stepId: string,
  decision: MemoReviewDecision,
  comment: string,
): Promise<void> {
  await apiClient<unknown>(`api/memo-reviewers/workflow/${workflowId}/steps/${stepId}/reviewer-decision`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ decision, comment: comment.trim() || null }),
  });
}

// ---------------------------------------------------------------------------
// Stage

// The server's own status, in the app's words. The review stage's status
// names aren't documented, so they're recognised by what they say.
export function normaliseMemoStatus(status: MemoStatus): MemoStatus {
  const key = statusKey(status);

  if (key.includes("grouphead")) return status;
  if (key.includes("review") && key.includes("reject")) return MEMO_STATUS.reviewRejected;
  if (key.includes("changesrequested")) return MEMO_STATUS.reviewDeclined;
  if (key === "reviewed" || key === "reviewcompleted") return MEMO_STATUS.reviewed;
  if (key.includes("review") || key === "submitted") return MEMO_STATUS.inReview;
  return status;
}

const SIGNING: string[] = [MEMO_STATUS.readyForApproval, MEMO_STATUS.inApproval, MEMO_STATUS.approved];

// A memo's stage: once it's in signing, the server's status; before that,
// its review's when it's loaded.
export function memoStage(serverStatus: MemoStatus, review: MemoReview | null): MemoStatus {
  const status = normaliseMemoStatus(serverStatus);

  if (!review || SIGNING.includes(status) || /approv/i.test(status)) {
    return status;
  }

  if (review.status === "InReview") return MEMO_STATUS.inReview;
  if (review.status === "Declined") return MEMO_STATUS.reviewDeclined;
  if (review.status === "Rejected") return MEMO_STATUS.reviewRejected;
  if (review.status === "Approved") return MEMO_STATUS.reviewed;
  return status;
}

// The reviewer who asked for changes in the latest round, if one did.
export function declinedStep(review: MemoReview | null): MemoReviewStep | null {
  return review?.status === "Declined" ? (review.steps.find((step) => step.status === "Declined") ?? null) : null;
}

// "Satar Lawal", or "Reviewer 2" when the name isn't known.
export function reviewerLabel(step: MemoReviewStep): string {
  return step.reviewerName || `Reviewer ${step.sequence}`;
}

// Fills in reviewers' names from the staff list, when the user can read it.
export function withReviewerNames(review: MemoReview | null, users: PLMUser[]): MemoReview | null {
  if (!review || users.length === 0) {
    return review;
  }

  const names = new Map(users.map((user) => [user.userId, formatPersonName(user)]));

  return {
    ...review,
    steps: review.steps.map((step) => ({ ...step, reviewerName: step.reviewerName || names.get(step.reviewerUserId) || null })),
  };
}
