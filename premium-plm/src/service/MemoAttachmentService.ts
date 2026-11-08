// A memo's attached files, on the shared General Attachment API:
//
//   POST   api/general-attachments/upload-attachments/Memo/{memoId}   multipart: files[], labels[]
//   GET    api/general-attachments/Memo/{memoId}/get-attachments
//   GET    api/general-attachments/{attachmentId}/open-attachments
//   DELETE api/general-attachments/{attachmentId}/delete-attachments
//
// The API's AttachmentTargetType doesn't have "Memo" yet (only
// ProductDiscovery, ProductProposal, ProductInitiative and ProductDocument),
// so upload and list are refused until it's added (gaps file M37).

import { apiClient, ApiError, API_BASE_URL } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";
import { openDiscoveryAttachment } from "./ProductDiscoveryService";

const TARGET = "Memo";

export interface MemoAttachment {
  id: string;
  fileName: string;
  // The name the author gave it at upload; falls back to fileName.
  label: string | null;
  contentType: string | null;
  size: number | null;
  uploadedAt: string | null;
}

export const memoAttachmentKeys = {
  one: (memoId: string) => ["memos", "attachments", memoId] as const,
};

// Shown in place of the server's message when it refuses the "Memo" target.
const NOT_SUPPORTED = "The server doesn't accept memo attachments yet (gaps file M37).";

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
    return new Error(NOT_SUPPORTED);
  }
  return error instanceof Error ? error : new Error(fallback);
}

function toAttachment(raw: unknown): MemoAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string") return null;

  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

  return {
    id: record.id,
    fileName: text(record.fileName) ?? "Attachment",
    label: text(record.label),
    contentType: text(record.contentType),
    size: typeof record.fileSize === "number" ? record.fileSize : null,
    uploadedAt: text(record.uploadedAt),
  };
}

export async function getMemoAttachments(memoId: string): Promise<MemoAttachment[]> {
  try {
    const body = await apiClient<{ data?: unknown[] } | unknown[] | null>(
      `api/general-attachments/${TARGET}/${memoId}/get-attachments`,
      { method: "GET", token: getToken() ?? undefined },
    );
    const rows = Array.isArray(body) ? body : (body?.data ?? []);

    return rows
      .map(toAttachment)
      .filter((item): item is MemoAttachment => item !== null)
      .sort((a, b) => (a.uploadedAt ?? "").localeCompare(b.uploadedAt ?? ""));
  } catch (error) {
    throw friendly(error, "Couldn't load the attachments.");
  }
}

// XMLHttpRequest rather than fetch, which can't report upload progress.
// `labels[i]` names `files[i]`.
export function uploadMemoAttachments(
  memoId: string,
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
    xhr.open("POST", `${API_BASE_URL}api/general-attachments/upload-attachments/${TARGET}/${memoId}`);

    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      let message = "Couldn't upload the attachments.";
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed && typeof parsed === "object" && "message" in parsed) message = String(parsed.message);
      } catch {
        // Not JSON; keep the generic message.
      }
      reject(friendly(new ApiError(message, xhr.status, xhr.responseText), message));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    xhr.send(formData);
  });
}

export async function deleteMemoAttachment(attachmentId: string): Promise<void> {
  await apiClient<unknown>(`api/general-attachments/${attachmentId}/delete-attachments`, {
    method: "DELETE",
    token: getToken() ?? undefined,
  });
}

// `targetWindow` must be opened in the click handler itself (see
// openDiscoveryAttachment), or the browser blocks the new tab.
export function openMemoAttachment(attachmentId: string, targetWindow: Window | null): Promise<void> {
  return openDiscoveryAttachment(attachmentId, targetWindow);
}

// What a file is called in lists: the name given at upload, or its file name.
export function attachmentName(item: MemoAttachment): string {
  return item.label ?? item.fileName;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
