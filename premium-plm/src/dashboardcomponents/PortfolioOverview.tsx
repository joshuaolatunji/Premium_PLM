import { ChevronRight } from "lucide-react";
import type { PortfolioInitiative } from "../../src/types/dashboardTypes";

interface PortfolioOverviewProps {
  initiatives: PortfolioInitiative[];
}

function PortfolioOverview({
  initiatives,
}: PortfolioOverviewProps) {
  return (
    <section className="dashboard-panel portfolio-overview">
      <div className="dashboard-panel__header">
        <div>
          <h2>Portfolio overview</h2>
          <p>All active initiatives across the product lifecycle.</p>
        </div>

        <button type="button" className="text-button">
          View all
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="portfolio-table-wrapper">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Initiative</th>
              <th>Priority</th>
              <th>Current stage</th>
              <th>Owner</th>
              <th>Progress</th>
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
                  <span className="priority-badge">
                    {initiative.priority}
                  </span>
                </td>

                <td>{initiative.currentStage}</td>

                <td>{initiative.owner}</td>

                <td>
                  {initiative.progress !== null ? (
                    <div className="progress-cell">
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${initiative.name} progress`}
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
                    className="table-action"
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