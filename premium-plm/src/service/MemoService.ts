// Memos: one attached to an initiative, or standalone. Three controllers:
//
//   Memo
//     POST  api/memos/Create-memo                          create (Draft)
//     GET   api/memos/get-memos                            every memo (no filters)
//     GET   api/memos/my-assigned-memo                     memos the user reviews, with their step
//     GET   api/memos/{memoId}/get-memo-byId               one memo
//     PATCH api/memos/{memoId}/update-memo                 save; while it's a Draft
//     GET   api/memos/{memoId}/memo-historical-flow        saved versions
//   MemoApproval
//     POST  api/memo-approval-route/{memoId}/assign-approval-route    the author, once reviewed: approvers in order
//     POST  api/memo-approval-route/{memoId}/activate-approval-route  the author: starts the signing
//     GET   api/memo-approval-route/workflows/{wf}/get-memoapprovals-steps
//     POST  api/memo-approval-route/workflows/{wf}/steps/{step}/approve-and-sign
//     POST  api/memo-approval-route/workflows/{wf}/steps/{step}/reject-workflow-approvals
//     POST  api/memo-approval-route/workflows/{wf}/resubmit-memoapprovals
//     GET   api/memo-approval-route/my-pending-approvals
//   MemoPdf
//     GET   api/memo-pdf/{memoId}/preview                  the memo as it stands
//     GET   api/memo-pdf/{wf}/submitted-pdf                not used: returns no signatures (gaps M40)
//     GET   api/memo-pdf/{wf}/approval-review-pdf          everyone after signing, and later approvers before
//     GET   api/memo-pdf/workflows/{wf}/final-memo-pdf     fully signed
//
// The review stage before signing is in MemoReviewService. The Group Head
// review endpoints
// (submit-for-group-head-review, group-head-review, resubmit-for-review)
// belong to the old flow and aren't used.
//
// Not used: get-approvalmemo-workflow (the steps endpoint has the same and
// more) and get-approvalmemo-history (the steps already carry each
// decision, comment and date). Gaps file M26–M29.

import { apiClient } from "../apicalls/apiClient";
import { getCurrentUserId, getStoredUser, getToken } from "../apicalls/authStorage";
import type { ApprovalStep, ApprovalStepStatus, ApproverInput } from "../types/approvalTypes";
import { MEMO_STATUS } from "../types/memoTypes";
import type {
  Memo,
  MemoAssignedReview,
  MemoFields,
  MemoPendingApproval,
  MemoResubmissionMode,
  MemoStatus,
  MemoSummary,
  MemoVersion,
} from "../types/memoTypes";
import { readList, readNumber, readString, statusKey, unwrapData, isRecord } from "../utils/apiShape";
import type { ApiRecord } from "../utils/apiShape";
import { hasRole } from "../utils/roleRouting";
import { formatRoleName, toApiRoleName } from "../utils/text";
import { fetchPdfBlob } from "./PdfService";

function auth() {
  return { token: getToken() ?? undefined };
}

function myRoles(): string[] {
  return getStoredUser()?.roles ?? [];
}

export function isGroupHead(): boolean {
  return hasRole(myRoles(), "GroupHead");
}

// Initiative memos: the Product Manager and the Group Head. Standalone: anyone.
export function canCreateInitiativeMemo(): boolean {
  return isGroupHead() || hasRole(myRoles(), "ProjectManager");
}

// The author can change it (by stage, see memoStage) before it's sent for
// review, and after a reviewer asks for changes. Old memos the Group Head sent
// back can still be changed too.
export function isEditableStatus(stage: MemoStatus): boolean {
  return (
    stage === MEMO_STATUS.draft || stage === MEMO_STATUS.reviewDeclined || stage === MEMO_STATUS.changesRequested
  );
}

// A memo rejected at sign-off. The API's name for it isn't known yet (the
// rejection path is untested), so any status mentioning a rejection counts,
// except a rejection in review.
export function isRejectedAtSignOff(status: MemoStatus): boolean {
  return /reject/i.test(status) && !/review/i.test(status);
}

