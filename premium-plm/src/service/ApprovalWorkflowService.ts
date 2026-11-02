// Document sign-off workflows (after the Group Head's approval).
//
// Real endpoints (DocumentApprovalWorkflow and Pdf in Swagger):
//   POST api/document-approval-workflows/configure-workflow          PM picks the approvers
//   POST api/document-approval-workflows/{workflowId}/submit-workflow  PM sends it to the first
//   GET  api/document-approval-workflows/my-pending-workflow         what's waiting on me
//   GET  api/document-approval-workflows/list-all-workflows          every workflow, filterable
//   POST api/document-approval-workflows/{workflowId}/steps/{stepId}/sign-and-approve
//   POST api/document-approval-workflows/{workflowId}/steps/{stepId}/reject-approval
//   GET  {workflowId}/submitted-pdf-for-approval    1st approver, before signing
//   GET  {workflowId}/get-approval-review-pdf       every approver after signing, and later approvers before
//   GET  {workflowId}/final-signed-pdf              PM / Group Head, fully signed
//
//   GET  api/document-approval-workflows/{workflowId}/sign-offs      each approver on a workflow
//   GET  api/document-approval-workflows/{workflowId}/steps/{stepId}/signature-image
//   GET  api/document-approval-workflows/historical-approval         my past decisions
//
// Workflows set up through this app are also recorded locally, for the
// activity log.

import { API_BASE_URL, apiClient } from "../apicalls/apiClient";
import { getCurrentUserId, getStoredUser, getToken } from "../apicalls/authStorage";
import { hasRole } from "../utils/roleRouting";
import { DOCUMENT_TYPES } from "../types/documentTypes";
import type { DocumentSignOff, DocumentType, ProductDocument } from "../types/documentTypes";
import type {
  ApprovalStep,
  ApprovalStepStatus,
  ApprovalHistoryItem,
  ApprovalWorkflow,
  ApproverInput,
  ApprovalWorkflowStatus,
  PendingApproval,
  WorkflowFilters,
  WorkflowPage,
  WorkflowSummary,
} from "../types/approvalTypes";
import {
  isRecord,
  readArray,
  readCreatedId,
  readList,
  readNumber,
  readRecord,
  readString,
  statusKey,
  unwrapData,
} from "../utils/apiShape";
import type { ApiRecord } from "../utils/apiShape";
import { makeLocalId, readRow, updateRow, writeRow } from "../mocks/localStore";
import { fetchPdfBlob } from "./PdfService";
import { initiativeOf, linkToInitiative, recordActivity } from "./ActivityService";
import { getAllUsers } from "./UserService";
import { formatPersonName, formatRoleName, toApiRoleName } from "../utils/text";

const WORKFLOWS = "approval-workflows";

function auth() {
  return { token: getToken() ?? undefined };
}

function nowIso() {
  return new Date().toISOString();
}

// The API's ApprovalStepStatus: Pending (not their turn yet), AwaitingAction
// (their turn), Approved, Rejected, Skipped.
function toStepStatus(value: unknown): ApprovalStepStatus | null {
  const key = statusKey(value);

  if (key === "awaitingaction") return "Pending";
  if (key === "approved") return "Signed";
  if (key === "rejected") return "Rejected";
  if (key === "pending" || key === "skipped") return "Waiting";

  return null;
}

function toDocumentType(value: unknown): DocumentType | null {
  if (typeof value === "number") {
    // The API's DocumentType enum order.
    return (["BRD", "FRD", "PID", "SWR"] as DocumentType[])[value] ?? null;
  }

  const upper = String(value ?? "").toUpperCase();
  return (DOCUMENT_TYPES as string[]).includes(upper) ? (upper as DocumentType) : null;
}

// The data URL without its "data:image/png;base64," prefix — the DTO asks
// for base64 (gaps file R15 asks the backend to confirm which it expects).
function toBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return dataUrl.startsWith("data:") && comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

// The initiative and document a workflow is for, for the activity log.
function workflowContext(workflowId: string): { initiativeId: string | null; document: string } {
  const workflow = getLocalWorkflow(workflowId);

  return {
    initiativeId: workflow?.initiativeId ?? initiativeOf("workflow", workflowId),
    document: workflow?.documentType ?? "document",
  };
}

// ---------------------------------------------------------------------------
// The local record (M13–M15 stand-in)

