import { apiClient, ApiError, API_BASE_URL } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type {
  CreateDiscoveryRequest,
  CreateWorkflowLinkRequest,
  DiscoveryAttachment,
  DiscoverySubmitResult,
  DiscoveryWorkflowLink,
  ProductDiscovery,
  UpdateDiscoveryRequest,
} from "../types/discoveryTypes";

// Returns null when the initiative has no discovery document yet, rather
// than throwing — a 404 here is an expected, normal state (not started),
// not an error. Same pattern as getProposalByInitiativeId.
export async function getDiscoveryByInitiativeId(
  initiativeId: string,
): Promise<ProductDiscovery | null> {
  const token = getToken();

  try {
    const response = await apiClient<ApiResponse<ProductDiscovery> | null>(
      `api/product-discovery/${initiativeId}`,
      {
        method: "GET",
        token: token ?? undefined,
      },
    );

    return response?.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createDiscovery(
  payload: CreateDiscoveryRequest,
): Promise<ProductDiscovery | null> {
  const token = getToken();

  const response = await apiClient<ApiResponse<ProductDiscovery> | null>(
    "api/product-discovery/create-discovery",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );

  return response?.data ?? null;
}

export async function updateDiscovery(
  initiativeId: string,
  payload: UpdateDiscoveryRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductDiscovery> | null>(
    `api/product-discovery/${initiativeId}/update-discovery`,
    {
      method: "PUT",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );
}

// Group Head's real approve/reject decision on the BDO's submitted
// documentation (confirmed live in Swagger: DecisionDto body, keyed by
// initiativeId not discoveryId). Replaces mocks/bdoDocumentsMock.ts's
// reviewBdoDocumentation for the write side — the read side (how the
// decision is reflected back on GET) is still unconfirmed.
export async function reviewDiscovery(
  initiativeId: string,
  decision: { isApproved: boolean; comment: string },
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductDiscovery> | null>(
    `api/product-discovery/${initiativeId}/discovery-decision`,
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(decision),
    },
  );
}

// The BDO's real "submit for approval" action. The request body is the
// discoveryId itself (a raw JSON string, not wrapped in an object) — matches
// the live Swagger spec exactly.
export async function submitDiscovery(discoveryId: string): Promise<DiscoverySubmitResult[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<DiscoverySubmitResult[]> | null>(
    "api/product-discovery/submit-discovery",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(discoveryId),
    },
  );

  return response?.data ?? [];
}

// Re-submits a discovery the Group Head rejected. Separate from
// submitDiscovery because the backend only accepts a plain submit from a
// Draft; a rejected discovery must go through this endpoint instead.
// Response body is undocumented, so it's treated as fire-and-confirm.
export async function resubmitDiscovery(discoveryId: string): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/product-discovery/${discoveryId}/resubmit-discovery`, {
    method: "POST",
    token: token ?? undefined,
  });
}

// What an attachment belongs to — the API's AttachmentTargetType enum
// (confirmed in Swagger). Each role uploads against its own record:
//   BDO        → ProductDiscovery,  id = the discovery's id
//   PM         → ProductProposal,   id = the BRD (proposal)'s id
//   Group Head → ProductInitiative, id = the initiative's id
export type AttachmentTargetType = "ProductDiscovery" | "ProductProposal" | "ProductInitiative";

export interface AttachmentTarget {
  type: AttachmentTargetType;
  id: string;
}

// Attachments live under one shared "general-attachments" API for every
// role, keyed by target (upload / list), or by attachment id (open /
// delete). One generic upload endpoint for every role's documents:
// POST api/general-attachments/upload-attachments/{targetType}/{targetId}. Uses
// XMLHttpRequest instead of apiClient/fetch specifically because fetch has
// no way to report upload progress; it mirrors apiClient's error semantics
// (throws ApiError) so callers handle it the same way.
//
// `labels` is a parallel array to `files` (labels[i] names files[i]) —
// confirmed in the current Swagger multipart schema.
export function uploadAttachments(
  target: AttachmentTarget,
  files: File[],
  labels: string[],
  onProgress?: (percent: number) => void,
): Promise<void> {
  const token = getToken();
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  labels.forEach((label) => formData.append("labels", label));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${API_BASE_URL}api/general-attachments/upload-attachments/${target.type}/${target.id}`,
    );

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      let message = "Something went wrong";

      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed && typeof parsed === "object" && "message" in parsed) {
          message = String(parsed.message);
        }
      } catch {
        // Response wasn't JSON — fall back to the generic message.
      }

      reject(new ApiError(message, xhr.status, xhr.responseText));
    };

    xhr.onerror = () => {
      reject(new ApiError("Network error while uploading.", 0, null));
    };

    xhr.send(formData);
  });
}