// The yyyy-mm-dd part of an API date-time.
function toDateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

// ---------------------------------------------------------------------------
// Reading

function toMemo(record: ApiRecord): Memo | null {
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  const decision = readString(record, "groupHeadDecision");

  return {
    id,
    memoNumber: readString(record, "memoNumber") ?? "",
    initiativeId: readString(record, "productInitiativeId"),
    to: readString(record, "to") ?? "",
    thru: readString(record, "thru") ?? "",
    from: readString(record, "from") ?? "",
    date: toDateOnly(readString(record, "memoDate")),
    subject: readString(record, "subject") ?? "",
    details: readString(record, "contentHtml") ?? "",
    introduction: readString(record, "introduction"),
    status: readString(record, "status") ?? MEMO_STATUS.draft,
    version: readNumber(record, "version") ?? 1,
    createdByUserId: readString(record, "createdBy") ?? "",
    createdAt: readString(record, "createdAt") ?? "",
    updatedAt: readString(record, "updatedAt"),
    submittedAt: readString(record, "submittedAt"),
    completedAt: readString(record, "completedAt"),
    groupHeadReview: decision
      ? {
          decision,
          comment: readString(record, "groupHeadComment"),
          reviewedAt: readString(record, "groupHeadReviewedAt"),
        }
      : null,
    workflowId: readString(record, "workflowId", "approvalWorkflowId"),
    reviewerWorkflowId: readString(record, "reviewerWorkflowId"),
    hasFinalPdf: Boolean(readString(record, "finalPdfReference")),
  };
}

function memoFrom(body: unknown): Memo {
  const data = unwrapData(body);
  const memo = isRecord(data) ? toMemo(data) : null;

  if (!memo) {
    throw new Error("The server's reply didn't include the memo.");
  }

  return memo;
}

function toSummary(record: ApiRecord): MemoSummary | null {
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  return {
    id,
    memoNumber: readString(record, "memoNumber") ?? "",
    to: readString(record, "to") ?? "",
    from: readString(record, "from") ?? "",
    subject: readString(record, "subject") ?? "",
    status: readString(record, "status") ?? MEMO_STATUS.draft,
    version: readNumber(record, "version") ?? 1,
    createdByUserId: readString(record, "createdBy") ?? "",
    createdAt: readString(record, "createdAt") ?? "",
    updatedAt: readString(record, "updatedAt"),
  };
}

// Every memo, newest change first. The API returns all of them to everyone,
// with no filters (gaps file M26); pages pick out the ones they show.
export async function listMemos(): Promise<MemoSummary[]> {
  const body = await apiClient<unknown>("api/memos/get-memos", { ...auth() });

  return readList(body)
    .map(toSummary)
    .filter((memo): memo is MemoSummary => memo !== null)
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
}

// The memos the signed-in user reviews, one row per review step: memoId,
// memoNumber, to, from, subject, memoVersion, reviewerWorkflowId, stepId,
// reviewerSequence, stepStatus (AwaitingAction while it's their turn),
// assignedAt, memoCreatedAt. Swagger doesn't describe it; this is the shape
// the live API returned (2026-11-09).
export async function listMyAssignedMemos(): Promise<MemoAssignedReview[]> {
  const body = await apiClient<unknown>("api/memos/my-assigned-memo", { ...auth() });

  return readList(body)
    .map((row): MemoAssignedReview | null => {
      const id = readString(row, "memoId", "id");

      return id
        ? {
            memo: {
              id,
              memoNumber: readString(row, "memoNumber") ?? "",
              to: readString(row, "to") ?? "",
              from: readString(row, "from") ?? "",
              subject: readString(row, "subject") ?? "",
              // The row has no memo status; it's in review while the step is open.
              status: MEMO_STATUS.inReview,
              version: readNumber(row, "memoVersion") ?? 1,
              createdByUserId: "",
              createdAt: readString(row, "memoCreatedAt") ?? "",
              updatedAt: readString(row, "assignedAt"),
            },
            reviewerWorkflowId: readString(row, "reviewerWorkflowId"),
            stepId: readString(row, "stepId"),
            sequence: readNumber(row, "reviewerSequence", "sequence") ?? 1,
            myTurn: statusKey(readString(row, "stepStatus")) === "awaitingaction",
            assignedAt: readString(row, "assignedAt"),
          }
        : null;
    })
    .filter((item): item is MemoAssignedReview => item !== null);
}

