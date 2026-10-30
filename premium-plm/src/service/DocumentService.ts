// PID / FRD / BRD / SWR documents — the real ProductDocument API.
//
// Endpoints (no "api/" prefix, same as create-initiative):
//   GET   {initiativeId}/get-documents?documentType=PID   one document of a type
//   POST  create-document                                  first save
//   PATCH {documentId}/update-document?documentType=PID    later saves
//   POST  {documentId}/submit-document                     Draft → BDO
//   POST  {documentId}/resubmit                            returned → BDO again
//   POST  {documentId}/review-document                     BDO / Group Head decision
//   GET   {documentId}/preview-generated-pdf               PDF export
//
// The pages work with the app's own document shape (types/documentTypes.ts);
// everything below converts to and from the API's shape, so the pages don't
// change if the API's field names do.

import { apiClient, ApiError } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";
import { fetchPdfBlob } from "./PdfService";
import { linkToInitiative, recordActivity } from "./ActivityService";
import { localSignOffFor } from "./ApprovalWorkflowService";

// Where the Group Head opens a document from an activity entry.
function documentLink(initiativeId: string, type: DocumentType) {
  return `/dashboard/document-reviews/${type.toLowerCase()}/${initiativeId}`;
}
import type { ApiResponse } from "../types/apiTypes";
import { DOCUMENT_TYPES } from "../types/documentTypes";
import type {
  DocumentReviewer,
  DocumentStatus,
  DocumentType,
  InitiativeDocuments,
  ProductDocument,
  SaveDocumentRequest,
} from "../types/documentTypes";