// Confirmed live: { id, productDiscoveryId, fileName, contentType, fileSize,
// uploadedAt, uploadedByUserId, fileUrl }. fileUrl is a path relative to the
// API host (e.g. "/api/general-attachments/{id}/open-attachments"), not an
// absolute URL, so it's resolved against API_BASE_URL here rather than left
// for the browser to resolve against the frontend's own origin.
function toDiscoveryAttachment(raw: unknown): DiscoveryAttachment | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = record.id;
  const fileName = record.fileName;
  const fileUrl = record.fileUrl;
  // The BDO's own name for the file — confirmed live as `label` on the
  // attachment record (e.g. "label": "Muiz's Head"). Files uploaded before
  // labels existed have none, and fall back to `fileName` in the UI.
  const label = record.label;
  const uploadedByUserId = record.uploadedByUserId;

  if (typeof id !== "string") {
    return null;
  }

  return {
    id,
    fileName: typeof fileName === "string" ? fileName : "Attachment",
    label: typeof label === "string" && label.trim() ? label : null,
    uploadedByUserId: typeof uploadedByUserId === "string" ? uploadedByUserId : null,
    url: typeof fileUrl === "string" ? `${API_BASE_URL}${fileUrl}` : null,
  };
}

// Lists one record's attachments — e.g. a discovery's BDO documents.
export async function getAttachments(target: AttachmentTarget): Promise<DiscoveryAttachment[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<unknown[]> | null>(
    `api/general-attachments/${target.type}/${target.id}/get-attachments`,
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return (response?.data ?? [])
    .map(toDiscoveryAttachment)
    .filter((attachment): attachment is DiscoveryAttachment => attachment !== null);
}

// The BDO's documentation files for a discovery — what the BDO workspace,
// the Group Head's BDO review, and the engineers' ticket views list.
export function getDiscoveryAttachments(discoveryId: string): Promise<DiscoveryAttachment[]> {
  return getAttachments({ type: "ProductDiscovery", id: discoveryId });
}

// The "open" endpoint returns the raw file body (not JSON), and it's
// protected — a plain <a href> navigation to it won't carry the
// Authorization header and would just 401. Fetched directly (same pattern
// as PdfService.ts) and opened from a blob URL instead.
//
// `targetWindow` must come from a window.open() call made synchronously
// inside the click handler (before this async function's first await) —
// browsers only treat window.open() as triggered by a user gesture when
// it's called in that same synchronous tick. Calling window.open() here,
// after an awaited fetch, gets silently blocked as a popup by most
// browsers (no error, nothing visibly happens).
export async function openDiscoveryAttachment(
  attachmentId: string,
  targetWindow: Window | null,
): Promise<void> {
  const token = getToken();

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}api/general-attachments/${attachmentId}/open-attachments`,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
  } catch (error) {
    targetWindow?.close();
    throw error;
  }

  if (!response.ok) {
    targetWindow?.close();
    throw new ApiError("Unable to open this attachment.", response.status, null);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = blobUrl;
  } else {
    // The pre-opened tab was closed (or never opened) — fall back to a
    // fresh window.open(), which may itself get blocked outside a direct
    // gesture, but it's the best remaining option.
    window.open(blobUrl, "_blank");
  }

  // Delayed rather than immediate — the new tab needs the blob URL to
  // still be valid while it loads the file.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function deleteDiscoveryAttachment(attachmentId: string): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(
    `api/general-attachments/${attachmentId}/delete-attachments`,
    {
      method: "DELETE",
      token: token ?? undefined,
    },
  );
}

// The API rejects a URL without a scheme ("A valid HTTP or HTTPS URL is
// required."), but people naturally type "www.figma.com". Anything that
// doesn't already start with http:// or https:// gets https:// prepended.
function withHttpScheme(url: string): string {
  const trimmed = url.trim();

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
}

// The "design screens" step is now a link (Figma, hosted screens, etc.)
// rather than a file upload — matches the real workflow-links endpoint.
export async function addDiscoveryWorkflowLink(
  discoveryId: string,
  payload: CreateWorkflowLinkRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/product-discovery/${discoveryId}/add-workflow-links`, {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify({ ...payload, url: withHttpScheme(payload.url) }),
  });
}

export async function getDiscoveryWorkflowLinks(
  discoveryId: string,
): Promise<DiscoveryWorkflowLink[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<DiscoveryWorkflowLink[]> | null>(
    `api/product-discovery/${discoveryId}/get-workflow-links`,
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response?.data ?? [];
}