export async function getMemo(memoId: string): Promise<Memo> {
  return memoFrom(await apiClient<unknown>(`api/memos/${memoId}/get-memo-byId`, { ...auth() }));
}

export async function getMemoVersions(memoId: string): Promise<MemoVersion[]> {
  const body = await apiClient<unknown>(`api/memos/${memoId}/memo-historical-flow`, { ...auth() });

  return readList(body)
    .map((row): MemoVersion | null => {
      const id = readString(row, "id");
      return id
        ? {
            id,
            version: readNumber(row, "versionNumber") ?? 0,
            comment: readString(row, "revisionComment") ?? "",
            createdAt: readString(row, "createdAt") ?? "",
          }
        : null;
    })
    .filter((version): version is MemoVersion => version !== null)
    .sort((a, b) => b.version - a.version);
}

// ---------------------------------------------------------------------------
// Author: write, save, submit

function fieldsBody(fields: MemoFields) {
  return {
    to: fields.to.trim(),
    thru: fields.thru.trim() || null,
    from: fields.from.trim(),
    memoDate: fields.date ? `${fields.date}T00:00:00` : new Date().toISOString(),
    subject: fields.subject.trim(),
    contentHtml: fields.details,
  };
}

export async function createMemo(fields: MemoFields, initiativeId: string | null): Promise<Memo> {
  const body = await apiClient<unknown>("api/memos/Create-memo", {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ productInitiativeId: initiativeId, introduction: null, ...fieldsBody(fields) }),
  });

  return memoFrom(body);
}

// Saves every field: update-memo blanks any field left out (gaps file M28).
export async function updateMemo(memo: Memo, fields: MemoFields): Promise<Memo> {
  const body = await apiClient<unknown>(`api/memos/${memo.id}/update-memo`, {
    method: "PATCH",
    ...auth(),
    body: JSON.stringify({ introduction: memo.introduction, ...fieldsBody(fields) }),
  });

  return memoFrom(body);
}

// ---------------------------------------------------------------------------
// Sign-off

// Who signs, in order: set by the author once every reviewer has approved
// the memo. Returns the workflow's id. Until the backend's new flow is in
// (gaps file M35), it refuses a memo that hasn't been through the old Group
// Head review.
export async function assignMemoApprovers(memoId: string, approvers: ApproverInput[]): Promise<string | null> {
  const body = await apiClient<unknown>(`api/memo-approval-route/${memoId}/assign-approval-route`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      approvers: approvers.map((approver, index) => ({
        approverUserId: approver.userId,
        // The API's role name ("RiskOfficer"), not the label shown on screen.
        approverRole: toApiRoleName(approver.role),
        sequence: index + 1,
      })),
    }),
  });

  const data = unwrapData(body);
  return isRecord(data) ? readString(data, "workflowId") : null;
}

// The author, once the approvers are set: sends the memo to the first. Until
// gaps file M35 is fixed, the API allows only the Group Head.
export async function activateMemoSignOff(memoId: string): Promise<void> {
  await apiClient<unknown>(`api/memo-approval-route/${memoId}/activate-approval-route`, { method: "POST", ...auth() });
}

// The API's step statuses: Pending (not their turn yet), AwaitingAction
// (their turn), Approved, Rejected.
function toStepStatus(value: unknown): ApprovalStepStatus {
  const key = statusKey(value);

  if (key === "awaitingaction") return "Pending";
  if (key === "approved") return "Signed";
  if (key === "rejected") return "Rejected";
  return "Waiting";
}

