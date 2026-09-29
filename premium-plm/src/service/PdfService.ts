import { API_BASE_URL } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

// These PDF export endpoints return a binary PDF body, not JSON, so they
// can't go through the shared apiClient (which always parses the response
// as JSON/text). Fetched directly instead.
async function fetchPdf(endpoint: string): Promise<Blob> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("Unable to generate the PDF.");
  }

  return response.blob();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export async function downloadBrdPdf(
  initiativeId: string,
  initiativeName: string,
): Promise<void> {
  const blob = await fetchPdf(`${initiativeId}/brd-pdf`);
  downloadBlob(blob, `${initiativeName} - BRD.pdf`);
}
