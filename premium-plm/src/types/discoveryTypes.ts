// Matches the live API's CreateProductDiscoveryDto / UpdateProductDiscoveryDto
// exactly (verified against the current Swagger spec).
export interface DiscoveryFormFields {
  businessLogic: string;
  customerJourney: string;
  userFlow: string;
  businessProcess: string;
  assumptions: string;
}

export interface CreateDiscoveryRequest extends DiscoveryFormFields {
  productInitiativeId: string;
}

export type UpdateDiscoveryRequest = DiscoveryFormFields;

// Confirmed live (GET .../product-discovery/{initiativeId}, still
// undocumented in Swagger but seen directly): id, productInitiativeId,
// status, createdByUserId, createdAt, updatedAt, completedAt,
// reviewComment, reviewedByUserId. `status` is confirmed to take
// "Submitted" right after submit-discovery and "Rejected"/"Approved"
// after a Group Head decision. `reviewComment`/`reviewedByUserId` are
// populated once a decision has been made (null/absent before that).
export interface ProductDiscovery extends DiscoveryFormFields {
  id: string;
  productInitiativeId: string;
  status: string;
  reviewComment: string | null;
  reviewedByUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// POST /api/product-discovery/submit-discovery returns an array of these —
// verified against the live Swagger spec (DiscoverySubmitResponseDto).
export interface DiscoverySubmitResult {
  discoveryId: string | null;
  status: string | null;
}

// GET .../{discoveryId}/get-attachments has no documented response schema
// at all (the upload endpoint's request is just `files: File[]`, no
// metadata, and both responses are undocumented "OK"). Field names below
// are a best-effort guess pending a real example — the service layer reads
// them defensively (falls back across likely names) rather than assuming
// this shape is exact.
export interface DiscoveryAttachment {
  id: string;
  fileName: string;
  url: string | null;
}

export interface CreateWorkflowLinkRequest {
  title: string;
  url: string;
  description: string;
}

// GET .../{discoveryId}/get-workflow-links is also undocumented, but every
// other undocumented GET response in this API has matched its create DTO's
// fields plus an id — this follows that same pattern.
export interface DiscoveryWorkflowLink extends CreateWorkflowLinkRequest {
  id: string;
}

export const EMPTY_DISCOVERY_FORM: DiscoveryFormFields = {
  businessLogic: "",
  customerJourney: "",
  userFlow: "",
  businessProcess: "",
  assumptions: "",
};