// A step's signature as an image the page can show, from its
// signatureReference: a data URL, or bare base64 image data. Anything else
// (a file name or storage key) can't be shown without an endpoint that
// returns the image, which the memo API doesn't have (gaps M41).
function signatureSrc(reference: string | null): string | null {
  const value = reference?.trim();
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  if (value.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(value)) return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  return null;
}

export async function getMemoSteps(workflowId: string): Promise<ApprovalStep[]> {
  const body = await apiClient<unknown>(`api/memo-approval-route/workflows/${workflowId}/get-memoapprovals-steps`, {
    ...auth(),
  });

  return readList(body)
    .map((row, index): ApprovalStep | null => {
      const id = readString(row, "id");
      const sequence = readNumber(row, "sequence") ?? index + 1;
      const role = readString(row, "approverRole");

      return id
        ? {
            id,
            sequence,
            approverUserId: readString(row, "approverUserId") ?? "",
            approverName: readString(row, "approverName") ?? `Approver ${sequence}`,
            approverRole: role ? formatRoleName(role) : "",
            status: toStepStatus(readString(row, "status")),
            decidedAt: readString(row, "respondedAt"),
            comment: readString(row, "comment"),
            signatureImage: signatureSrc(readString(row, "signatureReference")),
          }
        : null;
    })
    .filter((step): step is ApprovalStep => step !== null)
    .sort((a, b) => a.sequence - b.sequence);
}

export async function listMyMemoApprovals(): Promise<MemoPendingApproval[]> {
  const body = await apiClient<unknown>("api/memo-approval-route/my-pending-approvals", { ...auth() });

  return readList(body)
    .map((row): MemoPendingApproval | null => {
      const workflowId = readString(row, "workflowId");
      const memoId = readString(row, "memoId");
      const stepId = readString(row, "approvalStepId");
      const role = readString(row, "approverRole");

      return workflowId && memoId && stepId
        ? {
            workflowId,
            memoId,
            stepId,
            memoNumber: readString(row, "memoNumber") ?? "",
            subject: readString(row, "subject") ?? "",
            from: readString(row, "from") ?? "",
            memoVersion: readNumber(row, "memoVersion") ?? 1,
            sequence: readNumber(row, "sequence") ?? 1,
            approverRole: role ? formatRoleName(role) : "",
            assignedAt: readString(row, "assignedAt"),
          }
        : null;
    })
    .filter((item): item is MemoPendingApproval => item !== null);
}

// The signature as plain base64, without the "data:image/png;base64," prefix.
function toBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return dataUrl.startsWith("data:") && comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function signMemo(item: MemoPendingApproval, signatureDataUrl: string, comment: string): Promise<void> {
  await apiClient<unknown>(
    `api/memo-approval-route/workflows/${item.workflowId}/steps/${item.stepId}/approve-and-sign`,
    {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ signatureBase64: toBase64(signatureDataUrl), comment: comment.trim() || null }),
    },
  );
}

export async function rejectMemo(item: MemoPendingApproval, comment: string): Promise<void> {
  await apiClient<unknown>(
    `api/memo-approval-route/workflows/${item.workflowId}/steps/${item.stepId}/reject-workflow-approvals`,
    { method: "POST", ...auth(), body: JSON.stringify({ comment }) },
  );
}

// After a rejection at sign-off, the author sends it round again.
export async function resubmitMemoSignOff(
  workflowId: string,
  resubmissionMode: MemoResubmissionMode,
  revisionComment: string,
): Promise<void> {
  await apiClient<unknown>(`api/memo-approval-route/workflows/${workflowId}/resubmit-memoapprovals`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ resubmissionMode, revisionComment }),
  });
}

// ---------------------------------------------------------------------------
// PDFs

export function fetchMemoPreviewPdf(memoId: string): Promise<Blob> {
  return fetchPdfBlob(`api/memo-pdf/${memoId}/preview`);
}

type SigningStep = Pick<MemoPendingApproval, "memoId" | "workflowId" | "sequence">;

