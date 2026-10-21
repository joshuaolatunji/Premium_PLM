import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getAllUsers } from "../../service/UserService";
import { getCurrentUserId } from "../../apicalls/authStorage";
import {
  isAwaitingGroupHeadDecision,
  priorityBadgeClass,
  priorityLabel,
} from "../../utils/initiativeStatus";
import { currentTimestamp, daysSince, useInitiativeDocuments } from "../../utils/documentStatus";
import { documentReviewPath } from "../../utils/documentRoutes";
import { capitalize } from "../../utils/text";
import { DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType, InitiativeDocuments } from "../../types/documentTypes";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import ApprovalQueue from "../../dashboardcomponents/ApprovalQueue";
import type { ApprovalQueueItem, DashboardStat } from "../../types/dashboardTypes";

// "NotStarted" is our own placeholder for "no discovery record exists
// yet" (the real API has no concept of it). "Submitted", "Resubmitted",
// and "Rejected" are confirmed live; "Approved" follows the same pattern
// but hasn't been directly observed yet.
const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not started",
  Submitted: "Submitted for approval",
  Resubmitted: "Resubmitted for approval",
  Approved: "Approved",
  Rejected: "Rejected",
};

function statusBadgeClass(status: string) {
  if (isAwaitingGroupHeadDecision(status)) {
    return "status-badge status-badge--awaiting-gh-documentation-approval";
  }

  switch (status) {
    case "Approved":
      return "status-badge status-badge--approved";
    case "Rejected":
      return "status-badge status-badge--bdo-documentation-rejected";
    default:
      return "status-badge status-badge--not-started";
  }
}

// Each summary card doubles as a filter for the table below — click to
// show only the initiatives behind its number, click again (or "Clear
// filter") to show them all. Same behaviour as the Group Head's and PM's
// dashboards.
// One "to review" card per document type (PID, FRD, BRD, SWR).
type ReviewFilter = `${DocumentType}-to-review`;
type CardFilter = "assigned" | "to-prepare" | "awaiting-gh" | "returned" | ReviewFilter;

function reviewFilterType(filter: CardFilter | null): DocumentType | null {
  return filter?.endsWith("-to-review") ? (filter.split("-")[0] as DocumentType) : null;
}

// The test behind each card, shared by the count and the table filter so
// clicking a card always shows exactly what it counted.
function matchesCard(
  filter: CardFilter | null,
  docsStatus: string,
  documents: InitiativeDocuments,
): boolean {
  const reviewType = reviewFilterType(filter);

  if (reviewType) {
    return documents[reviewType]?.status === "PendingBDOReview";
  }

  switch (filter) {
    case "to-prepare":
      // Still with the BDO: not submitted yet, not decided either way.
      return (
        !isAwaitingGroupHeadDecision(docsStatus) &&
        docsStatus !== "Approved" &&
        docsStatus !== "Rejected"
      );
    case "awaiting-gh":
      return isAwaitingGroupHeadDecision(docsStatus);
    case "returned":
      return docsStatus === "Rejected";
    default:
      return true;
  }
}

