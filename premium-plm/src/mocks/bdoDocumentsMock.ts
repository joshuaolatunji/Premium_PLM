// Mock service: no real endpoint exists yet for either the logic-flow
// document or design-screens documentation uploads, or for tracking BDO
// submission status. State lives in memory for the session only and
// resets on page reload — same convention as mocks/bdoAssignmentMock.ts.
// Every function is `async` and shaped like a real service call so
// swapping this module's body for real `apiClient` calls later is a
// localized change, not a rewrite of any caller.

import type {
  BdoDecisionRecord,
  BdoSubmissionStatus,
  MockUploadedFile,
} from "../types/bdoDocumentTypes";

const logicFlowByInitiativeId = new Map<string, MockUploadedFile[]>();
const designScreensByInitiativeId = new Map<string, MockUploadedFile[]>();
const submissionStatusByInitiativeId = new Map<string, BdoSubmissionStatus>();
const decisionByInitiativeId = new Map<string, BdoDecisionRecord>();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 200));
}

function makeId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toMockFile(file: File): MockUploadedFile {
  return {
    id: makeId(),
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    objectUrl: URL.createObjectURL(file),
  };
}

// ---- Logic flow document ----

export async function getLogicFlowDocuments(
  initiativeId: string,
): Promise<MockUploadedFile[]> {
  return delay(logicFlowByInitiativeId.get(initiativeId) ?? []);
}

export async function uploadLogicFlowDocument(
  initiativeId: string,
  file: File,
): Promise<MockUploadedFile> {
  const mockFile = toMockFile(file);
  const existing = logicFlowByInitiativeId.get(initiativeId) ?? [];

  logicFlowByInitiativeId.set(initiativeId, [...existing, mockFile]);

  return delay(mockFile);
}

export async function removeLogicFlowDocument(
  initiativeId: string,
  fileId: string,
): Promise<void> {
  const existing = logicFlowByInitiativeId.get(initiativeId) ?? [];

  logicFlowByInitiativeId.set(
    initiativeId,
    existing.filter((entry) => entry.id !== fileId),
  );

  await delay(undefined);
}

// ---- Design screens documentation ----

export async function getDesignScreens(
  initiativeId: string,
): Promise<MockUploadedFile[]> {
  return delay(designScreensByInitiativeId.get(initiativeId) ?? []);
}

export async function uploadDesignScreen(
  initiativeId: string,
  file: File,
): Promise<MockUploadedFile> {
  const mockFile = toMockFile(file);
  const existing = designScreensByInitiativeId.get(initiativeId) ?? [];

  designScreensByInitiativeId.set(initiativeId, [...existing, mockFile]);

  return delay(mockFile);
}

export async function removeDesignScreen(
  initiativeId: string,
  fileId: string,
): Promise<void> {
  const existing = designScreensByInitiativeId.get(initiativeId) ?? [];

  designScreensByInitiativeId.set(
    initiativeId,
    existing.filter((entry) => entry.id !== fileId),
  );

  await delay(undefined);
}

// ---- Submission status ----

export async function getSubmissionStatus(
  initiativeId: string,
): Promise<BdoSubmissionStatus> {
  return delay(submissionStatusByInitiativeId.get(initiativeId) ?? "NotStarted");
}

export async function submitBdoDocumentation(initiativeId: string): Promise<void> {
  submissionStatusByInitiativeId.set(initiativeId, "SubmittedForApproval");
  decisionByInitiativeId.delete(initiativeId);
  await delay(undefined);
}

// Group Head's approve/reject on the BDO's submitted documentation. No
// comment is recorded on approval (matches the same rule as BRD review);
// the rejection comment is kept so the BDO can see it when they return to
// their workspace.
export async function reviewBdoDocumentation(
  initiativeId: string,
  decision: { isApproved: boolean; comment: string },
): Promise<void> {
  submissionStatusByInitiativeId.set(
    initiativeId,
    decision.isApproved ? "Approved" : "Rejected",
  );

  if (decision.isApproved) {
    decisionByInitiativeId.delete(initiativeId);
  } else {
    decisionByInitiativeId.set(initiativeId, {
      comment: decision.comment,
      decidedAt: new Date().toISOString(),
    });
  }

  await delay(undefined);
}

export async function getBdoRejection(
  initiativeId: string,
): Promise<BdoDecisionRecord | null> {
  return delay(decisionByInitiativeId.get(initiativeId) ?? null);
}
