import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { fetchMemoPdfSigned } from "../../service/MemoService";
import { openPdfInTab } from "../../service/PdfService";
import type { MemoPendingApproval } from "../../types/memoTypes";
import PdfCoverPreview from "../documents/PdfCoverPreview";
import MemoAttachmentsList from "./MemoAttachmentsList";

interface MemoSignedViewProps {
  // The step the user has just signed.
  item: MemoPendingApproval;
  title: string;
  // Where the memo has gone: to the next approver, or nowhere because this
  // was the last signature. "checking" while the memo is being re-read.
  outcome: "checking" | "next" | "final";
}

const OUTCOME_TEXT: Record<MemoSignedViewProps["outcome"], string> = {
  checking: "Signed.",
  next: "Signed. The memo has moved on to the next approver.",
  final: "Signed. You were the final approver, so the memo is now fully signed.",
};

// Straight after an approver signs: the memo with their signature on it, and
// the way back to their queue. Once they leave, the memo is no longer theirs
// to open.
function MemoSignedView({ item, title, outcome }: MemoSignedViewProps) {
  const navigate = useNavigate();
  const [pdfError, setPdfError] = useState("");

  const pdfQuery = useQuery({
    queryKey: ["memo-pdf-signed", item.workflowId, item.stepId],
    queryFn: () => fetchMemoPdfSigned(item),
    retry: false,
    staleTime: 5 * 60_000,
  });

  function openPdf() {
    setPdfError("");
    const loaded = pdfQuery.data;

    openPdfInTab(() => (loaded ? Promise.resolve(loaded) : fetchMemoPdfSigned(item)), window.open("", "_blank")).catch(
      (error: unknown) => {
        console.error("Signed memo PDF failed:", error);
        setPdfError("Couldn't open the signed PDF. Try again.");
      },
    );
  }

  return (
    <>
      <p className="brd-status-message brd-status-message--icon" role="status">
        <CheckCircle2 size={17} aria-hidden="true" />
        <span>{OUTCOME_TEXT[outcome]}</span>
      </p>

      {pdfError && (
        <p className="form-error" role="alert">
          {pdfError}
        </p>
      )}

      <PdfCoverPreview
        blob={pdfQuery.data}
        isLoading={pdfQuery.isLoading}
        isError={pdfQuery.isError}
        title={title}
        hint="Open the memo to see it with your signature on it."
        onOpen={openPdf}
        openLabel="Open memo"
      />

      <MemoAttachmentsList memoId={item.memoId} />

      <div className="bdo-action-bar bdo-action-bar--static">
        <p className="bdo-action-bar_hint">You can't open this memo again once you leave this page.</p>

        <div className="brd-reviews-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate("/dashboard?filter=sign", { replace: true })}
          >
            Back to memos to sign
          </button>
        </div>
      </div>
    </>
  );
}

export default MemoSignedView;
