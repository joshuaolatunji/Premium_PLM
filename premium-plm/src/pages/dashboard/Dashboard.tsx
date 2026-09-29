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
import { getBdoAssignment } from "../../mocks/bdoAssignmentMock";
import { getSubmissionStatus } from "../../mocks/bdoDocumentsMock";
import { deriveStatus, priorityLabel } from "../../utils/initiativeStatus";
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

// No real field says whether a BRD is "in review", "rejected", etc. —
// `status` is a real string, but only "Draft" and "Approved" are
// confirmed values (see types/proposalTypes.ts). Anything else reads as a
// generic "under review" rather than guessing at an unobserved string.
function currentStageFor(proposal: ProductProposal | null): string {
  if (!proposal) {
    return "BRD not started";
  }

  if (proposal.status === "Draft") {
    return "BRD in progress";
  }

  if (proposal.status === "Approved") {
    return "Approved";
  }

  return "BRD under review";
}

function Dashboard() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  // Mocked — there's no real "who is the BDO" field yet (see
  // mocks/bdoAssignmentMock.ts). Backs the portfolio table's "Owner" column.
  // projectManagerId (used for the BRD queue's owner) is real now.
  const bdoAssignmentQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["bdo-assignment", initiative.id],
      queryFn: () => getBdoAssignment(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  // Mocked — there's no real endpoint for BDO documentation submission
  // status yet (see mocks/bdoDocumentsMock.ts). Backs the "BDO Docs
  // Awaiting Review" stat card below.
  const bdoSubmissionStatusQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["bdo-submission-status", initiative.id],
      queryFn: () => getSubmissionStatus(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading ||
    usersQuery.isLoading ||
    proposalQueries.some((query) => query.isLoading) ||
    bdoAssignmentQueries.some((query) => query.isLoading) ||
    bdoSubmissionStatusQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError ||
    usersQuery.isError ||
    proposalQueries.some((query) => query.isError) ||
    bdoAssignmentQueries.some((query) => query.isError) ||
    bdoSubmissionStatusQueries.some((query) => query.isError);

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned";
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
      bdoId: bdoAssignmentQueries[index]?.data?.bdoId ?? null,
      pmId: initiative.projectManagerId,
      bdoSubmissionStatus: bdoSubmissionStatusQueries[index]?.data ?? "NotStarted",
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

  const awaitingReview = rows.filter(
    (row): row is typeof row & { proposal: ProductProposal } =>
      Boolean(row.proposal) && row.proposal!.status !== "Draft",
  );

  const overSlaCount = awaitingReview.filter(
    ({ proposal }) => (now - new Date(proposal.creationDate).getTime()) / MS_PER_DAY > 3,
  ).length;

  const bdoDocsAwaitingReviewCount = rows.filter(
    (row) => row.bdoSubmissionStatus === "SubmittedForApproval",
  ).length;

  const onTrackCount = rows.filter((row) => row.status === "on-track").length;
  const atRiskCount = rows.filter((row) => row.status === "at-risk").length;
  const overdueCount = rows.filter((row) => row.status === "overdue").length;

  function portfolioPct(count: number) {
    return activeCount === 0 ? 0 : Math.round((count / activeCount) * 100);
  }

  const stats: DashboardStat[] = [
    {
      label: "Active Initiatives",
      value: activeCount,
      description: `${createdThisMonthCount} added this month`,
      descriptionType: "neutral",
    },
    {
      label: "BRDs Awaiting Review",
      value: awaitingReview.length,
      description: overSlaCount > 0 ? `${overSlaCount} over 3 days waiting` : "None over 3 days",
      descriptionType: overSlaCount > 0 ? "danger" : "neutral",
    },
    {
      label: "BDO Docs Awaiting Review",
      value: bdoDocsAwaitingReviewCount,
      description: bdoDocsAwaitingReviewCount > 0 ? "Needs your decision" : "All caught up",
      descriptionType: bdoDocsAwaitingReviewCount > 0 ? "warning" : "neutral",
    },
    {
      label: "On Track",
      value: onTrackCount,
      description: `${portfolioPct(onTrackCount)}% of portfolio`,
      descriptionType: "success",
    },
    {
      label: "At Risk",
      value: atRiskCount,
      description: `${portfolioPct(atRiskCount)}% of portfolio`,
      descriptionType: "warning",
    },
    {
      label: "Overdue",
      value: overdueCount,
      description: `${portfolioPct(overdueCount)}% of portfolio`,
      descriptionType: "danger",
    },
  ];

  const portfolioInitiatives: PortfolioInitiative[] = [...rows]
    .sort(
      (a, b) => new Date(b.initiative.createdAt).getTime() - new Date(a.initiative.createdAt).getTime(),
    )
    .slice(0, 8)
    .map(({ initiative, status, daysLeft, proposal, bdoId }) => {
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

      const needsReview = Boolean(proposal && proposal.status !== "Draft" && proposal.status !== "Approved");

      return {
        id: initiative.id,
        name: initiative.projectName,
        reference: initiative.id.slice(0, 8),
        priority: priorityLabel(initiative.priority),
        currentStage: currentStageFor(proposal),
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

      <p className="mock-data-notice">
        The portfolio table's "Owner" column and the "BDO Docs Awaiting
        Review" count reflect temporary, local-only BDO assignment/submission
        data until the real APIs are ready — they reset if you reload the
        page.
      </p>

      <section
        className="dashboard-stats"
        aria-label="Portfolio summary"
      >
        {stats.map((stat) => (
          <DashboardStatCard
            key={stat.label}
            stat={stat}
          />
        ))}
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <PortfolioOverview
            initiatives={portfolioInitiatives}
            onAction={handlePortfolioAction}
            onViewAll={() => navigate("/dashboard/initiatives")}
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
