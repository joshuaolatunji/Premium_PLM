import { DOCUMENT_META } from "../types/documentTypes";
import type { ProductDocument } from "../types/documentTypes";
import { sanitizeRichText } from "./richText";
import { fetchDocumentPdf } from "../service/DocumentService";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileNameFor(document: ProductDocument, initiativeName: string) {
  return `${initiativeName} - ${document.type}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The document laid out for the page: title, Overview, Description. Styles
// are scoped under .doc-pdf so they can't affect the app around it.
function buildPdfElement(document: ProductDocument, initiativeName: string): HTMLElement {
  const { overview } = document;
  const title = `${initiativeName} — ${DOCUMENT_META[document.type].name}`;
  const field = (label: string, value: string) =>
    `<div class="field"><div class="label">${label}</div><div class="value">${escapeHtml(value || "—")}</div></div>`;

  const element = window.document.createElement("div");
  element.className = "doc-pdf";
  element.innerHTML = `
<style>
  .doc-pdf { width: 720px; padding: 8px; background: #ffffff; color: #16181c; font-family: "IBM Plex Sans", Arial, sans-serif; line-height: 1.55; }
  .doc-pdf h1 { font-size: 22px; margin: 0 0 4px; }
  .doc-pdf .meta { color: #5d636c; font-size: 13px; margin-bottom: 24px; }
  .doc-pdf h2 { font-size: 16px; border-bottom: 2px solid #dd2025; padding-bottom: 6px; margin: 24px 0 14px; }
  .doc-pdf .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .doc-pdf .label { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .doc-pdf .value { font-size: 14px; white-space: pre-wrap; }
  .doc-pdf .field { margin-bottom: 12px; }
  .doc-pdf .description { font-size: 14px; }
  .doc-pdf .description > * + * { margin-top: 0.6em; }
  .doc-pdf .description ul { list-style: disc; padding-left: 1.5em; }
  .doc-pdf .description ol { list-style: decimal; padding-left: 1.5em; }
  .doc-pdf .description mark { padding: 0 2px; }
  .doc-pdf .description blockquote { border-left: 3px solid #ccd0d6; margin-left: 0; padding-left: 12px; color: #4a5058; }
  .doc-pdf .description code { background: #f1f3f6; padding: 1px 4px; border-radius: 3px; }
  .doc-pdf .description a { color: #2f5fa7; }
  .doc-pdf .description table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .doc-pdf .description th, .doc-pdf .description td { border: 1px solid #ccd0d6; padding: 6px 8px; text-align: left; vertical-align: top; }
  .doc-pdf .description th { background: #f1f3f6; }
  .doc-pdf .description tr, .doc-pdf .field { page-break-inside: avoid; }
</style>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${escapeHtml(document.type)} · v${document.version || 0}</div>
<h2>${escapeHtml(document.type)} Overview</h2>
<div class="grid">
  ${field("Author", overview.author)}
  ${field("Sponsor", overview.sponsor)}
  ${field("User group", overview.userGroup)}
  ${field("Product manager", overview.productManager)}
</div>
${field("Introduction", overview.introduction)}
<h2>Description</h2>
<div class="description">${sanitizeRichText(document.description) || "—"}</div>`;

  return element;
}

// Builds the PDF in the browser — used when the API's PDF isn't available.
// The library is loaded only when it's needed.
async function generatePdfInBrowser(document: ProductDocument, initiativeName: string): Promise<Blob> {
  const { default: html2pdf } = await import("html2pdf.js");
  const element = buildPdfElement(document, initiativeName);

  return html2pdf()
    .set({
      margin: [12, 12, 14, 12],
      filename: fileNameFor(document, initiativeName),
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(element)
    .outputPdf("blob");
}

// The document as a PDF: the API's (preview-pdf) when it works, otherwise
// the same document built in the browser.
async function documentPdf(document: ProductDocument, initiativeName: string): Promise<Blob> {
  try {
    return await fetchDocumentPdf(document.id);
  } catch (error) {
    // Logged so a failing PDF endpoint can be reported to the backend team.
    console.warn("preview-pdf failed; generating the PDF in the browser instead.", error);
    return generatePdfInBrowser(document, initiativeName);
  }
}

// "Download {type}": saves the PDF straight to the user's Downloads.
export async function downloadDocument(document: ProductDocument, initiativeName: string) {
  saveBlob(await documentPdf(document, initiativeName), fileNameFor(document, initiativeName));
}

// "Preview": opens the PDF in a new tab to read (and print or save from the
// browser's PDF viewer). The tab is opened straight away — before the PDF is
// ready — so the browser doesn't treat it as a pop-up, then filled in.
export async function previewDocument(document: ProductDocument, initiativeName: string) {
  const tab = window.open("", "_blank");

  if (tab) {
    tab.document.title = `${document.type} — ${initiativeName}`;
    tab.document.body.innerHTML =
      '<p style="font-family: Arial, sans-serif; padding: 24px; color: #4a5058;">Preparing the document…</p>';
  }

  try {
    const blob = await documentPdf(document, initiativeName);

    if (!tab) {
      // Pop-ups blocked: download it instead so the click still does something.
      saveBlob(blob, fileNameFor(document, initiativeName));
      return;
    }

    const url = URL.createObjectURL(blob);
    tab.location.href = url;

    // The tab needs the file for a while; free it once it has surely loaded.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
