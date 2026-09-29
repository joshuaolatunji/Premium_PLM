import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";
import type { Ticket } from "../../types/ticketTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";

// Tickets themselves are mocked (see mocks/ticketsMock.ts) — the initiative
// list they're grouped under is real (getMyAssignedInitiatives).
function MyTickets() {
  const navigate = useNavigate();

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  const ticketQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["tickets", initiative.id],
      queryFn: () => getTicketsForInitiative(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  function userName(userId: string) {
    return usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned";
  }

  const isLoading = initiativesQuery.isLoading || ticketQueries.some((query) => query.isLoading);
  const hasError = initiativesQuery.isError || ticketQueries.some((query) => query.isError);

  const rows: { initiative: ProductInitiative; ticket: Ticket }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const tickets = ticketQueries[index]?.data ?? [];
      tickets.forEach((ticket) => rows.push({ initiative, ticket }));
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Tickets</p>

          <h1 className="dashboard-title">Tickets</h1>

          <p className="dashboard-subtitle">
            Every ticket across your assigned initiatives.
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
                <th>Lead Engineer</th>
                <th>Timeline (days)</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Loading tickets…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={6} className="initiatives-empty initiatives-empty--error">
                    Couldn't load tickets. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                rows.map(({ initiative, ticket }) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="initiative-cell">
                        <strong>{initiative.projectName}</strong>
                        <span>{initiative.id.slice(0, 8)}</span>
                      </div>
                    </td>

                    <td>
                      <div className="initiative-cell">
                        <strong>{ticket.title}</strong>
                        <span>{ticket.description}</span>
                      </div>
                    </td>

                    <td>{userName(ticket.assignedLeadEngineerId)}</td>

                    <td>{ticket.timelineDaysAllocated ?? "—"}</td>

                    <td>
                      <span className={ticketStatusBadgeClass(ticket.status)}>
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          navigate(`/dashboard/initiatives/${initiative.id}/tickets`)
                        }
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    No tickets yet. Create one from an initiative's Tickets page.
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

export default MyTickets;
