import DashboardHeader from "../../features/dashboard/components/DashboardHeader";
import DashboardStatCard from "../../features/dashboard/components/DashboardStatCard";
import PortfolioOverview from "../../features/dashboard/components/PortfolioOverview";
import BRDApprovalQueue from "../../features/dashboard/components/BRDApprovalQueue";
import PriorityDistribution from "../../features/dashboard/components/PriorityDistribution";
import AtRiskInitiatives from "../../features/dashboard/components/AtRiskInitiatives";
import RecentGovernanceActivity from "../../features/dashboard/components/RecentGOvernanceActivity";

import {
  dashboardStats,
  portfolioInitiatives,
  brdApprovalQueue,
  priorityDistribution,
  atRiskInitiatives,
  recentGovernanceActivity,
} from "../../features/dashboard/data/dashboardMockData";

function Dashboard() {
  return (
    <div className="dashboard-page">
      <DashboardHeader />

      <section
        className="dashboard-stats"
        aria-label="Portfolio summary"
      >
        {dashboardStats.map((stat) => (
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
          />

          <AtRiskInitiatives
            initiatives={atRiskInitiatives}
          />
        </div>

        <div className="dashboard-grid__sidebar">
          <BRDApprovalQueue
            items={brdApprovalQueue}
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