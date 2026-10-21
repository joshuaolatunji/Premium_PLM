import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  deriveStatus,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
} from "../../utils/initiativeStatus";
import {
  documentationProgress,
  documentStatusLabel,
  isInReview,
  nextDocumentToWorkOn,
  useInitiativeDocuments,
} from "../../utils/documentStatus";
import { documentEditorPath } from "../../utils/documentRoutes";
import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { backState } from "../../utils/navigation";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import type { DashboardStat } from "../../types/dashboardTypes";

// Each summary card doubles as a filter for the "My initiatives" table —
// click to show only the initiatives behind its number, click again (or
// "Clear filter") to show them all. Same behaviour as the Group Head's
// dashboard cards.
type CardFilter =
  | "active"
  | "docs-not-started"
  | "docs-in-review"
  | "docs-returned"
  | "open-tickets"
  | "deadline-alerts";

function breakdown(types: DocumentType[]): string {
  return DOCUMENT_TYPES.map((type) => ({ type, count: types.filter((t) => t === type).length }))
    .filter(({ count }) => count > 0)
    .map(({ type, count }) => `${type} ${count}`)
    .join(" · ");
}

function MyWork() {
  const navigate = useNavigate();
  const [cardFilter, setCardFilter] = useState<CardFilter | null>(null);

  // Real — the create-initiative endpoint now sets projectManagerId for
  // real, and this endpoint filters by it server-side.
  const assignedInitiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const initiatives = useMemo(
    () => assignedInitiativesQuery.data ?? [],
    [assignedInitiativesQuery.data],
  );

  // The four documents (PID, FRD, BRD, SWR) and one ticket-count lookup per
  // assigned initiative, run in parallel. Fine at the scale this list runs
  // at (a PM's own initiatives, typically a handful).
  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  const ticketQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["tickets", initiative.id],
      queryFn: () => getTicketsForInitiative(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  // "Start documentation" stays disabled until this is "Approved" — the PM's whole
  // workflow begins once the Group Head approves the BDO's documentation.
  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    assignedInitiativesQuery.isLoading ||
    documents.isLoading ||
    discoveryQueries.some((query) => query.isLoading);
  const hasError =
    assignedInitiativesQuery.isError || documents.isError || discoveryQueries.some((query) => query.isError);

  // The facts every card and filter is derived from, worked out once per
  // initiative. A card's number and the rows it filters to always use the
  // same test, so clicking a card shows exactly what it counted.
  const rowFacts = useMemo(
    () =>
      initiatives.map((initiative, index) => {
        const initiativeDocuments = documents.documentsFor(index);
        // The BDO's documentation must be approved before any document can start.
        const readyForDocs = discoveryQueries[index]?.data?.status === "Approved";
        const openTickets = (ticketQueries[index]?.data ?? []).filter(
          (ticket) => ticket.status !== "Completed",
        ).length;

        return {
          id: initiative.id,
          readyForDocs,
          documents: initiativeDocuments,
          // Which document types are in each state — the cards count these.
          notStarted: readyForDocs ? DOCUMENT_TYPES.filter((type) => !initiativeDocuments[type]) : [],
          inReview: DOCUMENT_TYPES.filter((type) => isInReview(initiativeDocuments[type]?.status)),
          returned: DOCUMENT_TYPES.filter((type) => initiativeDocuments[type]?.status === "Rejected"),
          openTickets,
          // Relative to each initiative's own timeline (see deriveStatus), so
          // a short project isn't flagged from day one.
          deadlineStatus: deriveStatus(initiative).status,
        };
      }),
    [initiatives, documents, discoveryQueries, ticketQueries],
  );

  function matchesCardFilter(facts: (typeof rowFacts)[number]): boolean {
    switch (cardFilter) {
      case "docs-not-started":
        return facts.notStarted.length > 0;
      case "docs-in-review":
        return facts.inReview.length > 0;
      case "docs-returned":
        return facts.returned.length > 0;
      case "open-tickets":
        return facts.openTickets > 0;
      case "deadline-alerts":
        return facts.deadlineStatus === "at-risk" || facts.deadlineStatus === "overdue";
      default:
        return true;
    }
  }

  const statCards: { key: CardFilter; stat: DashboardStat }[] = useMemo(() => {
    const readyForDocs = rowFacts.filter((facts) => facts.readyForDocs).length;
    const notStarted = rowFacts.flatMap((facts) => facts.notStarted);
    const inReview = rowFacts.flatMap((facts) => facts.inReview);
    const returned = rowFacts.flatMap((facts) => facts.returned);
    const openTickets = rowFacts.reduce((total, facts) => total + facts.openTickets, 0);
    const initiativesWithOpenTickets = rowFacts.filter((facts) => facts.openTickets > 0).length;
    const overdue = rowFacts.filter((facts) => facts.deadlineStatus === "overdue").length;
    const atRisk = rowFacts.filter((facts) => facts.deadlineStatus === "at-risk").length;

    return [
      {
        key: "active",
        stat: {
          label: "Active initiatives",
          value: rowFacts.length,
          description: "Assigned to you",
          descriptionType: "neutral",
        },
      },
      {
        key: "docs-not-started",
        stat: {
          label: "Documents not started",
          value: notStarted.length,
          // A zero can mean three different things, so the caption says which.
          description:
            notStarted.length > 0
              ? breakdown(notStarted)
              : readyForDocs > 0
                ? "All started"
                : rowFacts.length > 0
                  ? "Awaiting BDO docs approval"
                  : "No initiatives yet",
          descriptionType:
            notStarted.length > 0 ? "warning" : readyForDocs > 0 ? "success" : "neutral",
        },
      },
      {
        key: "docs-in-review",
        stat: {
          label: "Documents in review",
          value: inReview.length,
          description: inReview.length > 0 ? breakdown(inReview) : "None in review",
          descriptionType: "neutral",
        },
      },
      {
        key: "docs-returned",
        stat: {
          label: "Documents returned",
          value: returned.length,
          description: returned.length > 0 ? `${breakdown(returned)} · revise and resubmit` : "Nothing returned",
          descriptionType: returned.length > 0 ? "danger" : "success",
        },
      },
      {
        key: "open-tickets",
        stat: {
          label: "Open tickets",
          value: openTickets,
          description:
            openTickets > 0
              ? `Across ${initiativesWithOpenTickets} initiative${initiativesWithOpenTickets === 1 ? "" : "s"}`
              : "No open tickets",
          descriptionType: "neutral",
        },
      },
      {
        key: "deadline-alerts",
        stat: {
          label: "Deadline alerts",
          value: overdue + atRisk,
          description:
            overdue + atRisk > 0 ? `${overdue} overdue · ${atRisk} at risk` : "All on schedule",
          descriptionType: overdue > 0 ? "danger" : atRisk > 0 ? "warning" : "success",
        },
      },
    ];
  }, [rowFacts]);

  const activeCardLabel = statCards.find((card) => card.key === cardFilter)?.stat.label ?? null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / My work</p>

          <h1 className="dashboard-title">My work</h1>

          <p className="dashboard-subtitle">
            Initiatives assigned to you, and the documents (PID, FRD, BRD, SWR) they need.
          </p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="My work summary">
        {statCards.map(({ key, stat }) => (
          <DashboardStatCard
            key={key}
            stat={stat}
            isActive={cardFilter === key}
            onClick={() => setCardFilter((current) => (current === key ? null : key))}
          />
        ))}
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>My initiatives</h2>
            <p>
              {activeCardLabel
                ? `Filtered by "${activeCardLabel}".`
                : "Initiatives where you're the assigned product manager."}
            </p>
          </div>

          {activeCardLabel && (
            <button type="button" className="text-button" onClick={() => setCardFilter(null)}>
              Clear filter
              <X size={15} />
            </button>
          )}
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Current stage</th>
                <th>Days left</th>
                <th>Tickets</th>
                <th>Documents</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    Loading your initiatives…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={7} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your initiatives. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                initiatives.map((initiative, index) => {
                  if (!matchesCardFilter(rowFacts[index])) {
                    return null;
                  }

                  const { daysLeft } = deriveStatus(initiative);
                  const facts = rowFacts[index];
                  const progress = documentationProgress(facts.documents);
                  const ticketCount = ticketQueries[index]?.data?.length ?? 0;
                  const bdoSubmissionStatus =
                    discoveryQueries[index]?.data?.status ?? "NotStarted";
                  const bdoDocsApproved = bdoSubmissionStatus === "Approved";
                  const stage = currentStageFor(bdoSubmissionStatus, facts.documents);
                  const nextType = nextDocumentToWorkOn(facts.documents);

                  return (
                    <tr key={initiative.id}>
                      <td>
                        <div className="initiative-cell">
                          <strong title={initiative.projectName}>{initiative.projectName}</strong>
                          <span>{initiative.id.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>
                        <span className={priorityBadgeClass(initiative.priority)}>
                          {priorityLabel(initiative.priority)}
                        </span>
                      </td>

                      <td>
                        <span className={stageBadgeClass(stage)}>{stage}</span>
                      </td>

                      <td>
                        {daysLeft === null ? (
                          <span className="portfolio-empty-value">—</span>
                        ) : (
                          <span
                            className={
                              daysLeft < 0
                                ? "days-left days-left--overdue"
                                : "days-left"
                            }
                          >
                            {daysLeft < 0
                              ? `${Math.abs(daysLeft)}d overdue`
                              : `${daysLeft}d`}
                          </span>
                        )}
                      </td>

                      <td>{ticketCount}</td>

                      <td>
                        <div className="document-chips">
                          {DOCUMENT_TYPES.map((type) => (
                            <span
                              key={type}
                              className={`document-chip document-chip--${facts.documents[type]?.status ?? "none"}`}
                              title={`${DOCUMENT_META[type].name}: ${documentStatusLabel(facts.documents[type]?.status)}`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="brd-reviews-actions">
                        <button
                          type="button"
                          className="table-action table-action--dark"
                          onClick={() => navigate(`/dashboard/initiatives/${initiative.id}`)}
                        >
                          View initiative
                        </button>

                        <button
                          type="button"
                          className="table-action table-action--dark"
                          onClick={() =>
                            navigate(`/dashboard/initiatives/${initiative.id}/tickets`)
                          }
                        >
                          Tickets
                        </button>

                        <button
                          type="button"
                          className="table-action table-action--premium"
                          // Opens the first document still needing work (the PID
                          // to begin with); the others are a tab away.
                          onClick={() =>
                            navigate(documentEditorPath(initiative.id, nextType), {
                              state: backState("Back to my work"),
                            })
                          }
                          disabled={!bdoDocsApproved}
                          title={
                            !bdoDocsApproved
                              ? "Available once the BDO's documentation is approved"
                              : undefined
                          }
                        >
                          {progress.allApproved
                            ? "View documentation"
                            : progress.started > 0
                              ? "Continue documentation"
                              : "Start documentation"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && initiatives.length === 0 && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    No initiatives are currently assigned to you.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                initiatives.length > 0 &&
                activeCardLabel &&
                !rowFacts.some(matchesCardFilter) && (
                  <tr>
                    <td colSpan={7} className="initiatives-empty">
                      No initiatives match "{activeCardLabel}".
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

export default MyWork;
