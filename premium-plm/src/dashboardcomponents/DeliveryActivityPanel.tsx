import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Check, Info, TriangleAlert, X } from "lucide-react";

import { describeActivity, getProjectActivity } from "../service/ActivityService";
import type { ActivityTone } from "../service/ActivityService";

function icon(tone: ActivityTone) {
  switch (tone) {
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

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DeliveryActivityPanelProps {
  // The initiative's name from its id (the dashboard already has the list).
  initiativeName: (initiativeId: string) => string | null;
}

// Keeps the Group Head informed of everything happening on every product:
// initiatives, the BDO's documentation, the PID / FRD / BRD / SWR and their
// reviews, sign-offs, tickets and developer tasks. Newest first; each opens
// where it happened.
function DeliveryActivityPanel({ initiativeName }: DeliveryActivityPanelProps) {
  const navigate = useNavigate();

  const activityQuery = useQuery({
    queryKey: ["project-activity", "latest"],
    queryFn: () => getProjectActivity(12),
  });

  const activities = activityQuery.data ?? [];

  return (
    <section className="dashboard-panel governance-activity">
      <div className="dashboard-panel__header">
        <div>
          <h2>Project activity</h2>
          <p>Everything done on your products, by everyone involved.</p>
        </div>

        <Link to="/dashboard/notifications" className="table-action table-action--dark">
          View all
        </Link>
      </div>

      <div className="governance-activity__list">
        {activities.length === 0 && (
          <p className="approval-queue_empty">{activityQuery.isLoading ? "Loading…" : "No activity yet."}</p>
        )}

        {activities.map((activity) => {
          const initiative = initiativeName(activity.initiativeId) ?? activity.initiativeName;

          return (
            <button
              type="button"
              key={activity.id}
              className="governance-activity__item delivery-activity_item"
              onClick={() => navigate(activity.link)}
            >
              <div className={`governance-activity__icon governance-activity__icon--${activity.tone}`}>
                {icon(activity.tone)}
              </div>

              <div className="governance-activity__content">
                <p className="governance-activity__action">{describeActivity(activity)}</p>

                {(initiative || activity.detail) && (
                  <p className="governance-activity__initiative">
                    {[initiative, activity.detail].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="governance-activity__meta">
                  <span className="activity-area">{activity.area}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={activity.at}>{when(activity.at)}</time>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mock-data-notice delivery-activity_notice">
        Recorded on this browser until the backend notifies the Group Head of every action (gaps file M21).
      </p>
    </section>
  );
}

export default DeliveryActivityPanel;