// The API's ProductDocumentResponseDto.
interface ApiProductDocument {
  id: string;
  productInitiativeId: string;
  documentType: DocumentType | number;
  author: string | null;
  userGroup: string | null;
  sponsor: string | null;
  projectManager: string | null;
  introduction: string | null;
  contentHtml: string | null;
  status: string | number;
  currentVersion: number;
  // The latest reviewer's comment — the reason, when a document is returned.
  commentReview?: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// The API's ProductDocumentStatus values, in enum order (so a numeric value
// can be read too, should the API ever send numbers instead of names).
const API_STATUSES = [
  "Draft",
  "PendingApproval",
  "PartiallyApproved",
  "ChangesRequested",
  "RevisionInProgress",
  "Approved",
  "Cancelled",
  // Approved by the Group Head and out for sign-off (gaps file R26).
  "PendingWorkflowApproval",
] as const;

type ApiStatus = (typeof API_STATUSES)[number];

const API_DOCUMENT_TYPES: DocumentType[] = ["BRD", "FRD", "PID", "SWR"];

function readApiStatus(status: string | number): ApiStatus {
  if (typeof status === "number") {
    return API_STATUSES[status] ?? "Draft";
  }

  // Matched without regard to case ("pendingWorkflowApproval" too).
  return API_STATUSES.find((name) => name.toLowerCase() === status.toLowerCase()) ?? "Draft";
}

// API status → the app's status:
//   PendingApproval    — with the BDO (first review)
//   PartiallyApproved  — BDO approved it; with the Group Head
//   PendingWorkflowApproval — Group Head approved it; out for sign-off
//   ChangesRequested / RevisionInProgress — returned to the PM to revise
function toAppStatus(status: ApiStatus): DocumentStatus {
  switch (status) {
    case "PendingApproval":
      return "PendingBDOReview";
    case "PartiallyApproved":
      return "PendingGroupHeadReview";
    case "ChangesRequested":
    case "RevisionInProgress":
      return "Rejected";
    case "Approved":
      return "Approved";
    case "Cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

function toAppDocument(api: ApiProductDocument): ProductDocument {
  // So a sign-off or upload on this document can be linked to its initiative.
  linkToInitiative("document", api.id, api.productInitiativeId);
  const apiStatus = readApiStatus(api.status);
  // Out for sign-off, the API says PendingWorkflowApproval. Until that's
  // live it says PendingApproval, the same as "with the BDO" (gaps file
  // R26), so the app's sign-off record tells the two apart. Who has it now
  // comes from that record too (M13).
  const localSignOff = localSignOffFor(api.id);
  const signOff =
    apiStatus === "PendingWorkflowApproval"
      ? (localSignOff ?? { complete: false, approverName: null, approverRole: null })
      : localSignOff;
  const status =
    apiStatus === "PendingWorkflowApproval" || (localSignOff && apiStatus === "PendingApproval")
      ? "Approved"
      : toAppStatus(apiStatus);
  const type =
    typeof api.documentType === "number" ? API_DOCUMENT_TYPES[api.documentType] : api.documentType;

  return {
    id: api.id,
    initiativeId: api.productInitiativeId,
    type,
    overview: {
      author: api.author ?? "",
      sponsor: api.sponsor ?? "",
      userGroup: api.userGroup ?? "",
      productManager: api.projectManager ?? "",
      introduction: api.introduction ?? "",
    },
    description: api.contentHtml ?? "",
    status,
    version: api.currentVersion ?? 0,
    createdByUserId: api.createdByUserId ?? "",
    createdAt: api.createdAt,
    updatedAt: api.updatedAt ?? api.createdAt,
    // The API doesn't return a submitted date yet; the last update is the
    // closest — for a document under review, that's when it reached its
    // current reviewer.
    submittedAt:
      status === "PendingBDOReview" || status === "PendingGroupHeadReview"
        ? (api.updatedAt ?? api.createdAt)
        : null,
    // The API returns the reviewer's comment, but not who returned it or
    // when (gaps file R2), so the reviewer is left unknown.
    lastDecision:
      status === "Rejected" && api.commentReview
        ? { reviewer: null, approved: false, comment: api.commentReview, decidedAt: api.updatedAt ?? api.createdAt }
        : null,
    signOff: status === "Approved" ? signOff : null,
  };
}

function authOptions() {
  return { token: getToken() ?? undefined };
}

// The raw API record for one type, or null when it hasn't been started (a 404
// or an empty response is the normal "not started" state, not an error).
async function fetchApiDocument(initiativeId: string, type: DocumentType): Promise<ApiProductDocument | null> {
  try {
    const response = await apiClient<ApiResponse<ApiProductDocument | ApiProductDocument[]> | null>(
      `${initiativeId}/get-documents?${new URLSearchParams({ documentType: type })}`,
      { method: "GET", ...authOptions() },
    );

    const data = response?.data ?? null;
    // Tolerate a list too, in case the endpoint returns one.
    // Never let one type stand in for another (e.g. the PID answering for
    // the FRD), or two documents would share one id and one sign-off.
    const typeOf = (doc: ApiProductDocument) =>
      typeof doc.documentType === "number" ? API_DOCUMENT_TYPES[doc.documentType] : doc.documentType;
    const records = Array.isArray(data) ? data : data ? [data] : [];
    const record = records.find((doc) => typeOf(doc) === type) ?? null;

    return record?.id ? record : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function requireApiDocument(initiativeId: string, type: DocumentType): Promise<ApiProductDocument> {
  const record = await fetchApiDocument(initiativeId, type);

  if (!record) {
    throw new Error(`Save the ${type} before continuing.`);
  }

  return record;
}

// All four documents for an initiative (null where one hasn't been started),
// fetched in parallel.
export async function getInitiativeDocuments(initiativeId: string): Promise<InitiativeDocuments> {
  const records = await Promise.all(DOCUMENT_TYPES.map((type) => fetchApiDocument(initiativeId, type)));

  return Object.fromEntries(
    DOCUMENT_TYPES.map((type, index) => [type, records[index] ? toAppDocument(records[index]!) : null]),
  ) as InitiativeDocuments;
}

// Creates the document on its first save, then updates it. Only a draft or a
// returned document can be edited (the API enforces this too).
export async function saveDocument(
  initiativeId: string,
  type: DocumentType,
  payload: SaveDocumentRequest,
  // Kept for the call sites; the API records the author from the signed-in user.
  _userId?: string,
): Promise<ProductDocument> {
  void _userId;

  const fields = {
    author: payload.overview.author,
    userGroup: payload.overview.userGroup,
    sponsor: payload.overview.sponsor,
    projectManager: payload.overview.productManager,
    introduction: payload.overview.introduction,
    contentHtml: payload.description,
  };

  const existing = await fetchApiDocument(initiativeId, type);

  if (!existing) {
    const response = await apiClient<ApiResponse<ApiProductDocument> | null>("create-document", {
      method: "POST",
      ...authOptions(),
      body: JSON.stringify({ productInitiativeId: initiativeId, documentType: type, ...fields }),
    });

    recordActivity({ initiativeId, area: "Documents", action: `started the ${type}`, link: documentLink(initiativeId, type) });
    return toAppDocument(response?.data ?? (await requireApiDocument(initiativeId, type)));
  }

  const response = await apiClient<ApiResponse<ApiProductDocument> | null>(
    `${existing.id}/update-document?${new URLSearchParams({ documentType: type })}`,
    { method: "PATCH", ...authOptions(), body: JSON.stringify(fields) },
  );

  recordActivity({ initiativeId, area: "Documents", action: `saved changes to the ${type}`, link: documentLink(initiativeId, type) });
  return toAppDocument(response?.data ?? (await requireApiDocument(initiativeId, type)));
}

// Sends a draft to the BDO — or, for a returned document, resubmits it.
export async function submitDocument(initiativeId: string, type: DocumentType): Promise<ProductDocument> {
  const existing = await requireApiDocument(initiativeId, type);
  const apiStatus = readApiStatus(existing.status);
  const isResubmit = apiStatus === "ChangesRequested" || apiStatus === "RevisionInProgress";

  if (apiStatus !== "Draft" && !isResubmit) {
    throw new Error("This document has already been submitted.");
  }

  await apiClient<unknown>(`${existing.id}/${isResubmit ? "resubmit" : "submit-document"}`, {
    method: "POST",
    ...authOptions(),
  });

  recordActivity({
    initiativeId,
    area: "Documents",
    action: `${isResubmit ? "resubmitted" : "submitted"} the ${type} to the BDO for review`,
    tone: "warning",
    link: documentLink(initiativeId, type),
  });

  return toAppDocument(await requireApiDocument(initiativeId, type));
}

// Records the BDO's or Group Head's decision. The API works out which review
// step this is from the document's status and the signed-in user's role.
export async function reviewDocument(
  initiativeId: string,
  type: DocumentType,
  reviewer: DocumentReviewer,
  approved: boolean,
  comment: string,
): Promise<ProductDocument> {
  const existing = await requireApiDocument(initiativeId, type);
  const expected = reviewer === "BDO" ? "PendingApproval" : "PartiallyApproved";

  if (readApiStatus(existing.status) !== expected) {
    throw new Error("This document isn't waiting for your review.");
  }

  await apiClient<unknown>(`${existing.id}/review-document`, {
    method: "POST",
    ...authOptions(),
    body: JSON.stringify({
      isApproved: approved,
      comment: comment || null,
    }),
  });

  recordActivity({
    initiativeId,
    area: "Documents",
    action: approved
      ? reviewer === "BDO"
        ? `approved the ${type} and sent it to the Group Head`
        : `approved the ${type}`
      : `returned the ${type} to the Product Manager`,
    detail: comment,
    tone: approved ? "success" : "danger",
    link: documentLink(initiativeId, type),
  });

  return toAppDocument(await requireApiDocument(initiativeId, type));
}

// The document as a PDF, generated by the API.
export function fetchDocumentPdf(documentId: string): Promise<Blob> {
  return fetchPdfBlob(`${documentId}/preview-generated-pdf`);
}
