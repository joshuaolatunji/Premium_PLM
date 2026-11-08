import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { sileo } from "sileo";

import {
  attachmentName,
  formatFileSize,
  getMemoAttachments,
  memoAttachmentKeys,
  openMemoAttachment,
} from "../../service/MemoAttachmentService";
import type { MemoAttachment } from "../../service/MemoAttachmentService";
import { formatDate } from "../../utils/ticketStatus";
import { SHOW_MEMO_ATTACHMENTS } from "../../config/features";

// A coloured tag for the file's kind, from its name.
const KINDS: { kind: string; label: string; extensions: string[] }[] = [
  { kind: "pdf", label: "PDF", extensions: ["pdf"] },
  { kind: "doc", label: "DOC", extensions: ["doc", "docx", "rtf", "txt", "odt"] },
  { kind: "xls", label: "XLS", extensions: ["xls", "xlsx", "csv", "ods"] },
  { kind: "ppt", label: "PPT", extensions: ["ppt", "pptx", "odp"] },
  { kind: "img", label: "IMG", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
];

export function FileBadge({ name }: { name: string }) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const match = KINDS.find((item) => item.extensions.includes(extension));

  return (
    <span className={`memo-file-badge memo-file-badge--${match?.kind ?? "other"}`} aria-hidden="true">
      {match?.label ?? (extension.slice(0, 4).toUpperCase() || "FILE")}
    </span>
  );
}

// A memo's attachments, read-only: for its reviewers and approvers, and its
// author once it's out of their hands. Hidden when there are none, and
// entirely while memo attachments are switched off (gap M37).
function MemoAttachmentsList({ memoId }: { memoId: string }) {
  return SHOW_MEMO_ATTACHMENTS ? <AttachmentsList memoId={memoId} /> : null;
}

function AttachmentsList({ memoId }: { memoId: string }) {

  const query = useQuery({
    queryKey: memoAttachmentKeys.one(memoId),
    queryFn: () => getMemoAttachments(memoId),
    retry: false,
  });

  const items = query.data ?? [];

  if (query.isLoading || (query.isSuccess && items.length === 0)) {
    return null;
  }

  async function open(item: MemoAttachment) {
    try {
      await openMemoAttachment(item.id, window.open("", "_blank"));
    } catch {
      sileo.error({ title: "Couldn't open the file", description: `"${attachmentName(item)}". Try again.` });
    }
  }

  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>
            Attachments
            {items.length > 0 && <span className="memo-attach__count">{items.length}</span>}
          </h2>
          <p>Supporting files sent with the memo.</p>
        </div>
      </div>

      <div className="proposal-section">
        {query.isError ? (
          <p className="mock-data-notice">
            {query.error instanceof Error ? query.error.message : "Couldn't load the attachments."}
          </p>
        ) : (
          <ul className="memo-attach__list">
            {items.map((item) => (
              <li key={item.id} className="memo-attach__item">
                <FileBadge name={item.fileName} />

                <span className="memo-attach__meta">
                  <strong title={attachmentName(item)}>{attachmentName(item)}</strong>
                  <span>
                    {[item.label ? item.fileName : null, formatFileSize(item.size), item.uploadedAt && formatDate(item.uploadedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <button type="button" className="table-action table-action--dark" onClick={() => void open(item)}>
                  <ExternalLink size={14} aria-hidden="true" />
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default MemoAttachmentsList;