function saveWorkflow(workflow: ApprovalWorkflow) {
  writeRow(WORKFLOWS, workflow.id, workflow);
}

function changeWorkflow(workflowId: string, change: (workflow: ApprovalWorkflow) => ApprovalWorkflow) {
  updateRow<ApprovalWorkflow>(WORKFLOWS, workflowId, change);
}

// ---------------------------------------------------------------------------
// Workflow list (list-all-workflows)

function toWorkflowStatus(value: unknown): ApprovalWorkflowStatus {
  switch (statusKey(value)) {
    case "approved":
      return "Approved";
    case "rejected":
    case "cancelled":
      return "Rejected";
    case "draft":
    case "preparingsubmission":
      return "Draft";
    default:
      // PendingApproval, InProgress
      return "InProgress";
  }
}

function toWorkflowSummary(record: ApiRecord): WorkflowSummary | null {
  const id = readString(record, "workflowId", "id");
  const documentId = readString(record, "documentProductId");

  if (!id || !documentId) {
    return null;
  }

  return {
    id,
    documentId,
    documentType: toDocumentType(record.documentType),
    initiativeId: readString(record, "productInitiativeId") ?? "",
    initiativeName: readString(record, "initiativeName"),
    status: toWorkflowStatus(record.status),
    apiStatus: readString(record, "status") ?? "",
    documentVersion: readNumber(record, "documentVersion"),
    createdByUserId: readString(record, "projectManagerId") ?? "",
    createdAt: readString(record, "createdAt") ?? "",
    submittedAt: readString(record, "submittedAt"),
    completedAt: readString(record, "completedAt"),
    totalSteps: readNumber(record, "totalSteps") ?? 0,
    signedSteps: readNumber(record, "approvedSteps") ?? 0,
    currentSequence: readNumber(record, "currentSequence"),
    currentApproverUserId: readString(record, "currentApproverUserId"),
    currentApproverRole: readString(record, "currentApproverRole"),
  };
}

// The same list asked for twice on one page (a document's status and its
// sign-off panel) is requested once.
const recentLists = new Map<string, { at: number; result: Promise<WorkflowSummary[]> }>();
const LIST_REUSE_MS = 5000;

// list-all-workflows is for the Product Manager and the Group Head only.
// Nobody else calls it (it would only be refused), so their pages make no
// request and show what they can without it.
export function canListWorkflows(): boolean {
  const roles = getStoredUser()?.roles ?? [];
  return hasRole(roles, "ProjectManager") || hasRole(roles, "GroupHead");
}

// Every workflow matching the filters, newest first (all pages).
export function listWorkflows(
  filters: { initiativeId?: string; documentType?: DocumentType } = {},
): Promise<WorkflowSummary[]> {
  if (!canListWorkflows()) {
    return Promise.resolve([]);
  }

  const key = `${filters.initiativeId ?? ""}:${filters.documentType ?? ""}`;
  const recent = recentLists.get(key);

  if (recent && Date.now() - recent.at < LIST_REUSE_MS) {
    return recent.result;
  }

  const result = fetchWorkflowList(filters);
  recentLists.set(key, { at: Date.now(), result });
  result.catch(() => recentLists.delete(key));
  return result;
}