function BdoDashboard() {
  const navigate = useNavigate();
  const [cardFilter, setCardFilter] = useState<CardFilter | null>(null);
  const currentUserId = getCurrentUserId();

  // Both GET /api/product-initiatives and /my-assigned are confirmed
  // (live-tested) to return 403 for the BDO role — a backend authorization
  // gap, reported to the backend team, not fixable from here. Left
  // pointing at /my-assigned (the same endpoint the PM workspace uses)
  // since that's the more likely one to end up authorized for BDO too;
  // swap this back to getProductInitiatives if the backend fixes the
  // other endpoint instead. The bdoId filter below is a client-side
  // safety net in case the endpoint ever returns a broader set than just
  // this BDO's own initiatives.
  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const assignedInitiatives = useMemo(
    () =>
      (initiativesQuery.data ?? []).filter(
        (initiative) => initiative.bdoId === currentUserId,
      ),
    [initiativesQuery.data, currentUserId],
  );

  const discoveryQueries = useQueries({
    queries: assignedInitiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  // PID / FRD / BRD / SWR for each initiative (mock — see DocumentService).
  const documents = useInitiativeDocuments(assignedInitiatives.map((initiative) => initiative.id));

  // Only used for the "From …" name in the approval queue; the page works
  // without it if the BDO can't read the user list.
  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  // "NotStarted" = no discovery record yet (see STATUS_LABEL above).
  const rowStatuses = useMemo(
    () =>
      assignedInitiatives.map((_initiative, index) => ({
        docs: discoveryQueries[index]?.data?.status ?? "NotStarted",
        documents: documents.documentsFor(index),
      })),
    [assignedInitiatives, discoveryQueries, documents],
  );

  const statCards: { key: CardFilter; stat: DashboardStat }[] = useMemo(() => {
    const count = (filter: CardFilter) =>
      rowStatuses.filter((row) => matchesCard(filter, row.docs, row.documents)).length;

    const toPrepare = count("to-prepare");
    const awaitingGroupHead = count("awaiting-gh");
    const returned = count("returned");
    const hasInitiatives = rowStatuses.length > 0;

    return [
      {
        key: "assigned",
        stat: {
          label: "Assigned initiatives",
          value: rowStatuses.length,
          description: "Assigned to you",
          descriptionType: "neutral",
        },
      },
      {
        key: "to-prepare",
        stat: {
          label: "Documentation to prepare",
          value: toPrepare,
          description:
            toPrepare > 0 ? "Not yet submitted" : hasInitiatives ? "All submitted" : "No initiatives yet",
          descriptionType: toPrepare > 0 ? "warning" : hasInitiatives ? "success" : "neutral",
        },
      },
      {
        key: "awaiting-gh",
        stat: {
          label: "Awaiting Group Head",
          value: awaitingGroupHead,
          description: awaitingGroupHead > 0 ? "Submitted for approval" : "None pending",
          descriptionType: "neutral",
        },
      },
      {
        key: "returned",
        stat: {
          label: "Returned for rework",
          value: returned,
          description: returned > 0 ? "Fix and resubmit" : "Nothing returned",
          descriptionType: returned > 0 ? "danger" : "success",
        },
      },
      ...DOCUMENT_TYPES.map((type) => {
        const waiting = count(`${type}-to-review`);
        const stat: DashboardStat = {
          label: `${type}s to review`,
          value: waiting,
          description: waiting > 0 ? "Awaiting your decision" : "Queue clear",
          descriptionType: waiting > 0 ? "warning" : "success",
        };

        return { key: `${type}-to-review` as CardFilter, stat };
      }),
    ];
  }, [rowStatuses]);

  const activeCardLabel = statCards.find((card) => card.key === cardFilter)?.stat.label ?? null;

  const isLoading =
    initiativesQuery.isLoading ||
    documents.isLoading ||
    discoveryQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError || documents.isError || discoveryQueries.some((query) => query.isError);

  function pmName(userId: string | null) {
    const name = usersQuery.data?.find((user) => user.userId === userId)?.userName;
    return name ? capitalize(name) : "the Product Manager";
  }

  // Every document waiting on this BDO, longest-waiting first. Appears as
  // soon as the PM submits it.
  const now = currentTimestamp();
  const approvalQueue: ApprovalQueueItem[] = assignedInitiatives
    .flatMap((initiative, index) =>
      DOCUMENT_TYPES.flatMap((type) => {
        const document = rowStatuses[index]?.documents[type];

        if (document?.status !== "PendingBDOReview") {
          return [];
        }

        return [
          {
            key: `${initiative.id}-${type}`,
            initiativeId: initiative.id,
            initiative: initiative.projectName,
            documentLabel: type,
            priority: priorityLabel(initiative.priority),
            priorityValue: initiative.priority,
            submittedBy: pmName(initiative.projectManagerId),
            submittedDate: document.submittedAt
              ? new Date(document.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "—",
            daysWaiting: daysSince(document.submittedAt, now),
            reviewPath: documentReviewPath("BDO", type, initiative.id),
          },
        ];
      }),
    )
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Dashboard</p>

          <h1 className="dashboard-title">BDO workspace</h1>

          <p className="dashboard-subtitle">
            Initiatives the Group Head has assigned to you.
          </p>
        </div>
      </header>

      {!isLoading && !hasError && (
        <section className="dashboard-stats" aria-label="BDO workspace summary">
          {statCards.map(({ key, stat }) => (
            <DashboardStatCard
              key={key}
              stat={stat}
              isActive={cardFilter === key}
              onClick={() => setCardFilter((current) => (current === key ? null : key))}
            />
          ))}
        </section>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <section className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Assigned initiatives</h2>
                <p>
                  {activeCardLabel
                    ? `Filtered by "${activeCardLabel}".`
                    : "Prepare and submit the documentation for each initiative."}
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
                    <th>Documentation status</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={4} className="initiatives-empty">
                        Loading your assigned initiatives…
                      </td>
                    </tr>
                  )}

                  {hasError && (
                    <tr>
                      <td colSpan={4} className="initiatives-empty initiatives-empty--error">
                        Couldn't load your assigned initiatives. Try refreshing the page.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !hasError &&
                    assignedInitiatives.map((initiative, index) => {
                      const status = rowStatuses[index].docs;

                      if (!matchesCard(cardFilter, status, rowStatuses[index].documents)) {
                        return null;
                      }

                      // Under a "… to review" card the next step is that document,
                      // not the BDO documentation, so the row's action goes there.
                      const reviewType = reviewFilterType(cardFilter);

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
                            <span className={statusBadgeClass(status)}>
                              {STATUS_LABEL[status] ?? status}
                            </span>
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
                              className="table-action table-action--premium"
                              onClick={() =>
                                navigate(
                                  reviewType
                                    ? documentReviewPath("BDO", reviewType, initiative.id)
                                    : `/dashboard/bdo/${initiative.id}`,
                                )
                              }
                            >
                              {reviewType
                                ? `Review ${reviewType}`
                                : status === "NotStarted"
                                  ? "Start documentation"
                                  : status === "Approved"
                                    ? "View documentation"
                                    : "Continue documentation"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {!isLoading && !hasError && assignedInitiatives.length === 0 && (
                    <tr>
                      <td colSpan={4} className="initiatives-empty">
                        No initiatives are currently assigned to you.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !hasError &&
                    assignedInitiatives.length > 0 &&
                    activeCardLabel &&
                    !rowStatuses.some((row) => matchesCard(cardFilter, row.docs, row.documents)) && (
                      <tr>
                        <td colSpan={4} className="initiatives-empty">
                          No initiatives match "{activeCardLabel}".
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="dashboard-grid__sidebar">
          <ApprovalQueue
            items={approvalQueue}
            onReview={(item) => navigate(item.reviewPath)}
            description="Documents from your initiatives' Product Managers, waiting for your decision."
          />
        </div>
      </div>
    </div>
  );
}

export default BdoDashboard;
