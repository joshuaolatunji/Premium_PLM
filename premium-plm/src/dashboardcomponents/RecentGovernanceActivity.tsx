import {
  Check,
  ChevronRight,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

import type { GovernanceActivity } from "../../src/types/dashboardTypes";

interface RecentGovernanceActivityProps {
  activities: GovernanceActivity[];
}

function RecentGovernanceActivity({
  activities,
}: RecentGovernanceActivityProps) {
  function getActivityIcon(
    type: GovernanceActivity["type"],
  ) {
    switch (type) {
      case "success":
        return <Check size={13} />;

      case "warning":
        return <TriangleAlert size={13} />;

      case "danger":
        return <X size={13} />;

      default:
        return <Info size={13} />;
    }
  }

  return (
    <section className="dashboard-panel governance-activity">
      <div className="dashboard-panel__header">
        <div>
          <h2>Recent governance activity</h2>
          <p>
            Latest decisions and lifecycle events.
          </p>
        </div>

        <button type="button" className="text-button">
          Audit trail
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="governance-activity__list">
        {activities.map((activity) => (
          <article
            key={activity.id}
            className="governance-activity__item"
          >
            <div
              className={`governance-activity__icon governance-activity__icon--${activity.type}`}
            >
              {getActivityIcon(activity.type)}
            </div>

            <div className="governance-activity__content">
              <p className="governance-activity__action">
                {activity.action}
              </p>

              <p className="governance-activity__initiative">
                {activity.initiative}
              </p>

              <div className="governance-activity__meta">
                <span>{activity.role}</span>
                <span aria-hidden="true">·</span>
                <time>{activity.timestamp}</time>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default RecentGovernanceActivity;