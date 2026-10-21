import DOMPurify from "dompurify";

// Strips scripts, event handlers and anything else unsafe from editor HTML
// before it's displayed or printed. Links get rel/target so they open safely
// in a new tab.
export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html ?? "", { USE_PROFILES: { html: true } });

  const container = document.createElement("div");
  container.innerHTML = clean;
  container.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  return container.innerHTML;
}

// The text without any formatting — used to check a description isn't
// blank before a document is submitted.
export function richTextToPlain(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = sanitizeRichText(html);
  return (container.textContent ?? "").trim();
}
