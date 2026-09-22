import { ChevronRight } from "lucide-react";
import type { BRDQueueItem } from "../../src/types/dashboardTypes";

interface BRDApprovalQueueProps {
  items: BRDQueueItem[];
}

function BRDApprovalQueue({
  items,
}: BRDApprovalQueueProps) {
  return (
    <section className="dashboard-panel brd-queue">
      <div className="dashboard-panel__header">
        <div>
          <h2>BRD approval queue</h2>
          <p>Proposals waiting for your decision.</p>
        </div>

        <button type="button" className="text-button">
          View all
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="brd-queue__list">
        {items.map((item) => (
          <article
            key={item.id}
            className="brd-queue__item"
          >
            <div className="brd-queue__top">
              <div className="brd-queue__initiative">
                <h3>{item.initiative}</h3>
                <span>{item.owner}</span>
              </div>

              <span className="priority-badge">
                {item.priority}
              </span>
            </div>

            <div className="brd-queue__meta">
              <span>
                Submitted {item.submittedDate}
              </span>

              <span
                className={
                  item.daysWaiting > 3
                    ? "brd-wait brd-wait--overdue"
                    : "brd-wait"
                }
              >
                {item.daysWaiting}{" "}
                {item.daysWaiting === 1 ? "day" : "days"} waiting
              </span>
            </div>

            <button
              type="button"
              className="brd-queue__review"
            >
              Review BRD
              <ChevronRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default BRDApprovalQueue;