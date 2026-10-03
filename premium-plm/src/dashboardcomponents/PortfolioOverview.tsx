import { ChevronRight, X } from "lucide-react";
import type { PortfolioInitiative } from "../../src/types/dashboardTypes";
import { priorityBadgeClass, stageBadgeClass } from "../../src/utils/initiativeStatus";

interface PortfolioOverviewProps {
  initiatives: PortfolioInitiative[];
  onAction: (initiative: PortfolioInitiative) => void;
  onViewAll: () => void;
  filterLabel?: string | null;
  onClearFilter?: () => void;
}

function PortfolioOverview({
  initiatives,
  onAction,
  onViewAll,
  filterLabel,
  onClearFilter,
}: PortfolioOverviewProps) {
  return (
    <section className="dashboard-panel portfolio-overview">
      <div className="dashboard-panel__header">
        <div>
          <h2>Portfolio overview</h2>
          <p>
            {filterLabel
              ? `Filtered by "${filterLabel}".`
              : "All active initiatives across the product lifecycle."}
          </p>
        </div>

        {filterLabel && onClearFilter ? (
          <button type="button" className="text-button" onClick={onClearFilter}>
            Clear filter
            <X size={15} />
          </button>
        ) : (
          <button type="button" className="text-button" onClick={onViewAll}>
            View all
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      <div className="portfolio-table-wrapper">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Initiative</th>
              <th>Priority</th>
              <th>Current stage</th>
              <th>Owner</th>
              <th>Timeline elapsed</th>
              <th>Days left</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {initiatives.map((initiative) => (
              <tr key={initiative.id}>
                <td>
                  <div className="initiative-cell">
                    <strong>{initiative.name}</strong>
                    <span>{initiative.reference}</span>
                  </div>
                </td>

                <td>
                  <span className={priorityBadgeClass(initiative.priorityValue)}>
                    {initiative.priority}
                  </span>
                </td>

                <td>
                  <span className={stageBadgeClass(initiative.currentStage)}>
                    {initiative.currentStage}
                  </span>
                </td>

                <td>{initiative.owner}</td>

                <td>
                  {initiative.progress !== null ? (
                    <div className="progress-cell">
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${initiative.name} timeline elapsed`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={initiative.progress}
                      >
                        <span
                          className="progress-fill"
                          style={{
                            width: `${initiative.progress}%`,
                          }}
                        />
                      </div>

                      <span>{initiative.progress}%</span>
                    </div>
                  ) : (
                    <span className="portfolio-empty-value">
                      —
                    </span>
                  )}
                </td>

                <td>
                  {initiative.daysLeft === null ? (
                    <span className="portfolio-empty-value">
                      —
                    </span>
                  ) : (
                    <span
                      className={
                        initiative.daysLeft < 0
                          ? "days-left days-left--overdue"
                          : "days-left"
                      }
                    >
                      {initiative.daysLeft < 0
                        ? `${Math.abs(
                            initiative.daysLeft,
                          )}d overdue`
                        : `${initiative.daysLeft}d`}
                    </span>
                  )}
                </td>

                <td>
                  <span
                    className={`status-badge status-badge--${initiative.status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {initiative.status}
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    className="table-action table-action--premium"
                    onClick={() => onAction(initiative)}
                  >
                    {initiative.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PortfolioOverview;