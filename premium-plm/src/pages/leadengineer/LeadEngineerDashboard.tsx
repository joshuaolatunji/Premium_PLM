import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getTasksForTicket, getTicketsForLeadEngineer } from "../../service/TicketService";
import { getCurrentUserId } from "../../apicalls/authStorage";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import { formatDate, ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

// The Lead Engineer's tickets: new ones to accept or reject, the ones being
// built (and the developer work waiting for their review), and finished ones.
function LeadEngineerDashboard() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  // M8 — from the local record until the API can list a Lead Engineer's tickets.
  const ticketsQuery = useQuery({
    queryKey: ["lead-engineer-tickets", currentUserId],
    queryFn: () => getTicketsForLeadEngineer(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);

  const initiativeQueries = useQueries({
    queries: [...new Set(tickets.map((ticket) => ticket.initiativeId))].map((initiativeId) => ({
      queryKey: ["product-initiative", initiativeId],
      queryFn: () => getInitiativeById(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  const taskQueries = useQueries({
    queries: tickets.map((ticket) => ({
      queryKey: ["ticket-tasks", ticket.id],
      queryFn: () => getTasksForTicket(ticket.id),
    })),
  });

  function initiativeName(initiativeId: string) {
    return initiativeQueries.find((query) => query.data?.id === initiativeId)?.data?.projectName ?? "—";
  }

  const rows = tickets.map((ticket, index) => {
    const tasks = taskQueries[index]?.data ?? [];

    return {
      ticket,
      tasks,
      toReview: tasks.filter((task) => task.status === "Submitted" || task.status === "UnderReview").length,
      approved: tasks.filter((task) => task.status === "Accepted").length,
    };
  });

  const newTickets = rows.filter((row) => row.ticket.status === "WithLeadEngineer").length;
  const building = rows.filter((row) => row.ticket.status === "Accepted" || row.ticket.status === "InProgress").length;
  const toReview = rows.reduce((total, row) => total + row.toReview, 0);
  const completed = rows.filter((row) => row.ticket.status === "Completed").length;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Tickets</p>

          <h1 className="dashboard-title">Lead Engineer workspace</h1>

          <p className="dashboard-subtitle">
            Tickets sent to you, the developer tasks you've split them into, and work waiting for your review.
          </p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Your tickets">
        <DashboardStatCard
          stat={{
            label: "New tickets",
            value: newTickets,
            description: newTickets > 0 ? "Accept or reject them" : "Nothing new",
            descriptionType: newTickets > 0 ? "warning" : "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "In progress",
            value: building,
            description: "Accepted and being built",
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Work to review",
            value: toReview,
            description: toReview > 0 ? "Developer tasks submitted to you" : "Nothing submitted",
            descriptionType: toReview > 0 ? "warning" : "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Completed",
            value: completed,
            description: "Tickets you've closed",
            descriptionType: "success",
          }}
        />
      </section>

      <p className="mock-data-notice">
        This list shows tickets sent from this browser until the backend can list a Lead Engineer's
        tickets (gaps file M8). Each ticket's page loads it live.
      </p>

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Target date</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {ticketsQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    Loading your tickets…
                  </td>
                </tr>
              )}

              {ticketsQuery.isError && (
                <tr>
                  <td colSpan={7} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your tickets. Try refreshing the page.
                  </td>
                </tr>
              )}

              {rows.map(({ ticket, tasks, toReview: submitted, approved }) => (
                <tr key={ticket.id}>
                  <td>
                    <div className="initiative-cell">
                      <strong title={ticket.title}>{ticket.title}</strong>
                      <span>{ticket.scope}</span>
                    </div>
                  </td>

                  <td>{initiativeName(ticket.initiativeId)}</td>

                  <td>
                    <span className={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>
                  </td>

                  <td>{formatDate(ticket.targetDate)}</td>

                  <td>
                    <span className={ticketStatusBadgeClass(ticket.status)}>{ticketStatusLabel(ticket.status)}</span>
                  </td>

                  <td>
                    {tasks.length === 0 ? "—" : `${approved} of ${tasks.length} done`}
                    {submitted > 0 && <span className="cell-note cell-note--alert"> · {submitted} to review</span>}
                  </td>

                  <td className="brd-reviews-actions">
                    <button
                      type="button"
                      className="table-action table-action--premium"
                      onClick={() => navigate(`/dashboard/lead-engineer/tickets/${ticket.id}`)}
                    >
                      {ticket.status === "WithLeadEngineer"
                        ? "Review ticket"
                        : submitted > 0
                          ? "Review work"
                          : ticket.status === "Accepted"
                            ? "Assign tasks"
                            : "Open"}
                    </button>
                  </td>
                </tr>
              ))}

              {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    No tickets have been sent to you yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default LeadEngineerDashboard;
