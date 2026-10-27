// html2pdf.js ships without TypeScript types — just what printDocument.ts uses.
declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: "portrait" | "landscape" };
    pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[]; avoid?: string | string[] };
  }

  interface Html2PdfWorker extends Promise<void> {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(source: HTMLElement | string): Html2PdfWorker;
    save(filename?: string): Promise<void>;
    outputPdf(type: "blob"): Promise<Blob>;
  }

  export default function html2pdf(): Html2PdfWorker;
}
