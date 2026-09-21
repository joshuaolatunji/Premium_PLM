import type { PriorityDistributionItem } from "../types";

interface PriorityDistributionProps {
  items: PriorityDistributionItem[];
}

function PriorityDistribution({
  items,
}: PriorityDistributionProps) {
  const total = items.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <section className="dashboard-panel priority-distribution">
      <div className="dashboard-panel__header">
        <h2>Priority distribution</h2>
      </div>

      <ul className="priority-distribution__list">
        {items.map((item) => {
          const tone = item.priority.replace("#", "");
          const percentage =
            total === 0 ? 0 : (item.count / total) * 100;

          return (
            <li
              key={item.priority}
              className="priority-distribution__item"
            >
              <div className="priority-distribution__row">
                <span className="priority-distribution__label">
                  <span
                    className={`priority-distribution__rank priority-distribution__rank--${tone}`}
                  >
                    {item.priority}
                  </span>
                  {item.label}
                </span>

                <span className="priority-distribution__count">
                  {item.count}
                </span>
              </div>

              <div
                className="priority-distribution__track"
                role="img"
                aria-label={`${item.label}: ${item.count} of ${total}`}
              >
                <span
                  className={`priority-distribution__fill priority-distribution__fill--${tone}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default PriorityDistribution;
