import { useEffect, useRef, useState } from "react";
import { Eye, FileText } from "lucide-react";

interface PdfCoverPreviewProps {
  blob: Blob | undefined;
  isLoading: boolean;
  isError: boolean;
  title: string;
  hint: string;
  onOpen: () => void;
}

// The PDF's front page as a thumbnail, with a button to open the whole file.
// pdf.js is loaded only when a preview is shown, so it stays out of the main
// bundle.
function PdfCoverPreview({ blob, isLoading, isError, title, hint, onOpen }: PdfCoverPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    if (!blob) {
      return;
    }

    let cancelled = false;
    let destroy: (() => void) | null = null;

    (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
        destroy = () => void pdf.destroy();
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;

        if (cancelled || !canvas) {
          return;
        }

        // Rendered at twice the displayed width so it stays sharp on high-density screens.
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (canvas.clientWidth * 2) / base.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, viewport }).promise;

        if (!cancelled) {
          setRendered(true);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRenderFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [blob]);

  const status = isError || renderFailed
    ? "Couldn't load a preview. Open the PDF to read it."
    : isLoading || !rendered
      ? "Loading the preview…"
      : null;

  return (
    <section className="dashboard-panel pdf-cover">
      <button
        type="button"
        className="pdf-cover_thumb"
        onClick={onOpen}
        disabled={isLoading}
        aria-label={`Open ${title} as a PDF`}
      >
        <canvas ref={canvasRef} className={rendered ? "is-rendered" : undefined} />
        {!rendered && <FileText className="pdf-cover_placeholder" size={56} strokeWidth={1.25} aria-hidden="true" />}
        <span className="pdf-cover_badge">
          <FileText size={14} aria-hidden="true" />
          PDF
        </span>
      </button>

      <div className="pdf-cover_body">
        <h2>{title}</h2>
        <p>{hint}</p>
        {status && <p className="pdf-cover_status">{status}</p>}

        <button type="button" className="button button--dark" onClick={onOpen} disabled={isLoading}>
          <Eye size={17} aria-hidden="true" />
          Open PDF
        </button>
      </div>
    </section>
  );
}

export default PdfCoverPreview;
