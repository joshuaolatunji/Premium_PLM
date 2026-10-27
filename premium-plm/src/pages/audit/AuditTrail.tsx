import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Check, Info, X } from "lucide-react";

import { getProductInitiatives } from "../../service/InitiativeService";
import { DOCUMENT_TYPES } from "../../types/documentTypes";
import { useInitiativeDocuments } from "../../utils/documentStatus";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { capitalize } from "../../utils/text";
import { isAwaitingGroupHeadDecision } from "../../utils/initiativeStatus";
import { describeActivity, listActivity } from "../../service/ActivityService";
import type { ProjectActivity } from "../../service/ActivityService";

// Recorded actions this page already shows from the API's own data (the
// initiative's creation, document and BDO documentation submissions and
// decisions) are left out so they don't appear twice.
function isDerivedElsewhere(entry: ProjectActivity): boolean {
  if (entry.area !== "Initiative" && entry.area !== "Documents" && entry.area !== "BDO documentation") {
    return false;
  }

  return /^(created the initiative|started the (PID|FRD|BRD|SWR)|submitted|resubmitted|approved|returned)/.test(entry.action);
}

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
// state other screens already fetch. Initiative creation and BDO
// documentation submit/approve/reject events are real; PID / FRD / BRD /
// SWR events come from the document API (submit/decision times are approximate
// until it returns them) and ticket creation from the ticket mock, so those
// are marked as mocked.
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

  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading ||
    usersQuery.isLoading ||
    documents.isLoading ||
    discoveryQueries.some((q) => q.isLoading);

  const hasError =
    initiativesQuery.isError ||
    usersQuery.isError ||
    documents.isError ||
    discoveryQueries.some((q) => q.isError);

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

      const initiativeDocuments = documents.documentsFor(index);

      DOCUMENT_TYPES.forEach((type) => {
        const document = initiativeDocuments[type];

        if (!document) {
          return;
        }

        events.push({
          id: `${type}-drafted-${initiative.id}`,
          timestamp: document.createdAt,
          description: `${type} drafted by ${userName(document.createdByUserId)}`,
          initiativeName: initiative.projectName,
          type: "info",
          isMocked: true,
        });

        if (document.submittedAt && document.version > 0) {
          events.push({
            id: `${type}-submitted-${initiative.id}`,
            timestamp: document.submittedAt,
            description:
              document.status === "PendingGroupHeadReview" || document.status === "Approved"
                ? `${type} forwarded to the Group Head (v${document.version})`
                : `${type} submitted for review (v${document.version})`,
            initiativeName: initiative.projectName,
            type: "info",
            isMocked: true,
          });
        }

        const decision = document.lastDecision;

        if (decision) {
          const by =
            decision.reviewer === "BDO" ? "the BDO" : decision.reviewer === "GroupHead" ? "the Group Head" : "a reviewer";

          events.push({
            id: `${type}-decision-${initiative.id}`,
            timestamp: decision.decidedAt,
            description: decision.approved ? `${type} approved by ${by}` : `${type} returned by ${by}`,
            initiativeName: initiative.projectName,
            type: decision.approved ? "success" : "danger",
            isMocked: true,
          });
        }
      });

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
    });
  }

  // Everything else people did: sign-offs, tickets, tasks, uploads, saves…
  // recorded on this browser (gaps file M21).
  if (!isLoading && !hasError) {
    listActivity()
      .filter((entry) => !isDerivedElsewhere(entry))
      .forEach((entry) => {
        events.push({
          id: entry.id,
          timestamp: entry.at,
          description: entry.detail ? `${describeActivity(entry)}: ${entry.detail}` : describeActivity(entry),
          initiativeName:
            initiatives.find((initiative) => initiative.id === entry.initiativeId)?.projectName ??
            entry.initiativeName ??
            "",
          type: entry.tone === "success" ? "success" : entry.tone === "danger" ? "danger" : "info",
          isMocked: true,
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
                      <span className="admin-users-empty-roles"> (recorded on this browser)</span>
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
