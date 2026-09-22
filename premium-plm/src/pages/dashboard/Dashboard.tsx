import DashboardHeader from "../../dashboardcomponents/DashboardHeader";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import PortfolioOverview from "../../dashboardcomponents/PortfolioOverview";
import BRDApprovalQueue from "../../dashboardcomponents/BRDApprovalQueue";
import PriorityDistribution from "../../dashboardcomponents/PriorityDistribution";
import AtRiskInitiatives from "../../dashboardcomponents/AtRiskInitiatives";
import RecentGovernanceActivity from "../../dashboardcomponents/RecentGovernanceActivity";

import {
  dashboardStats,
  portfolioInitiatives,
  brdApprovalQueue,
  priorityDistribution,
  atRiskInitiatives,
  recentGovernanceActivity,
} from "../../data/dashboardMockData";

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