import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Check, Info, X } from "lucide-react";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { capitalize } from "../../utils/text";
import { isAwaitingGroupHeadDecision } from "../../utils/initiativeStatus";

interface AuditEvent {
  id: string;
  timestamp: string;
  description: string;
  initiativeName: string;
  type: "success" | "info" | "danger";
  isMocked: boolean;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// There's no real audit-log endpoint — every event here is derived from
// state other screens already fetch. Initiative creation, BRD dates, and
// BDO documentation submit/approve/reject events are all real now; only
// the BRD's BDO-leg rejection and ticket creation are still backed by
// session-only mocks (see mocks/*.ts), resetting on reload same as
// everywhere else that uses them.
function AuditTrail() {
  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const ticketQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["tickets", initiative.id],
      queryFn: () => getTicketsForInitiative(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading ||
    usersQuery.isLoading ||
    proposalQueries.some((q) => q.isLoading) ||
    discoveryQueries.some((q) => q.isLoading) ||
    ticketQueries.some((q) => q.isLoading);

  const hasError =
    initiativesQuery.isError ||
    usersQuery.isError ||
    proposalQueries.some((q) => q.isError) ||
    discoveryQueries.some((q) => q.isError) ||
    ticketQueries.some((q) => q.isError);

  function userName(userId: string | null) {
    if (!userId) {
      return "Someone";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Someone",
    );
  }

  const events: AuditEvent[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      events.push({
        id: `init-created-${initiative.id}`,
        timestamp: initiative.createdAt,
        description: `${userName(initiative.createdByUserId)} created the initiative`,
        initiativeName: initiative.projectName,
        type: "info",
        isMocked: false,
      });

      const proposal = proposalQueries[index]?.data;

      if (proposal) {
        events.push({
          id: `brd-drafted-${initiative.id}`,
          timestamp: proposal.creationDate,
          description: `BRD drafted (v${proposal.version})`,
          initiativeName: initiative.projectName,
          type: "info",
          isMocked: false,
        });

        if (proposal.status === "Approved" && proposal.updatedAt) {
          events.push({
            id: `brd-approved-${initiative.id}`,
            timestamp: proposal.updatedAt,
            description: "BRD approved by the Group Head",
            initiativeName: initiative.projectName,
            type: "success",
            isMocked: false,
          });
        }
      }

      const discovery = discoveryQueries[index]?.data;

      if (discovery && isAwaitingGroupHeadDecision(discovery.status)) {
        events.push({
          id: `bdo-doc-submitted-${initiative.id}`,
          timestamp: discovery.updatedAt,
          description: `${userName(discovery.createdByUserId)} submitted BDO documentation for approval`,
          initiativeName: initiative.projectName,
          type: "info",
          isMocked: false,
        });
      }

      if (discovery?.status === "Approved") {
        events.push({
          id: `bdo-doc-approved-${initiative.id}`,
          timestamp: discovery.updatedAt,
          description: `BDO documentation approved by ${userName(discovery.reviewedByUserId)}`,
          initiativeName: initiative.projectName,
          type: "success",
          isMocked: false,
        });
      }

      if (discovery?.status === "Rejected") {
        events.push({
          id: `bdo-doc-rejected-${initiative.id}`,
          timestamp: discovery.updatedAt,
          description: discovery.reviewComment
            ? `BDO documentation rejected by ${userName(discovery.reviewedByUserId)}: "${discovery.reviewComment}"`
            : `BDO documentation rejected by ${userName(discovery.reviewedByUserId)}`,
          initiativeName: initiative.projectName,
          type: "danger",
          isMocked: false,
        });
      }

      const tickets = ticketQueries[index]?.data ?? [];

      tickets.forEach((ticket) => {
        events.push({
          id: `ticket-created-${ticket.id}`,
          timestamp: ticket.createdAt,
          description: `Ticket "${ticket.title}" created`,
          initiativeName: initiative.projectName,
          type: "info",
          isMocked: true,
        });
      });
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  function icon(type: AuditEvent["type"]) {
    if (type === "success") return <Check size={13} />;
    if (type === "danger") return <X size={13} />;
    return <Info size={13} />;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Audit Trail</p>

          <h1 className="dashboard-title">Audit Trail</h1>

          <p className="dashboard-subtitle">
            Every recorded event across the portfolio, most recent first.
          </p>
        </div>
      </header>

      {/* <p className="mock-data-notice">
        There's no real audit-log endpoint yet — most of what's shown here
        (initiative creation, BRD dates, BDO documentation events) is real.
        Only the BRD's BDO-leg rejection and ticket creation are still
        backed by session-only mock data, and reset if you reload the page.
      </p> */}

      <section className="dashboard-panel governance-activity">
        {isLoading && <p className="initiatives-empty">Loading audit trail…</p>}

        {hasError && (
          <p className="initiatives-empty initiatives-empty--error">
            Couldn't load the audit trail. Try refreshing the page.
          </p>
        )}

        {!isLoading && !hasError && (
          <div className="governance-activity__list">
            {events.map((event) => (
              <article key={event.id} className="governance-activity__item">
                <div className={`governance-activity__icon governance-activity__icon--${event.type}`}>
                  {icon(event.type)}
                </div>

                <div className="governance-activity__content">
                  <p className="governance-activity__action">
                    {event.description}
                    {event.isMocked && (
                      <span className="admin-users-empty-roles"> (session-only)</span>
                    )}
                  </p>

                  <p className="governance-activity__initiative">{event.initiativeName}</p>

                  <div className="governance-activity__meta">
                    <time>{formatDateTime(event.timestamp)}</time>
                  </div>
                </div>
              </article>
            ))}

            {events.length === 0 && (
              <p className="initiatives-empty">No events recorded yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default AuditTrail;
