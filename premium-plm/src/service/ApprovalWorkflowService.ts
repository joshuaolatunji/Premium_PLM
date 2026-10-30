// Document sign-off workflows (after the Group Head's approval).
//
// Real endpoints (DocumentApprovalWorkflow and Pdf in Swagger):
//   POST api/document-approval-workflows/configure-workflow          PM picks the approvers
//   POST api/document-approval-workflows/{workflowId}/submit-workflow  PM sends it to the first
//   GET  api/document-approval-workflows/my-pending-workflow         what's waiting on me
//   POST api/document-approval-workflows/{workflowId}/steps/{stepId}/sign-and-approve
//   POST api/document-approval-workflows/{workflowId}/steps/{stepId}/reject-approval
//   GET  {documentId}/preview-generated-pdf         1st approver, before signing
//   GET  {workflowId}/submitted-pdf-for-approval    an approver, after signing
//   GET  {workflowId}/get-approval-review-pdf       later approvers, before signing
//   GET  {workflowId}/final-signed-pdf              PM / Group Head, fully signed
//
// Missing (simulated in the browser — see the gaps file): reading a
// document's workflow and its progress (M13), every workflow for oversight
// (M14) and an approver's past sign-offs (M15). Each workflow set up through
// this app is recorded locally and kept up to date as people sign, so the
// PM's progress view and the Executive Director's dashboard have data.

import { apiClient } from "../apicalls/apiClient";
import { getCurrentUserId, getToken } from "../apicalls/authStorage";
import { DOCUMENT_TYPES } from "../types/documentTypes";
import type { DocumentSignOff, DocumentType, ProductDocument } from "../types/documentTypes";
import type {
  ApprovalStep,
  ApprovalStepStatus,
  ApprovalWorkflow,
  ApproverInput,
  PendingApproval,
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
import { listRows, makeLocalId, readRow, simulateLatency, updateRow, writeRow } from "../mocks/localStore";
import { fetchPdfBlob } from "./PdfService";
import { initiativeOf, linkToInitiative, recordActivity } from "./ActivityService";
import { toApiRoleName } from "../utils/text";

const WORKFLOWS = "approval-workflows";

function auth() {
  return { token: getToken() ?? undefined };
}

function nowIso() {
  return new Date().toISOString();
}

function toStepStatus(value: unknown): ApprovalStepStatus | null {
  const key = statusKey(value);

  if (["pending", "awaiting", "awaitingapproval", "current", "inreview", "inprogress", "active"].includes(key)) {
    return "Pending";
  }
  if (["approved", "signed", "completed", "done"].includes(key)) return "Signed";
  if (["rejected", "declined"].includes(key)) return "Rejected";
  if (["waiting", "notstarted", "queued", "draft"].includes(key)) return "Waiting";

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

// The newest workflow for a document (a rejected one is replaced when the PM
// sets it up again).
function newestWorkflowFor(documentId: string): ApprovalWorkflow | null {
  const matches = listRows<ApprovalWorkflow>(WORKFLOWS)
    .filter((workflow) => workflow.documentId === documentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return matches[0] ?? null;
}

export async function getWorkflowForDocument(documentId: string): Promise<ApprovalWorkflow | null> {
  return simulateLatency(newestWorkflowFor(documentId));
}

// Where a document's sign-off stands, or null if it hasn't been sent for
// sign-off (or the sign-off was rejected).
export function localSignOffFor(documentId: string): DocumentSignOff | null {
  const workflow = newestWorkflowFor(documentId);

  if (!workflow || (workflow.status !== "InProgress" && workflow.status !== "Approved")) {
    return null;
  }

  const current = workflow.status === "InProgress" ? workflow.steps.find((step) => step.status === "Pending") : undefined;

  return {
    complete: workflow.status === "Approved",
    approverName: current?.approverName ?? null,
    approverRole: current?.approverRole ?? null,
  };
}

export async function getWorkflowsForInitiative(initiativeId: string): Promise<ApprovalWorkflow[]> {
  return simulateLatency(listRows<ApprovalWorkflow>(WORKFLOWS).filter((workflow) => workflow.initiativeId === initiativeId));
}

// M14 — every workflow, newest first, for the Executive Director's oversight.
export async function getAllWorkflows(): Promise<ApprovalWorkflow[]> {
  return simulateLatency(
    listRows<ApprovalWorkflow>(WORKFLOWS).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function getLocalWorkflow(workflowId: string): ApprovalWorkflow | null {
  return readRow<ApprovalWorkflow>(WORKFLOWS, workflowId);
}

// M15 — the signed-in approver's past decisions.
export async function getMyApprovalHistory(): Promise<{ workflow: ApprovalWorkflow; step: ApprovalStep }[]> {
  const myId = getCurrentUserId();
  const rows = listRows<ApprovalWorkflow>(WORKFLOWS).flatMap((workflow) =>
    workflow.steps
      .filter((step) => step.approverUserId === myId && (step.status === "Signed" || step.status === "Rejected"))
      .map((step) => ({ workflow, step })),
  );

  return simulateLatency(rows.sort((a, b) => (b.step.decidedAt ?? "").localeCompare(a.step.decidedAt ?? "")));
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
// approved document itself; later approvers get it with the signatures so far.
export function fetchPdfToSign(item: Pick<PendingApproval, "workflowId" | "documentId" | "sequence">): Promise<Blob> {
  return item.sequence === 1 && item.documentId ? fetchPdfBlob(`${item.documentId}/preview-generated-pdf`) : fetchReviewPdf(item.workflowId);
}

// The document as an approver signed it and sent it on.
export function fetchSubmittedPdf(workflowId: string): Promise<Blob> {
  return fetchPdfBlob(`${workflowId}/submitted-pdf-for-approval`);
}

// With the signatures so far, for the next approver.
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
};