async function fetchWorkflowList(filters: { initiativeId?: string; documentType?: DocumentType }): Promise<WorkflowSummary[]> {
  const workflows: WorkflowSummary[] = [];

  for (let page = 1; page <= 50; page += 1) {
    const params = new URLSearchParams({ PageNumber: String(page), PageSize: "100" });

    if (filters.initiativeId) params.set("InitiativeId", filters.initiativeId);
    if (filters.documentType) params.set("DocumentType", filters.documentType);

    const body = await apiClient<unknown>(`api/document-approval-workflows/list-all-workflows?${params}`, {
      method: "GET",
      ...auth(),
    });
    const data = unwrapData(body);
    const rows = isRecord(data) ? (readArray(data, "workflows", "items") ?? []) : [];

    workflows.push(...rows.map(toWorkflowSummary).filter((row): row is WorkflowSummary => row !== null));

    if (!isRecord(data) || data.hasNextPage !== true) {
      break;
    }
  }

  return workflows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// One page of workflows, filtered by the server, for the Sign-offs page.
export async function getWorkflowPage(
  filters: WorkflowFilters,
  pageNumber: number,
  pageSize = 20,
): Promise<WorkflowPage> {
  const params = new URLSearchParams({ PageNumber: String(pageNumber), PageSize: String(pageSize) });

  if (filters.status) params.set("Status", filters.status);
  if (filters.documentType) params.set("DocumentType", filters.documentType);
  if (filters.initiativeId) params.set("InitiativeId", filters.initiativeId);
  // Whole days: from the start of the first to the end of the last.
  if (filters.fromDate) params.set("FromDate", `${filters.fromDate}T00:00:00`);
  if (filters.toDate) params.set("ToDate", `${filters.toDate}T23:59:59`);

  const body = await apiClient<unknown>(`api/document-approval-workflows/list-all-workflows?${params}`, {
    method: "GET",
    ...auth(),
  });
  const data = unwrapData(body);
  const page: ApiRecord = isRecord(data) ? data : {};
  const rows = (readArray(page, "workflows", "items") ?? [])
    .map(toWorkflowSummary)
    .filter((row): row is WorkflowSummary => row !== null);

  const workflows = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      currentApproverName: row.status === "InProgress" ? await currentApproverName(row) : null,
    })),
  );

  return {
    workflows,
    pageNumber: readNumber(page, "pageNumber") ?? pageNumber,
    totalPages: readNumber(page, "totalPages") ?? 1,
    totalCount: readNumber(page, "totalCount") ?? workflows.length,
    hasPreviousPage: page.hasPreviousPage === true,
    hasNextPage: page.hasNextPage === true,
  };
}

// User id → full name, read once per session. Empty for roles the API
// refuses the user list to (gaps file R7); they see the approver's title.
let userNames: Promise<Map<string, string>> | null = null;

function approverNames(): Promise<Map<string, string>> {
  userNames ??= getAllUsers()
    .then((users) => new Map(users.map((user) => [user.userId, formatPersonName(user)])))
    .catch(() => {
      userNames = null;
      return new Map<string, string>();
    });

  return userNames;
}

// The full name of the approver whose turn it is, if known.
async function currentApproverName(summary: WorkflowSummary): Promise<string | null> {
  if (!summary.currentApproverUserId) {
    return null;
  }

  const fromList = (await approverNames()).get(summary.currentApproverUserId);
  const fromLocal = getLocalWorkflow(summary.id)?.steps.find(
    (step) => step.approverUserId === summary.currentApproverUserId,
  )?.approverName;

  return fromList ?? fromLocal ?? null;
}

// Where each document's newest sign-off stands, by document id, for the
// "With Naomi Okafor (Risk Officer)" status. One request per initiative.
// Without an initiative, covers every initiative in one list request.
export async function getSignOffs(
  initiativeId?: string,
  documentType?: DocumentType,
): Promise<Map<string, DocumentSignOff>> {
  const workflows = await listWorkflows({ initiativeId, documentType });
  const newest = new Map<string, WorkflowSummary>();

  workflows.forEach((workflow) => {
    if (!newest.has(workflow.documentId)) {
      newest.set(workflow.documentId, workflow);
    }
  });

  const entries = await Promise.all(
    [...newest.values()]
      .filter((workflow) => workflow.status === "InProgress" || workflow.status === "Approved")
      .map(async (workflow): Promise<[string, DocumentSignOff]> => [
        workflow.documentId,
        {
          complete: workflow.status === "Approved",
          approverName: workflow.status === "InProgress" ? await currentApproverName(workflow) : null,
          approverRole:
            workflow.status === "InProgress" && workflow.currentApproverRole
              ? formatRoleName(workflow.currentApproverRole)
              : null,
        },
      ]),
  );

  return new Map(entries);
}

