export type InitiativeStatus =
  | "On Track"
  | "At Risk"
  | "Overdue"
  | "Blocked"
  | "Not Started";

export type StatTone = "neutral" | "success" | "warning" | "danger";

export type ActivityTone = "success" | "info" | "warning" | "danger";

export interface DashboardStat {
  label: string;
  value: number;
  description: string;
  descriptionType: StatTone;
}

export interface PortfolioInitiative {
  id: string;
  name: string;
  reference: string;
  priority: string;
  currentStage: string;
  owner: string;
  progress: number | null;
  daysLeft: number | null;
  status: InitiativeStatus;
  action: string;
}

export interface BRDQueueItem {
  id: string;
  initiative: string;
  priority: string;
  owner: string;
  submittedDate: string;
  daysWaiting: number;
}

export interface PriorityDistributionItem {
  priority: string;
  label: string;
  count: number;
}

export interface AtRiskInitiative {
  id: string;
  name: string;
  description: string;
  status: InitiativeStatus;
}

export interface GovernanceActivity {
  id: string;
  action: string;
  initiative: string;
  actor: string;
  role: string;
  timestamp: string;
  type: ActivityTone;
}

/** Everything the dashboard needs, in one shot. */
export interface DashboardSnapshot {
  stats: DashboardStat[];
  portfolioInitiatives: PortfolioInitiative[];
  brdApprovalQueue: BRDQueueItem[];
  priorityDistribution: PriorityDistributionItem[];
  atRiskInitiatives: AtRiskInitiative[];
  recentGovernanceActivity: GovernanceActivity[];
  /** Rendered under the page title. */
  headline: string;
  subtitle: string;
}
