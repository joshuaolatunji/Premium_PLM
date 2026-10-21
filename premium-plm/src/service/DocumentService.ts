// PID / FRD / BRD / SWR documents.
//
// MOCK — the backend has no endpoints for these yet (the BRD's real
// ProductProposal API has no Description field, so the BRD runs on this mock
// too). Documents are kept in this browser's localStorage, so they survive a
// refresh but are NOT shared between browsers or users. Every function is
// async and shaped like the proposed API in docs/product-documents-api.md;
// connecting the real endpoints means replacing the bodies below with
// apiClient calls — nothing that calls this file has to change.

import type {
  DocumentReviewer,
  DocumentType,
  InitiativeDocuments,
  ProductDocument,
  SaveDocumentRequest,
} from "../types/documentTypes";
import { DOCUMENT_TYPES } from "../types/documentTypes";

const STORAGE_KEY = "plm-mock-product-documents";

function readAll(): ProductDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProductDocument[]) : [];
  } catch {
    return [];
  }
}

function writeAll(documents: ProductDocument[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // Storage full or blocked — the change only lasts until the next reload.
  }
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 120));
}

function makeId(): string {
  return `mock-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function find(initiativeId: string, type: DocumentType): ProductDocument | null {
  return readAll().find((doc) => doc.initiativeId === initiativeId && doc.type === type) ?? null;
}

function replace(updated: ProductDocument): ProductDocument {
  writeAll(readAll().map((doc) => (doc.id === updated.id ? updated : doc)));
  return updated;
}

// Proposed: GET api/product-documents/{initiativeId}
export async function getInitiativeDocuments(initiativeId: string): Promise<InitiativeDocuments> {
  const documents = readAll().filter((doc) => doc.initiativeId === initiativeId);

  const result = Object.fromEntries(
    DOCUMENT_TYPES.map((type) => [type, documents.find((doc) => doc.type === type) ?? null]),
  ) as InitiativeDocuments;

  return delay(result);
}

// Proposed: POST api/product-documents/{initiativeId}/{type}  (first save)
//           PUT  api/product-documents/{documentId}           (later saves)
// Only a Draft or a returned (Rejected) document can be edited.
export async function saveDocument(
  initiativeId: string,
  type: DocumentType,
  payload: SaveDocumentRequest,
  userId: string,
): Promise<ProductDocument> {
  const now = new Date().toISOString();
  const existing = find(initiativeId, type);

  if (!existing) {
    const created: ProductDocument = {
      id: makeId(),
      initiativeId,
      type,
      overview: payload.overview,
      description: payload.description,
      status: "Draft",
      version: 0,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      lastDecision: null,
    };

    writeAll([...readAll(), created]);
    return delay(created);
  }

  if (existing.status !== "Draft" && existing.status !== "Rejected") {
    throw new Error("This document is with a reviewer and can't be edited right now.");
  }

  return delay(
    replace({ ...existing, overview: payload.overview, description: payload.description, updatedAt: now }),
  );
}

// Proposed: POST api/product-documents/{documentId}/submit
// Sends a Draft (or a returned document) to the BDO.
export async function submitDocument(initiativeId: string, type: DocumentType): Promise<ProductDocument> {
  const existing = find(initiativeId, type);

  if (!existing) {
    throw new Error("Save the document before submitting it.");
  }

  if (existing.status !== "Draft" && existing.status !== "Rejected") {
    throw new Error("This document has already been submitted.");
  }

  const now = new Date().toISOString();

  return delay(
    replace({
      ...existing,
      status: "PendingBDOReview",
      version: existing.version + 1,
      submittedAt: now,
      updatedAt: now,
    }),
  );
}

// Proposed: POST api/product-documents/{documentId}/review
// BDO approval forwards the document to the Group Head; the Group Head's
// approval is final. A rejection at either step returns it to the PM.
export async function reviewDocument(
  initiativeId: string,
  type: DocumentType,
  reviewer: DocumentReviewer,
  approved: boolean,
  comment: string,
): Promise<ProductDocument> {
  const existing = find(initiativeId, type);
  const expectedStatus = reviewer === "BDO" ? "PendingBDOReview" : "PendingGroupHeadReview";

  if (!existing || existing.status !== expectedStatus) {
    throw new Error("This document isn't waiting for your review.");
  }

  const now = new Date().toISOString();

  return delay(
    replace({
      ...existing,
      status: !approved ? "Rejected" : reviewer === "BDO" ? "PendingGroupHeadReview" : "Approved",
      // Moving to the Group Head counts as a new submission for their queue.
      submittedAt: approved && reviewer === "BDO" ? now : existing.submittedAt,
      updatedAt: now,
      lastDecision: { reviewer, approved, comment, decidedAt: now },
    }),
  );
}
