import { Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDashboardData } from "@/features/dashboard/hooks/use-dashboard-data";

import { AtRiskInitiatives } from "../components/at-risk-initiatives";
import { BRDApprovalQueue } from "../components/brd-approval-queue";
import { DashboardStatCard } from "../components/dashboard-stat-card";
import { PortfolioOverview } from "../components/portfolio-overview";
import { PriorityDistribution } from "../components/priority-distribution";
import { RecentGovernanceActivity } from "../components/recent-governance-activity";

function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[7.5rem] rounded-lg" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, errorMessage } = useDashboardData();

  const firstName = user?.userName?.split(" ")[0] ?? "there";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="PremiumPLM / Dashboard"
        title={`${data?.headline ?? "Welcome"}, ${firstName}`}
        description={
          data ? (
            <>
              {data.subtitle}
              <span aria-hidden="true"> · </span>
              <strong className="font-semibold text-destructive-text">
                {data.brdApprovalQueue.filter((item) => item.daysWaiting > 3).length}{" "}
                BRDs have been waiting more than 3 days.
              </strong>
            </>
          ) : null
        }
        actions={
          <>
            <Button variant="outline" size="lg">
              Manage priorities
            </Button>

            <Button size="lg">
              <Plus aria-hidden="true" />
              <span>New initiative</span>
            </Button>
          </>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <StatGridSkeleton />
      ) : (
        data && (
          <section
            aria-label="Portfolio summary"
            className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            {data.stats.map((stat) => (
              <DashboardStatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                description={stat.description}
                descriptionType={stat.descriptionType}
              />
            ))}
          </section>
        )
      )}

      {data ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <PortfolioOverview initiatives={data.portfolioInitiatives} />

            <AtRiskInitiatives initiatives={data.atRiskInitiatives} />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <BRDApprovalQueue items={data.brdApprovalQueue} />

            <PriorityDistribution items={data.priorityDistribution} />

            <RecentGovernanceActivity activities={data.recentGovernanceActivity} />
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
