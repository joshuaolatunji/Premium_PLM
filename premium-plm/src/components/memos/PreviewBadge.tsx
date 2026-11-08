import { MEMOS_PREVIEW } from "../../config/features";

// Marks memos as a preview until the backend finishes access control, the
// review stage and author-started signing (gaps M33, M26, M34, M35).
// Goes away when VITE_MEMOS_LIVE is "true".
function PreviewBadge({ className = "" }: { className?: string }) {
  if (!MEMOS_PREVIEW) return null;

  return (
    <span
      className={`preview-badge ${className}`.trim()}
      data-tooltip="In preview until memo access control, review and signing are finished"
    >
      Preview
    </span>
  );
}

export default PreviewBadge;
