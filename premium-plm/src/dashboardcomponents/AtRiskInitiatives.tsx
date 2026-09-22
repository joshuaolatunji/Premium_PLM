import { AlertTriangle, Ban, Clock3 } from "lucide-react";
import type { AtRiskInitiative } from "../../src/types/dashboardTypes";

interface AtRiskInitiativesProps {
  initiatives: AtRiskInitiative[];
}

function AtRiskInitiatives({
  initiatives,
}: AtRiskInitiativesProps) {
  function getStatusIcon(status: AtRiskInitiative["status"]) {
    switch (status) {
      case "Overdue":
        return <Clock3 size={15} />;

      case "Blocked":
        return <Ban size={15} />;

      default:
        return <AlertTriangle size={15} />;
    }
  }

  return (
    <section className="dashboard-panel risk-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>At-risk & overdue</h2>
          <p>
            Initiatives requiring management attention.
          </p>
        </div>

        <span className="risk-panel__count">
          {initiatives.length}
        </span>
      </div>

      <div className="risk-panel__list">
        {initiatives.map((initiative) => (
          <article
            key={initiative.id}
            className="risk-panel__item"
          >
            <div
              className={`risk-panel__icon risk-panel__icon--${initiative.status
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {getStatusIcon(initiative.status)}
            </div>

            <div className="risk-panel__content">
              <div className="risk-panel__title-row">
                <h3>{initiative.name}</h3>

                <span
                  className={`status-badge status-badge--${initiative.status
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {initiative.status}
                </span>
              </div>

              <p>{initiative.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AtRiskInitiatives;