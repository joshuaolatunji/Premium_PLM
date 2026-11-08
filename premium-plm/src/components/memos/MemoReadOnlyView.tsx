import type { Memo } from "../../types/memoTypes";
import { formatDate } from "../../utils/ticketStatus";
import ReadOnlyField from "../common/ReadOnlyField";
import RichTextContent from "../editor/RichTextContent";

// A submitted memo, read-only: the memo header fields, then its details.
function MemoReadOnlyView({ memo }: { memo: Memo }) {
  return (
    <>
      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Memo</h2>
            <p>
              {memo.memoNumber ? `${memo.memoNumber}, ` : ""}version {memo.version}.
            </p>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <ReadOnlyField label="To" value={memo.to} />
          <ReadOnlyField label="Thru" value={memo.thru} />
          <ReadOnlyField label="From" value={memo.from} />
          <ReadOnlyField label="Date" value={memo.date ? formatDate(memo.date) : ""} />
        </div>

        <div className="proposal-section">
          <ReadOnlyField label="Subject" value={memo.subject} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Memo Details</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="document-description-view">
            <RichTextContent html={memo.details} emptyText="No details were written." />
          </div>
        </div>
      </section>
    </>
  );
}

export default MemoReadOnlyView;
