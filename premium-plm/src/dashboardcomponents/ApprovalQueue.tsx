import { ChevronRight } from "lucide-react";
import type { ApprovalQueueItem } from "../../src/types/dashboardTypes";
import { priorityBadgeClass } from "../../src/utils/initiativeStatus";

interface ApprovalQueueProps {
  items: ApprovalQueueItem[];
  onReview: (item: ApprovalQueueItem) => void;
  description?: string;
}

// Everything waiting on this reviewer's decision — BDO documentation, PIDs,
// FRDs, BRDs and SWRs — in one list, longest-waiting first. Items appear as
// soon as they reach the reviewer's step. Shown on the Group Head's and the
// BDO's dashboards.
function ApprovalQueue({
  items,
  onReview,
  description = "Everything waiting for your decision.",
}: ApprovalQueueProps) {
  return (
    <section className="dashboard-panel brd-queue approval-queue">
      <div className="dashboard-panel__header">
        <div>
          <h2>
            Approval queue
            {items.length > 0 && <span className="approval-queue_count">{items.length}</span>}
          </h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="brd-queue__list approval-queue_list">
        {items.length === 0 && (
          <p className="approval-queue_empty">Nothing is waiting for your approval.</p>
        )}

        {items.map((item) => (
          <article key={item.key} className="brd-queue__item">
            <div className="brd-queue__top">
              <div className="brd-queue__initiative">
                <span className="approval-queue_type">{item.documentLabel}</span>
                <h3 title={item.initiative}>{item.initiative}</h3>
                <span>From {item.submittedBy}</span>
              </div>

              <span className={priorityBadgeClass(item.priorityValue)}>{item.priority}</span>
            </div>

            <div className="brd-queue__meta">
              <span>Submitted {item.submittedDate}</span>

              <span className={item.daysWaiting > 3 ? "brd-wait brd-wait--overdue" : "brd-wait"}>
                {item.daysWaiting} {item.daysWaiting === 1 ? "day" : "days"} waiting
              </span>
            </div>

            <button type="button" className="brd-queue__review" onClick={() => onReview(item)}>
              Review {item.documentLabel}
              <ChevronRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ApprovalQueue;
