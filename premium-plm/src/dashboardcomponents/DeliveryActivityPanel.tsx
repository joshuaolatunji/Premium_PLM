import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Info, TriangleAlert, X } from "lucide-react";

import { getDeliveryActivity } from "../service/TicketService";
import type { DeliveryActivity } from "../types/ticketTypes";

function icon(tone: DeliveryActivity["tone"]) {
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

// Keeps the Group Head informed as tickets move through delivery: the PM
// sending one to a Lead Engineer, the Lead Engineer accepting it and
// assigning tasks, developers starting and submitting work, and the Lead
// Engineer's reviews. Newest first; each opens the initiative's tickets.
function DeliveryActivityPanel({ initiativeName }: DeliveryActivityPanelProps) {
  const navigate = useNavigate();

  const activityQuery = useQuery({
    queryKey: ["delivery-activity"],
    queryFn: () => getDeliveryActivity(12),
  });

  const activities = activityQuery.data ?? [];

  return (
    <section className="dashboard-panel governance-activity">
      <div className="dashboard-panel__header">
        <div>
          <h2>Delivery activity</h2>
          <p>Ticket and task updates from Product Managers, Lead Engineers and developers.</p>
        </div>
      </div>

      <div className="governance-activity__list">
        {activities.length === 0 && (
          <p className="approval-queue_empty">
            {activityQuery.isLoading ? "Loading…" : "No ticket or task updates yet."}
          </p>
        )}

        {activities.map((activity) => (
          <button
            type="button"
            key={activity.id}
            className="governance-activity__item delivery-activity_item"
            onClick={() => activity.initiativeId && navigate(`/dashboard/initiatives/${activity.initiativeId}/tickets`)}
          >
            <div className={`governance-activity__icon governance-activity__icon--${activity.tone}`}>
              {icon(activity.tone)}
            </div>

            <div className="governance-activity__content">
              <p className="governance-activity__action">{activity.action}</p>

              <p className="governance-activity__initiative">
                {activity.taskTitle ? `${activity.taskTitle} · ` : ""}
                {activity.ticketTitle}
                {initiativeName(activity.initiativeId) ? ` · ${initiativeName(activity.initiativeId)}` : ""}
              </p>

              <div className="governance-activity__meta">
                <span>
                  {activity.actorName}
                  {activity.actorRole ? ` (${activity.actorRole})` : ""}
                </span>
                <span aria-hidden="true">·</span>
                <time dateTime={activity.at}>{when(activity.at)}</time>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="mock-data-notice delivery-activity_notice">
        Recorded on this browser until the backend notifies the Group Head of ticket and task updates (gaps
        file M21).
      </p>
    </section>
  );
}

export default DeliveryActivityPanel;
