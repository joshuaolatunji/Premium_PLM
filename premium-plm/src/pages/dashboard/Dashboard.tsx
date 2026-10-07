import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import DashboardHeader from "../../dashboardcomponents/DashboardHeader";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import PortfolioOverview from "../../dashboardcomponents/PortfolioOverview";
import BRDApprovalQueue from "../../dashboardcomponents/BRDApprovalQueue";
import PriorityDistribution from "../../dashboardcomponents/PriorityDistribution";
import AtRiskInitiatives from "../../dashboardcomponents/AtRiskInitiatives";
import RecentGovernanceActivity from "../../dashboardcomponents/RecentGovernanceActivity";
import CreateInitiativeModal from "../../dashboardcomponents/CreateInitiativeModal";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  deriveStatus,
  isAwaitingGroupHeadDecision,
  isBrdAwaitingGroupHeadDecision,
  priorityLabel,
} from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";

import type { DerivedStatus } from "../../utils/initiativeStatus";
import type { ProductProposal } from "../../types/proposalTypes";
import type {
  AtRiskInitiative,
  BRDQueueItem,
  DashboardStat,
  GovernanceActivity,
  InitiativeStatus,
  PortfolioInitiative,
  PriorityDistributionItem,
} from "../../types/dashboardTypes";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
  | "brds-awaiting"
  | "bdo-docs-awaiting"
  | "on-track"
  | "at-risk"
  | "overdue";

function Dashboard() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

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
    proposalQueries.some((query) => query.isLoading) ||
    discoveryQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError ||
    usersQuery.isError ||
    proposalQueries.some((query) => query.isError) ||
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
    return usersQuery.data?.find((user) => user.userId === userId)?.role.join(", ") ?? "";
  }

  if (isLoading || hasError) {
    return (
      <div className="dashboard-page">
        <DashboardHeader
          onOpenCreateInitiative={() => setIsCreateOpen(true)}
          overSlaBrdCount={0}
        />

        {isCreateOpen && (
          <CreateInitiativeModal onClose={() => setIsCreateOpen(false)} />
        )}

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
      proposal: proposalQueries[index]?.data ?? null,
      bdoId: initiative.bdoId,
      pmId: initiative.projectManagerId,
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

  // Excludes "Rejected" (inferred, same convention as "Draft"/"Approved")
  // — once the Group Head rejects a BRD, it goes back to the PM to revise
  // and shouldn't still count as awaiting a decision.
  const awaitingReview = rows.filter(
    (row): row is typeof row & { proposal: ProductProposal } =>
      Boolean(row.proposal) && isBrdAwaitingGroupHeadDecision(row.proposal!.status),
  );

  const overSlaCount = awaitingReview.filter(
    ({ proposal }) => (now - new Date(proposal.creationDate).getTime()) / MS_PER_DAY > 3,
  ).length;

  const bdoDocsAwaitingReviewCount = rows.filter(
    (row) => isAwaitingGroupHeadDecision(row.bdoSubmissionStatus),
  ).length;

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
      key: "brds-awaiting",
      stat: {
        label: "BRDs Awaiting Review",
        value: awaitingReview.length,
        description:
          overSlaCount > 0 ? `${overSlaCount} over 3 days waiting` : "None over 3 days",
        descriptionType: overSlaCount > 0 ? "danger" : "neutral",
      },
    },
    {
      key: "bdo-docs-awaiting",
      stat: {
        label: "BDO Docs Awaiting Review",
        value: bdoDocsAwaitingReviewCount,
        description: bdoDocsAwaitingReviewCount > 0 ? "Needs your decision" : "All caught up",
        descriptionType: bdoDocsAwaitingReviewCount > 0 ? "warning" : "neutral",
      },
    },
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
      case "brds-awaiting":
        return Boolean(row.proposal) && awaitingReview.some((r) => r.initiative.id === row.initiative.id);
      case "bdo-docs-awaiting":
        return isAwaitingGroupHeadDecision(row.bdoSubmissionStatus);
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
  ).map(({ initiative, status, daysLeft, proposal, bdoId, bdoSubmissionStatus }) => {
      const elapsedPct =
        initiative.timelineStartedAt && initiative.currentDeadline
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((now - new Date(initiative.timelineStartedAt).getTime()) /
                    (new Date(initiative.currentDeadline).getTime() -
                      new Date(initiative.timelineStartedAt).getTime())) *
                    100,
                ),
              ),
            )
          : null;

      const needsReview = isBrdAwaitingGroupHeadDecision(proposal?.status);

      return {
        id: initiative.id,
        name: initiative.projectName,
        reference: initiative.id.slice(0, 8),
        createdOn: formatShortDate(initiative.createdAt),
        priority: priorityLabel(initiative.priority),
        priorityValue: initiative.priority,
        currentStage: currentStageFor(bdoSubmissionStatus, proposal),
        owner: userName(bdoId),
        progress: elapsedPct,
        daysLeft,
        status: DERIVED_TO_LABEL[status],
        action: needsReview ? "Review" : "Open",
      };
    });

  const brdApprovalQueue: BRDQueueItem[] = awaitingReview
    .map(({ initiative, proposal, pmId }) => ({
      id: initiative.id,
      initiative: initiative.projectName,
      priority: priorityLabel(initiative.priority),
      priorityValue: initiative.priority,
      owner: userName(pmId),
      submittedDate: formatShortDate(proposal.creationDate),
      daysWaiting: Math.max(
        0,
        Math.floor((now - new Date(proposal.creationDate).getTime()) / MS_PER_DAY),
      ),
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 5);

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
    if (item.action === "Review") {
      navigate(`/dashboard/brd-reviews/${item.id}`);
    } else {
      navigate(`/dashboard/initiatives/${item.id}`);
    }
  }

  return (
    <div className="dashboard-page">
      <DashboardHeader
        onOpenCreateInitiative={() => setIsCreateOpen(true)}
        overSlaBrdCount={overSlaCount}
      />

      {isCreateOpen && (
        <CreateInitiativeModal onClose={() => setIsCreateOpen(false)} />
      )}

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

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
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

          <AtRiskInitiatives
            initiatives={atRiskInitiatives}
          />
        </div>

        <div className="dashboard-grid__sidebar">
          <BRDApprovalQueue
            items={brdApprovalQueue}
            onReview={(id) => navigate(`/dashboard/brd-reviews/${id}`)}
            onViewAll={() => navigate("/dashboard/brd-reviews")}
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
