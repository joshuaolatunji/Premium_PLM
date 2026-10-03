import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getTicketsForLeadEngineer } from "../../mocks/ticketsMock";
import { getCurrentUserId } from "../../apicalls/authStorage";
import { ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";
import { capitalize } from "../../utils/text";

// Mocked — tickets have no real endpoint yet (see mocks/ticketsMock.ts).
function LeadEngineerDashboard() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const ticketsQuery = useQuery({
    queryKey: ["lead-engineer-tickets", currentUserId],
    queryFn: () => getTicketsForLeadEngineer(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);

  const initiativeQueries = useQueries({
    queries: tickets.map((ticket) => ({
      queryKey: ["product-initiative", ticket.initiativeId],
      queryFn: () => getInitiativeById(ticket.initiativeId),
      enabled: Boolean(ticket.initiativeId),
    })),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned",
    );
  }

  const isLoading = ticketsQuery.isLoading || initiativeQueries.some((query) => query.isLoading);
  const hasError = ticketsQuery.isError || initiativeQueries.some((query) => query.isError);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Tickets</p>

          <h1 className="dashboard-title">Lead Engineer workspace</h1>

          <p className="dashboard-subtitle">
            Tickets assigned to you, and the developers working on them.
          </p>
        </div>
      </header>

      <p className="mock-data-notice">
        Tickets are temporary, local-only data until the real tickets API is
        ready — they reset if you reload the page.
      </p>

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Ticket</th>
                <th>Timeline (days)</th>
                <th>Status</th>
                <th>Developer</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Loading your tickets…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={6} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your tickets. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                tickets.map((ticket, index) => {
                  const initiative = initiativeQueries[index]?.data;

                  return (
                    <tr key={ticket.id}>
                      <td>
                        <div className="initiative-cell">
                          <strong>{initiative?.projectName ?? "—"}</strong>
                          <span>{ticket.initiativeId.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>
                        <div className="initiative-cell">
                          <strong>{ticket.title}</strong>
                          <span>{ticket.description}</span>
                        </div>
                      </td>

                      <td>{ticket.timelineDaysAllocated ?? "—"}</td>

                      <td>
                        <span className={ticketStatusBadgeClass(ticket.status)}>
                          {ticketStatusLabel(ticket.status)}
                        </span>
                      </td>

                      <td>{userName(ticket.assignedDeveloperId)}</td>

                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() =>
                            navigate(`/dashboard/lead-engineer/tickets/${ticket.id}`)
                          }
                        >
                          {ticket.status === "UnderReview"
                            ? "Review"
                            : ticket.assignedDeveloperId
                              ? "View"
                              : "Assign developer"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    No tickets are currently assigned to you.
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
