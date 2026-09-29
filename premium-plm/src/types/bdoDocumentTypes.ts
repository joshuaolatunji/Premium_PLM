// Mocked domain — there's no real endpoint yet for either of these file
// uploads. See mocks/bdoDocumentsMock.ts.
export interface MockUploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  // A session-scoped object URL (URL.createObjectURL) — lets an uploaded
  // file actually be opened/previewed within the session, without any real
  // storage backend. Invalid after a page reload, same as the rest of this
  // mock's state.
  objectUrl: string;
}

export type BdoSubmissionStatus =
  | "NotStarted"
  | "InProgress"
  | "SubmittedForApproval"
  | "Approved"
  | "Rejected";

export interface BdoDecisionRecord {
  comment: string;
  decidedAt: string;
}
