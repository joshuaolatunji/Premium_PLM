import { DOCUMENT_META } from "../types/documentTypes";
import type { DocumentReviewer, DocumentType } from "../types/documentTypes";

// Route builders for the document pages, so every link agrees.

export function documentEditorPath(initiativeId: string, type: DocumentType): string {
  return `/dashboard/initiatives/${initiativeId}/documents/${DOCUMENT_META[type].slug}`;
}

export function documentHubPath(type: DocumentType): string {
  return `/dashboard/documents/${DOCUMENT_META[type].slug}`;
}

export function documentReviewsPath(reviewer: DocumentReviewer, type: DocumentType): string {
  const base = reviewer === "BDO" ? "bdo-document-reviews" : "document-reviews";
  return `/dashboard/${base}/${DOCUMENT_META[type].slug}`;
}

export function documentReviewPath(reviewer: DocumentReviewer, type: DocumentType, initiativeId: string): string {
  return `${documentReviewsPath(reviewer, type)}/${initiativeId}`;
}
