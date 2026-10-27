import { API_BASE_URL } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

// The PDF endpoints return a binary PDF body, not JSON, so they can't go
// through the shared apiClient (which parses every response as JSON/text).
// Fetched directly instead.
export async function fetchPdfBlob(endpoint: string): Promise<Blob> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const name = endpoint.split("/").pop();

  if (!response.ok) {
    throw new Error(`${name} returned ${response.status} ${response.statusText}`.trim());
  }

  const blob = await response.blob();
  const contentType = response.headers.get("content-type") ?? blob.type;

  // A 200 that isn't a PDF (e.g. a JSON or HTML body) would save as a broken file.
  if (!/pdf|octet-stream/i.test(contentType)) {
    throw new Error(`${name} returned "${contentType || "no content type"}", not a PDF`);
  }

  return contentType.includes("pdf") ? blob : new Blob([blob], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Opens a PDF in a new tab. The tab is opened by the caller during the click
// (so it isn't blocked as a pop-up) and pointed at the PDF once it arrives.
export async function openPdfInTab(load: () => Promise<Blob>, targetWindow: Window | null): Promise<void> {
  try {
    const blob = await load();
    const url = URL.createObjectURL(blob);

    if (targetWindow) {
      targetWindow.location.href = url;
    } else {
      window.open(url, "_blank");
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    targetWindow?.close();
    throw error;
  }
}
