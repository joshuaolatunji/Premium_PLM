import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import DashboardHeader from "../../dashboardcomponents/DashboardHeader";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import PortfolioOverview from "../../dashboardcomponents/PortfolioOverview";
import ApprovalQueue from "../../dashboardcomponents/ApprovalQueue";
import PriorityDistribution from "../../dashboardcomponents/PriorityDistribution";
import AtRiskInitiatives from "../../dashboardcomponents/AtRiskInitiatives";
import RecentGovernanceActivity from "../../dashboardcomponents/RecentGovernanceActivity";
import DeliveryActivityPanel from "../../dashboardcomponents/DeliveryActivityPanel";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  currentStageOwnerId,
  deriveStatus,
  isAwaitingGroupHeadDecision,
  priorityLabel,
  timelineElapsedPercent,
} from "../../utils/initiativeStatus";
import { capitalize, formatRoleName } from "../../utils/text";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import { DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { daysSince, useInitiativeDocuments } from "../../utils/documentStatus";
import { documentReviewPath } from "../../utils/documentRoutes";

import type { DerivedStatus } from "../../utils/initiativeStatus";
import type {
  ApprovalQueueItem,
  AtRiskInitiative,
  DashboardStat,
  GovernanceActivity,
  InitiativeStatus,
  PortfolioInitiative,
  PriorityDistributionItem,
} from "../../types/dashboardTypes";

const DERIVED_TO_LABEL: Record<DerivedStatus, InitiativeStatus> = {
  "not-started": "Not Started",
  "on-track": "On Track",
  "at-risk": "At Risk",
  overdue: "Overdue",
};

// Wrapping Date.now() in a plain (non-component) function keeps the
// react-hooks/purity rule happy — same pattern deriveStatus already uses.
function currentTimestamp(): number {
  return Date.now();
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type StatFilterKey =
  | "active"
  | "bdo-docs-awaiting"
  | `${DocumentType}-awaiting`
  | "on-track"
  | "at-risk"
  | "overdue";

function Dashboard() {
  const [statFilter, setStatFilter] = useState<StatFilterKey | null>(null);
  const navigate = useNavigate();

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const initiatives = initiativesQuery.data ?? [];

  // PID / FRD / BRD / SWR for every initiative (see DocumentService).
  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  // Backs the "BDO Docs Awaiting Review" stat card below.
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
    discoveryQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError ||
    usersQuery.isError ||
    documents.isError ||
    discoveryQueries.some((query) => query.isError);

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned",
    );
  }

  function userRole(userId: string) {
    return usersQuery.data?.find((user) => user.userId === userId)?.role.map(formatRoleName).join(", ") ?? "";
  }

  if (isLoading || hasError) {
    return (
      <div className="dashboard-page">
        <DashboardHeader
          onOpenCreateInitiative={() =>
          navigate("/dashboard/initiatives/new", { state: { from: "/dashboard" } })
        }
          overSlaApprovalCount={0}
        />

        {isLoading && <p className="initiatives-empty">Loading dashboard…</p>}

        {hasError && (
          <p className="initiatives-empty initiatives-empty--error">
            Couldn't load the dashboard. Try refreshing the page.
          </p>
        )}
      </div>
    );
  }

  const now = currentTimestamp();

  const rows = initiatives.map((initiative, index) => {
    const { status, daysLeft } = deriveStatus(initiative);

    return {
      initiative,
      status,
      daysLeft,
      documents: documents.documentsFor(index),
      discovery: discoveryQueries[index]?.data ?? null,
      bdoSubmissionStatus: discoveryQueries[index]?.data?.status ?? "NotStarted",
    };
  });

  const activeCount = rows.length;

  const today = new Date();
  const createdThisMonthCount = rows.filter(({ initiative }) => {
    const created = new Date(initiative.createdAt);
    return (
      created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear()
    );
  }).length;

  // Everything waiting on the Group Head's decision: BDO documentation and
  // any PID / FRD / BRD / SWR the BDO has forwarded. Appears here as soon as
  // it reaches the Group Head.
  const approvalQueue: ApprovalQueueItem[] = rows
    .flatMap(({ initiative, documents: initiativeDocuments, discovery, bdoSubmissionStatus }) => {
      const base = {
        initiativeId: initiative.id,
        initiative: initiative.projectName,
        priority: priorityLabel(initiative.priority),
        priorityValue: initiative.priority,
      };
      const items: ApprovalQueueItem[] = [];

      if (isAwaitingGroupHeadDecision(bdoSubmissionStatus)) {
        items.push({
          ...base,
          key: `${initiative.id}-bdo`,
          documentLabel: "BDO Docs",
          submittedBy: userName(initiative.bdoId),
          submittedDate: discovery?.updatedAt ? formatShortDate(discovery.updatedAt) : "—",
          daysWaiting: daysSince(discovery?.updatedAt, now),
          reviewPath: `/dashboard/bdo-reviews/${initiative.id}`,
        });
      }

      DOCUMENT_TYPES.forEach((type) => {
        const document = initiativeDocuments[type];

        if (document?.status === "PendingGroupHeadReview") {
          items.push({
            ...base,
            key: `${initiative.id}-${type}`,
            documentLabel: type,
            submittedBy: userName(initiative.projectManagerId),
            submittedDate: document.submittedAt ? formatShortDate(document.submittedAt) : "—",
            daysWaiting: daysSince(document.submittedAt, now),
            reviewPath: documentReviewPath("GroupHead", type, initiative.id),
          });
        }
      });

      return items;
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  const overSlaCount = approvalQueue.filter((item) => item.daysWaiting > 3).length;

  function awaitingItems(label: string) {
    return approvalQueue.filter((item) => item.documentLabel === label);
  }

  const bdoDocsAwaiting = awaitingItems("BDO Docs");

  const onTrackCount = rows.filter((row) => row.status === "on-track").length;
  const atRiskCount = rows.filter((row) => row.status === "at-risk").length;
  const overdueCount = rows.filter((row) => row.status === "overdue").length;

  function portfolioPct(count: number) {
    return activeCount === 0 ? 0 : Math.round((count / activeCount) * 100);
  }

  const statCards: { key: StatFilterKey; stat: DashboardStat }[] = [
    {
      key: "active",
      stat: {
        label: "Active Initiatives",
        value: activeCount,
        description: `${createdThisMonthCount} added this month`,
        descriptionType: "neutral",
      },
    },
    {
      key: "bdo-docs-awaiting",
      stat: {
        label: "BDO Docs Awaiting Review",
        value: bdoDocsAwaiting.length,
        description: bdoDocsAwaiting.length > 0 ? "Needs your decision" : "All caught up",
        descriptionType: bdoDocsAwaiting.length > 0 ? "warning" : "neutral",
      },
    },
    ...DOCUMENT_TYPES.map((type) => {
      const waiting = awaitingItems(type);
      const overSla = waiting.filter((item) => item.daysWaiting > 3).length;
      const stat: DashboardStat = {
        label: `${type}s Awaiting Review`,
        value: waiting.length,
        description:
          overSla > 0
            ? `${overSla} over 3 days waiting`
            : waiting.length > 0
              ? "Needs your decision"
              : "All caught up",
        descriptionType: overSla > 0 ? "danger" : waiting.length > 0 ? "warning" : "neutral",
      };

      return { key: `${type}-awaiting` as StatFilterKey, stat };
    }),
    {
      key: "on-track",
      stat: {
        label: "On Track",
        value: onTrackCount,
        description: `${portfolioPct(onTrackCount)}% of portfolio`,
        descriptionType: "success",
      },
    },
    {
      key: "at-risk",
      stat: {
        label: "At Risk",
        value: atRiskCount,
        description: `${portfolioPct(atRiskCount)}% of portfolio`,
        descriptionType: "warning",
      },
    },
    {
      key: "overdue",
      stat: {
        label: "Overdue",
        value: overdueCount,
        description: `${portfolioPct(overdueCount)}% of portfolio`,
        descriptionType: "danger",
      },
    },
  ];

  function matchesStatFilter(row: (typeof rows)[number]): boolean {
    switch (statFilter) {
      case "bdo-docs-awaiting":
        return isAwaitingGroupHeadDecision(row.bdoSubmissionStatus);
      case "PID-awaiting":
      case "FRD-awaiting":
      case "BRD-awaiting":
      case "SWR-awaiting":
        return row.documents[statFilter.split("-")[0] as DocumentType]?.status === "PendingGroupHeadReview";
      case "on-track":
        return row.status === "on-track";
      case "at-risk":
        return row.status === "at-risk";
      case "overdue":
        return row.status === "overdue";
      case "active":
      case null:
      default:
        return true;
    }
  }

  const filteredRows = statFilter ? rows.filter(matchesStatFilter) : rows;

  const sortedFilteredRows = [...filteredRows].sort(
    (a, b) => new Date(b.initiative.createdAt).getTime() - new Date(a.initiative.createdAt).getTime(),
  );

  // Capped to the 8 most recent only in the default, unfiltered view — once
  // a stat card narrows the list, show every match instead of hiding some
  // behind that cap.
  const portfolioInitiatives: PortfolioInitiative[] = (
    statFilter ? sortedFilteredRows : sortedFilteredRows.slice(0, 8)
  ).map(({ initiative, status, daysLeft, documents: initiativeDocuments, bdoSubmissionStatus }) => {
      const elapsedPct = timelineElapsedPercent(initiative);

      const needsReview = approvalQueue.some((item) => item.initiativeId === initiative.id);

      return {
        id: initiative.id,
        name: initiative.projectName,
        reference: initiative.id.slice(0, 8),
        createdOn: formatShortDate(initiative.createdAt),
        priority: priorityLabel(initiative.priority),
        priorityValue: initiative.priority,
        currentStage: currentStageFor(bdoSubmissionStatus, initiativeDocuments),
        owner: userName(currentStageOwnerId(bdoSubmissionStatus, initiativeDocuments, initiative)),
        progress: elapsedPct,
        daysLeft,
        status: DERIVED_TO_LABEL[status],
        action: needsReview ? "Review" : "Open",
      };
    });

  const priorityDistribution: PriorityDistributionItem[] = INITIATIVE_PRIORITIES.map((entry) => ({
    priority: `#${entry.value}`,
    label: entry.label,
    count: rows.filter((row) => row.initiative.priority === entry.value).length,
  }));

  const atRiskInitiatives: AtRiskInitiative[] = rows
    .filter((row) => row.status === "at-risk" || row.status === "overdue")
    .map(({ initiative, status, daysLeft }) => ({
      id: initiative.id,
      name: initiative.projectName,
      description:
        status === "overdue"
          ? `${Math.abs(daysLeft ?? 0)}d overdue on its timeline`
          : `${daysLeft}d left on its timeline`,
      status: status === "overdue" ? "Overdue" : "At Risk",
    }));

  const recentGovernanceActivity: GovernanceActivity[] = [...rows]
    .sort(
      (a, b) => new Date(b.initiative.createdAt).getTime() - new Date(a.initiative.createdAt).getTime(),
    )
    .slice(0, 6)
    .map(({ initiative }) => {
      const creatorName = userName(initiative.createdByUserId);

      return {
        id: initiative.id,
        action: `${creatorName} created the initiative`,
        initiative: initiative.projectName,
        actor: creatorName,
        role: userRole(initiative.createdByUserId),
        timestamp: formatShortDate(initiative.createdAt),
        type: "info",
      };
    });

  function handlePortfolioAction(item: PortfolioInitiative) {
    // "Review" opens the longest-waiting approval for that initiative.
    const pending = approvalQueue.find((queued) => queued.initiativeId === item.id);

    if (item.action === "Review" && pending) {
      navigate(pending.reviewPath);
    } else {
      navigate(`/dashboard/initiatives/${item.id}`);
    }
  }

  return (
    <div className="dashboard-page">
      <DashboardHeader
        onOpenCreateInitiative={() =>
          navigate("/dashboard/initiatives/new", { state: { from: "/dashboard" } })
        }
        overSlaApprovalCount={overSlaCount}
      />

      {/* <p className="mock-data-notice">
        The "BDO Docs Awaiting Review" count reflects temporary, local-only
        submission data until the real submission/review API is ready — it
        resets if you reload the page.
      </p> */}

      <section
        className="dashboard-stats"
        aria-label="Portfolio summary"
      >
        {statCards.map(({ key, stat }) => (
          <DashboardStatCard
            key={stat.label}
            stat={stat}
            isActive={statFilter === key}
            onClick={() =>
              setStatFilter((current) => (current === key ? null : key))
            }
          />
        ))}
      </section>

      {/* Full width so all nine columns fit without sideways scrolling; the
          other panels sit in the two-column grid below it. */}
      <div className="dashboard-portfolio">
        <PortfolioOverview
          initiatives={portfolioInitiatives}
          onAction={handlePortfolioAction}
          onViewAll={() => navigate("/dashboard/initiatives")}
          filterLabel={
            statFilter
              ? statCards.find((card) => card.key === statFilter)?.stat.label ?? null
              : null
          }
          onClearFilter={() => setStatFilter(null)}
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <AtRiskInitiatives
            initiatives={atRiskInitiatives}
          />

          <DeliveryActivityPanel
            initiativeName={(initiativeId) =>
              initiatives.find((initiative) => initiative.id === initiativeId)?.projectName ?? null
            }
          />
        </div>

        <div className="dashboard-grid__sidebar">
          <ApprovalQueue
            items={approvalQueue}
            onReview={(item) => navigate(item.reviewPath)}
          />

          <PriorityDistribution
            items={priorityDistribution}
          />

          <RecentGovernanceActivity
            activities={recentGovernanceActivity}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
