import { DOCUMENT_META } from "../types/documentTypes";
import type { ProductDocument } from "../types/documentTypes";
import { sanitizeRichText } from "./richText";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "Download" for a PID / FRD / BRD / SWR. There's no PDF endpoint for these
// documents yet, so this opens a clean, printable copy and the browser's
// print dialog — choose "Save as PDF" there. Swap for a real PDF download
// once the backend provides one.
export function printDocument(document: ProductDocument, initiativeName: string) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Allow pop-ups for this site to download the document.");
    return;
  }

  const { overview } = document;
  const title = `${initiativeName} — ${DOCUMENT_META[document.type].name}`;
  const field = (label: string, value: string) =>
    `<div class="field"><div class="label">${label}</div><div class="value">${escapeHtml(value || "—")}</div></div>`;

  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #16181c; margin: 40px; line-height: 1.55; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #5d636c; font-size: 13px; margin-bottom: 28px; }
  h2 { font-size: 16px; border-bottom: 2px solid #dd2025; padding-bottom: 6px; margin: 28px 0 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .label { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .value { font-size: 14px; white-space: pre-wrap; }
  .field { margin-bottom: 12px; }
  .description { font-size: 14px; }
  .description mark { padding: 0 2px; }
  .description blockquote { border-left: 3px solid #ccd0d6; margin-left: 0; padding-left: 12px; color: #4a5058; }
  .description code { background: #f1f3f6; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(document.type)} · v${document.version || 0} · ${escapeHtml(document.status)}</div>
  <h2>${escapeHtml(document.type)} Overview</h2>
  <div class="grid">
    ${field("Author", overview.author)}
    ${field("Sponsor", overview.sponsor)}
    ${field("User group", overview.userGroup)}
    ${field("Product manager", overview.productManager)}
  </div>
  ${field("Introduction", overview.introduction)}
  <h2>Description</h2>
  <div class="description">${sanitizeRichText(document.description) || "—"}</div>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