// Each approver on a workflow, in signing order: name, title, status, date
// and comment (GET {workflowId}/sign-offs).
export async function getWorkflowSteps(workflowId: string): Promise<ApprovalStep[]> {
  const body = await apiClient<unknown>(`api/document-approval-workflows/${workflowId}/sign-offs`, {
    method: "GET",
    ...auth(),
  });
  const rows = readList(body, ["signOffs", "steps", "items"]);
  const names = await approverNames();

  return rows
    .map((row): ApprovalStep | null => {
      const id = readString(row, "stepId", "id");
      const userId = readString(row, "approverUserId") ?? "";
      const sequence = readNumber(row, "sequence") ?? 0;
      const role = readString(row, "approverRole");

      return id
        ? {
            id,
            sequence,
            approverUserId: userId,
            approverName: readString(row, "approverName") ?? names.get(userId) ?? `Approver ${sequence}`,
            approverRole: role ? formatRoleName(role) : "",
            status: toStepStatus(row.status) ?? "Waiting",
            decidedAt: readString(row, "approvedAt", "respondedAt"),
            comment: readString(row, "comment"),
            // Fetched per step when shown (fetchSignatureImage).
            signatureImage: null,
          }
        : null;
    })
    .filter((step): step is ApprovalStep => step !== null)
    .sort((a, b) => a.sequence - b.sequence);
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// A signed step's signature as a data URL, or null if there isn't one.
// The endpoint needs the user's token, so it can't be a plain <img src>.
export async function fetchSignatureImage(workflowId: string, stepId: string): Promise<string | null> {
  const token = getToken();
  const response = await fetch(
    `${API_BASE_URL}api/document-approval-workflows/${workflowId}/steps/${stepId}/signature-image`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );

  if (response.status === 404 || response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`signature-image returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  // An image file…
  if (contentType.startsWith("image/")) {
    return blobToDataUrl(await response.blob());
  }

  // …or base64 text, on its own or inside the usual JSON envelope.
  const text = (await response.text()).trim();
  let value: string | null = text;

  if (contentType.includes("json")) {
    const data = unwrapData(JSON.parse(text) as unknown);
    value =
      typeof data === "string"
        ? data
        : isRecord(data)
          ? readString(data, "signatureImageBase64", "imageBase64", "base64", "signatureImage", "image")
          : null;
  }

  if (!value) {
    return null;
  }

  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

// A step's status from the workflow's progress: everyone before the
// current approver has signed.
function stepStatusFrom(summary: WorkflowSummary, sequence: number): ApprovalStepStatus {
  if (summary.status === "Approved" || sequence <= summary.signedSteps) {
    return "Signed";
  }

  if (summary.status === "Rejected") {
    return sequence === summary.signedSteps + 1 ? "Rejected" : "Waiting";
  }

  return summary.status === "InProgress" && sequence === (summary.currentSequence ?? summary.signedSteps + 1)
    ? "Pending"
    : "Waiting";
}

// The document's newest workflow, one card per approver. The number of
// approvers and where it stands come from list-all-workflows; each
// approver's name, title, date and comment from sign-offs. If sign-offs
// leaves a step out (or fails), that step still shows, with the name from
// the user list or the record kept when the PM set it up.
export async function getWorkflowForDocument(document: ProductDocument): Promise<ApprovalWorkflow | null> {
  const summary = (await listWorkflows({ initiativeId: document.initiativeId, documentType: document.type })).find(
    (workflow) => workflow.documentId === document.id,
  );

  if (!summary) {
    return null;
  }

  const [apiSteps, currentName] = await Promise.all([
    getWorkflowSteps(summary.id).catch((error: unknown) => {
      console.error(error);
      return [] as ApprovalStep[];
    }),
    currentApproverName(summary),
  ]);
  const local = getLocalWorkflow(summary.id);
  const total = Math.max(summary.totalSteps, apiSteps.length, local?.steps.length ?? 0);

  const steps: ApprovalStep[] = Array.from({ length: total }, (_, index) => {
    const sequence = index + 1;
    const apiStep = apiSteps.find((step) => step.sequence === sequence);
    const localStep = local?.steps.find((step) => step.sequence === sequence);
    const isCurrent = sequence === summary.currentSequence;
    const status = stepStatusFrom(summary, sequence);

    if (apiStep) {
      // Where the API's step status and the workflow's progress differ, the
      // furthest along wins (a step can be signed before the list catches up).
      return { ...apiStep, status: apiStep.status === "Waiting" ? status : apiStep.status };
    }

    return {
      id: localStep?.id ?? `${summary.id}:${sequence}`,
      sequence,
      approverUserId: localStep?.approverUserId ?? (isCurrent ? (summary.currentApproverUserId ?? "") : ""),
      approverName: localStep?.approverName ?? (isCurrent && currentName ? currentName : `Approver ${sequence}`),
      approverRole:
        localStep?.approverRole ??
        (isCurrent && summary.currentApproverRole ? formatRoleName(summary.currentApproverRole) : ""),
      status,
      decidedAt: localStep?.decidedAt ?? null,
      comment: localStep?.comment ?? null,
      signatureImage: null,
    };
  });

  return {
    id: summary.id,
    documentId: summary.documentId,
    documentType: summary.documentType ?? document.type,
    initiativeId: summary.initiativeId || document.initiativeId,
    initiativeName: summary.initiativeName ?? local?.initiativeName ?? "",
    status: summary.status,
    steps,
    createdByUserId: summary.createdByUserId,
    createdAt: summary.createdAt,
    submittedAt: summary.submittedAt,
  };
}

export function getLocalWorkflow(workflowId: string): ApprovalWorkflow | null {
  return readRow<ApprovalWorkflow>(WORKFLOWS, workflowId);
}

// The signed-in approver's past decisions (historical-approval), newest
// first. The rows don't say which document or initiative (gaps file M15).
export async function getMyApprovalHistory(): Promise<ApprovalHistoryItem[]> {
  const body = await apiClient<unknown>("api/document-approval-workflows/historical-approval", {
    method: "GET",
    ...auth(),
  });
  const rows = readList(body, ["approvals", "history", "items"])
    .map((row) => ({ row, status: toStepStatus(row.status) }))
    .filter(({ status }) => status === "Signed" || status === "Rejected");

  return rows
    .map(({ row, status }): ApprovalHistoryItem | null => {
      const workflowId = readString(row, "workflowId");
      const stepId = readString(row, "stepId", "id");
      const role = readString(row, "approverRole");

      return workflowId && stepId
        ? {
            workflowId,
            stepId,
            documentId: readString(row, "documentProductId"),
            documentType: toDocumentType(row.documentType),
            documentVersion: readNumber(row, "documentVersion"),
            initiativeName: readString(row, "initiativeName", "projectName"),
            sequence: readNumber(row, "sequence"),
            approverRole: role ? formatRoleName(role) : null,
            status: status === "Signed" ? "Signed" : "Rejected",
            decidedAt: readString(row, "respondedAt"),
            comment: readString(row, "comment"),
          }
        : null;
    })
    .filter((item): item is ApprovalHistoryItem => item !== null)
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
}

// ---------------------------------------------------------------------------
// PM: set up and send

// Configures the approvers, in order, then sends the document to the first.
export async function setUpWorkflow(
  document: ProductDocument,
  initiativeName: string,
  approvers: ApproverInput[],
): Promise<ApprovalWorkflow> {
  const body = await apiClient<unknown>("api/document-approval-workflows/configure-workflow", {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      documentProductId: document.id,
      approvers: approvers.map((approver, index) => ({
        approverUserId: approver.userId,
        // The API's role name ("RiskOfficer"), not the label shown on screen.
        approverRole: toApiRoleName(approver.role),
        // 1 for the first to sign, 2 for the next, and so on.
        sequence: index + 1,
      })),
    }),
  });

  const data = unwrapData(body);
  const workflowId = readCreatedId(body, "workflowId", "documentApprovalWorkflowId");

  if (!workflowId) {
    throw new Error(
      "The approvers were saved, but the server didn't return the workflow's id, so it can't be sent. Check with the backend before trying again.",
    );
  }

  // Step ids, if the response includes the steps (matched by sequence).
  const apiSteps = isRecord(data) ? (readArray(data, "steps", "approvalSteps", "approvers") ?? []) : [];

  const workflow: ApprovalWorkflow = {
    id: workflowId,
    documentId: document.id,
    documentType: document.type,
    initiativeId: document.initiativeId,
    initiativeName,
    status: "Draft",
    createdByUserId: getCurrentUserId() ?? "",
    createdAt: nowIso(),
    submittedAt: null,
    steps: approvers.map((approver, index) => {
      const apiStep = apiSteps.find((step) => readNumber(step, "sequence", "order") === index + 1);

      return {
        id: readString(apiStep, "id", "stepId") ?? makeLocalId("step"),
        sequence: index + 1,
        approverUserId: approver.userId,
        approverName: approver.name,
        approverRole: approver.role,
        status: "Waiting",
        decidedAt: null,
        comment: null,
        signatureImage: null,
      };
    }),
  };

  saveWorkflow(workflow);
  await sendWorkflow(workflowId);
  return getLocalWorkflow(workflowId) ?? workflow;
}

// Sends a configured workflow to its first approver. Separate so it can be
// retried if configuring worked but sending didn't.
export async function sendWorkflow(workflowId: string): Promise<void> {
  recentLists.clear();
  await apiClient<unknown>(`api/document-approval-workflows/${workflowId}/submit-workflow`, {
    method: "POST",
    ...auth(),
  });

  changeWorkflow(workflowId, (workflow) => ({
    ...workflow,
    status: "InProgress",
    submittedAt: nowIso(),
    steps: workflow.steps.map((step, index) => (index === 0 ? { ...step, status: "Pending" } : step)),
  }));

  const context = workflowContext(workflowId);
  const approvers = getLocalWorkflow(workflowId)?.steps.map((step) => `${step.approverName} (${step.approverRole})`) ?? [];
  recordActivity({
    initiativeId: context.initiativeId,
    area: "Sign-off",
    action: `sent the ${context.document} for sign-off`,
    detail: approvers.length > 0 ? `In order: ${approvers.join(", ")}` : null,
    tone: "warning",
  });
}

// ---------------------------------------------------------------------------
// Approvers

// my-pending-workflow may list steps, or workflows that contain steps.
function toPendingApprovals(record: ApiRecord, myId: string | null): PendingApproval[] {
  const nestedWorkflow = readRecord(record, "workflow", "documentApprovalWorkflow");
  const nestedDocument = readRecord(record, "document", "productDocument");
  const steps = readArray(record, "steps", "approvalSteps", "approvers");

  function describe(workflowId: string, stepId: string, step: ApiRecord | null): PendingApproval {
    const local = getLocalWorkflow(workflowId);
    const source = [step, record, nestedWorkflow, nestedDocument];
    const read = (...keys: string[]) => source.map((item) => readString(item, ...keys)).find(Boolean) ?? null;

    linkToInitiative("workflow", workflowId, read("productInitiativeId", "initiativeId") ?? local?.initiativeId);

    return {
      workflowId,
      stepId,
      documentId: read("documentProductId", "productDocumentId", "documentId") ?? local?.documentId ?? null,
      documentType: toDocumentType(read("documentType")) ?? local?.documentType ?? null,
      initiativeId: read("productInitiativeId", "initiativeId") ?? local?.initiativeId ?? null,
      initiativeName: read("projectName", "initiativeName", "productInitiativeName") ?? local?.initiativeName ?? null,
      approverRole: read("approverRole") ?? local?.steps.find((item) => item.id === stepId)?.approverRole ?? null,
      sequence: readNumber(step ?? record, "sequence", "order"),
      totalSteps: steps?.length ?? local?.steps.length ?? null,
      sentAt: read("submittedAt", "sentAt", "assignedAt", "createdAt"),
    };
  }

  if (steps) {
    const workflowId = readString(record, "workflowId", "id");

    if (!workflowId) {
      return [];
    }

    const mine = steps.filter((step) => !myId || readString(step, "approverUserId", "userId") === myId);
    const current = mine.filter((step) => toStepStatus(step.status) === "Pending");

    return (current.length ? current : mine.slice(0, 1))
      .map((step) => readString(step, "id", "stepId"))
      .filter((stepId): stepId is string => Boolean(stepId))
      .map((stepId) => describe(workflowId, stepId, steps.find((step) => readString(step, "id", "stepId") === stepId) ?? null));
  }

  const workflowId =
    readString(record, "workflowId", "documentApprovalWorkflowId") ?? readString(nestedWorkflow, "id");
  const stepId = readString(record, "stepId", "id");

  return workflowId && stepId ? [describe(workflowId, stepId, null)] : [];
}

// What's waiting on the signed-in user, from the API only: it returns the
// real workflowId and stepId that sign-and-approve needs.
export async function getMyPendingApprovals(): Promise<PendingApproval[]> {
  const myId = getCurrentUserId();
  const body = await apiClient<unknown>("api/document-approval-workflows/my-pending-workflow", {
    method: "GET",
    ...auth(),
  });
  // A list, a list under a key, or a single workflow/step.
  const data = unwrapData(body);
  let records = readList(body, ["workflows", "pendingWorkflows", "items", "results"]);

  if (records.length === 0 && isRecord(data)) {
    records = [data];
  }

  const pending = records.flatMap((record) => toPendingApprovals(record, myId));
  pending.forEach(syncLocalStepId);
  return pending;
}

// configure-workflow doesn't return step ids (gaps file R14), so the local
// record may hold stand-in ids. The API's real id replaces it, matched by
// position in the order, so signing updates the right step locally.
function syncLocalStepId(item: PendingApproval) {
  const local = getLocalWorkflow(item.workflowId);
  const step = local?.steps.find((candidate) => candidate.sequence === item.sequence);

  if (step && step.id !== item.stepId) {
    changeWorkflow(item.workflowId, (workflow) => ({
      ...workflow,
      steps: workflow.steps.map((candidate) =>
        candidate.sequence === item.sequence ? { ...candidate, id: item.stepId } : candidate,
      ),
    }));
  }
}

export async function signAndApprove(
  workflowId: string,
  stepId: string,
  signatureDataUrl: string,
  comment: string,
): Promise<void> {
  await apiClient<unknown>(`api/document-approval-workflows/${workflowId}/steps/${stepId}/sign-and-approve`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ signatureImageBase64: toBase64(signatureDataUrl), comment: comment || null }),
  });
  recentLists.clear();

  changeWorkflow(workflowId, (workflow) => {
    const signedAt = nowIso();
    const signedIndex = workflow.steps.findIndex((step) => step.id === stepId);
    const steps = workflow.steps.map((step, index): ApprovalStep => {
      if (index === signedIndex) {
        return { ...step, status: "Signed", decidedAt: signedAt, comment: comment || null, signatureImage: signatureDataUrl };
      }

      return index === signedIndex + 1 ? { ...step, status: "Pending" } : step;
    });

    return { ...workflow, steps, status: steps.every((step) => step.status === "Signed") ? "Approved" : "InProgress" };
  });

  const context = workflowContext(workflowId);
  const fullySigned = getLocalWorkflow(workflowId)?.status === "Approved";
  recordActivity({
    initiativeId: context.initiativeId,
    area: "Sign-off",
    action: fullySigned ? `signed the ${context.document}, completing its sign-off` : `signed the ${context.document}`,
    detail: comment,
    tone: "success",
  });
}

export async function rejectApproval(workflowId: string, stepId: string, comment: string): Promise<void> {
  await apiClient<unknown>(`api/document-approval-workflows/${workflowId}/steps/${stepId}/reject-approval`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ comment }),
  });
  recentLists.clear();

  changeWorkflow(workflowId, (workflow) => ({
    ...workflow,
    status: "Rejected",
    steps: workflow.steps.map((step) =>
      step.id === stepId ? { ...step, status: "Rejected", decidedAt: nowIso(), comment } : step,
    ),
  }));

  const context = workflowContext(workflowId);
  recordActivity({
    initiativeId: context.initiativeId,
    area: "Sign-off",
    action: `rejected the ${context.document} at sign-off`,
    detail: comment,
    tone: "danger",
  });
}

// ---------------------------------------------------------------------------
// PDFs (built by the backend, with the approvers' names and signatures)

// The PDF an approver reads before signing: the first approver gets the
// document as sent for sign-off; later approvers get it with the signatures
// so far.
export function fetchPdfToSign(item: Pick<PendingApproval, "workflowId" | "sequence">): Promise<Blob> {
  return item.sequence === 1 ? fetchSubmittedPdf(item.workflowId) : fetchReviewPdf(item.workflowId);
}

// The document as sent for sign-off — only for the first approver, before
// signing.
function fetchSubmittedPdf(workflowId: string): Promise<Blob> {
  return fetchPdfBlob(`${workflowId}/submitted-pdf-for-approval`);
}

// With the signatures so far: what every approver sees after signing, and
// what later approvers read before signing.
export function fetchReviewPdf(workflowId: string): Promise<Blob> {
  return fetchPdfBlob(`${workflowId}/get-approval-review-pdf`);
}

// Signed by everyone, for the Product Manager and Group Head.
export function fetchFinalSignedPdf(workflowId: string): Promise<Blob> {
  return fetchPdfBlob(`${workflowId}/final-signed-pdf`);
}

// Query keys shared by every page that shows workflows.
export const approvalKeys = {
  all: ["approval-workflows"] as const,
  forDocument: (documentId: string | null | undefined) => ["approval-workflows", "document", documentId] as const,
  pending: ["approval-workflows", "my-pending"] as const,
  history: ["approval-workflows", "my-history"] as const,
  signature: (workflowId: string, stepId: string) => ["approval-workflows", "signature", workflowId, stepId] as const,
  page: (filters: WorkflowFilters, pageNumber: number) => ["approval-workflows", "page", filters, pageNumber] as const,
};