// What an approver reads before signing: the first approver reads the memo
// itself; everyone after them reads it with the signatures so far.
export function fetchMemoPdfToSign(item: SigningStep): Promise<Blob> {
  return item.sequence === 1
    ? fetchMemoPreviewPdf(item.memoId)
    : fetchPdfBlob(`api/memo-pdf/${item.workflowId}/approval-review-pdf`);
}

// What an approver sees once they've signed: the review PDF, with every
// signature so far, theirs included. (submitted-pdf would be the first
// approver's, but it still returns the memo without signatures: gaps M40.)
export function fetchMemoPdfSigned(item: SigningStep): Promise<Blob> {
  return fetchPdfBlob(`api/memo-pdf/${item.workflowId}/approval-review-pdf`);
}

export function fetchFinalMemoPdf(workflowId: string): Promise<Blob> {
  return fetchPdfBlob(`api/memo-pdf/workflows/${workflowId}/final-memo-pdf`);
}

// The memo as it stands for its author, with every signature so far:
//   nobody has signed yet       the memo itself (preview)
//   one or more approvers       approval-review-pdf
//   everyone                    final-memo-pdf
// (submitted-pdf, meant for after the first signature, still returns the
// memo without it: gaps M40.)
export function fetchMemoPdfForAuthor(
  memoId: string,
  workflowId: string | null,
  signedCount: number,
  fullySigned: boolean,
): Promise<Blob> {
  if (!workflowId) return fetchMemoPreviewPdf(memoId);
  if (fullySigned) return fetchFinalMemoPdf(workflowId);
  if (signedCount >= 1) return fetchPdfBlob(`api/memo-pdf/${workflowId}/approval-review-pdf`);
  return fetchMemoPreviewPdf(memoId);
}

// ---------------------------------------------------------------------------
// Display

const STATUS_TEXT: Record<string, string> = {
  [MEMO_STATUS.draft]: "Draft",
  [MEMO_STATUS.inReview]: "In review",
  [MEMO_STATUS.reviewDeclined]: "Changes requested",
  [MEMO_STATUS.reviewRejected]: "Rejected in review",
  [MEMO_STATUS.reviewed]: "Ready for sign-off",
  [MEMO_STATUS.withGroupHead]: "With Group Head",
  [MEMO_STATUS.changesRequested]: "Changes requested",
  [MEMO_STATUS.readyForApproval]: "Ready for sign-off",
  [MEMO_STATUS.inApproval]: "Out for sign-off",
  [MEMO_STATUS.approved]: "Fully signed",
};

// "In review", "Out for sign-off"… An unknown status shows as its own
// words ("RejectedInApproval" → "Rejected in approval").
export function memoStatusText(status: MemoStatus): string {
  if (STATUS_TEXT[status]) {
    return STATUS_TEXT[status];
  }

  const words = status.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function memoStatusClass(status: MemoStatus): string {
  if (status === MEMO_STATUS.draft) return "status-badge status-badge--brd-drafting";
  if (status === MEMO_STATUS.approved) return "status-badge status-badge--approved";
  if (status === MEMO_STATUS.reviewed) return "status-badge status-badge--approved";
  if (
    status === MEMO_STATUS.reviewDeclined ||
    status === MEMO_STATUS.reviewRejected ||
    status === MEMO_STATUS.changesRequested ||
    isRejectedAtSignOff(status)
  ) {
    return "status-badge status-badge--bdo-documentation-rejected";
  }
  return "status-badge status-badge--brd-under-review";
}

export function isMine(memo: { createdByUserId: string }): boolean {
  const myId = getCurrentUserId();
  return Boolean(myId) && memo.createdByUserId === myId;
}

export const memoKeys = {
  all: ["memos"] as const,
  list: ["memos", "list"] as const,
  pending: ["memos", "pending"] as const,
  assigned: ["memos", "assigned"] as const,
  one: (memoId: string) => ["memos", "one", memoId] as const,
  versions: (memoId: string) => ["memos", "versions", memoId] as const,
  steps: (workflowId: string) => ["memos", "steps", workflowId] as const,
};
