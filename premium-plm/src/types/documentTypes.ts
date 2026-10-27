// The four product documents a Product Manager prepares once the Group Head
// has approved the BDO's documentation. They share one shape (an Overview
// plus a rich-text Description) and one review chain:
//   PM drafts → submits → BDO reviews → Group Head reviews → Approved
// A rejection at either review sends the document back to the PM.
// There's no required order between them; DOCUMENT_TYPES is the order
// they're listed in (and the order the PM usually works in).

export type DocumentType = "PID" | "FRD" | "BRD" | "SWR";

export const DOCUMENT_TYPES: DocumentType[] = ["PID", "FRD", "BRD", "SWR"];

export const DOCUMENT_META: Record<DocumentType, { name: string; slug: string }> = {
  PID: { name: "Product Initiation Document", slug: "pid" },
  FRD: { name: "Functional Requirement Document", slug: "frd" },
  BRD: { name: "Business Requirements Document", slug: "brd" },
  SWR: { name: "Standard Work Requirement", slug: "swr" },
};

// Route segments use the lower-case slug ("pid", "frd"…).
export function documentTypeFromSlug(slug: string | undefined): DocumentType | null {
  return DOCUMENT_TYPES.find((type) => DOCUMENT_META[type].slug === slug) ?? null;
}

export type DocumentStatus =
  | "Draft"
  | "PendingBDOReview"
  | "PendingGroupHeadReview"
  | "Approved"
  | "Rejected"
  // Withdrawn on the backend — no longer in the review chain.
  | "Cancelled";

export type DocumentReviewer = "BDO" | "GroupHead";

export interface DocumentOverview {
  author: string;
  sponsor: string;
  userGroup: string;
  productManager: string;
  introduction: string;
}

export interface DocumentDecision {
  // Null when the API doesn't say who decided (gaps file R2).
  reviewer: DocumentReviewer | null;
  approved: boolean;
  comment: string;
  decidedAt: string;
}

export interface ProductDocument {
  id: string;
  initiativeId: string;
  type: DocumentType;
  overview: DocumentOverview;
  // Rich text from the editor, stored as HTML. Always sanitised before it's
  // rendered (see components/documents/RichTextContent.tsx).
  description: string;
  status: DocumentStatus;
  // Starts at 1 on first submission and goes up each time a returned
  // document is resubmitted.
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  // The most recent review decision — carries the reason when rejected
  // (from the API's commentReview).
  lastDecision: DocumentDecision | null;
}

export interface SaveDocumentRequest {
  overview: DocumentOverview;
  description: string;
}

// One initiative's four documents; null where one hasn't been started.
export type InitiativeDocuments = Record<DocumentType, ProductDocument | null>;

export const EMPTY_OVERVIEW: DocumentOverview = {
  author: "",
  sponsor: "",
  userGroup: "",
  productManager: "",
  introduction: "",
};
