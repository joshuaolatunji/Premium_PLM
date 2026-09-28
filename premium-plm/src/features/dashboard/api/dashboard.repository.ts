import { formatLongDate } from "@/lib/format";

import {
  mockAtRiskInitiatives,
  mockBRDApprovalQueue,
  mockGovernanceActivity,
  mockPortfolioInitiatives,
  mockPriorityDistribution,
  mockStats,
} from "../mock/dashboard.mock";
import type { DashboardSnapshot } from "../types";

/**
 * The dashboard reads data through this interface, never directly from a module
 * of literals. That keeps the page free of data-source concerns and makes
 * swapping implementations a one-line change in `dashboardRepository`.
 */
export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}

/** Latency stands in for a network round-trip, so loading states are real. */
const MOCK_LATENCY_MS = 150;

class MockDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

    return {
      headline: "Good morning",
      subtitle: formatLongDate(new Date()),
      stats: mockStats,
      portfolioInitiatives: mockPortfolioInitiatives,
      brdApprovalQueue: mockBRDApprovalQueue,
      priorityDistribution: mockPriorityDistribution,
      atRiskInitiatives: mockAtRiskInitiatives,
      recentGovernanceActivity: mockGovernanceActivity,
    };
  }
}

/*
 * To go live, implement DashboardRepository against
 * `endpoints.initiatives.list` and swap the export below. Note the shape
 * mismatch: no stage, owner or progress, so this is a schema decision.
 */
export const dashboardRepository: DashboardRepository =
  new MockDashboardRepository();
