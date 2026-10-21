export type InitiativeStatus =
  | "On Track"
  | "At Risk"
  | "Overdue"
  | "Blocked"
  | "Not Started";

export interface DashboardStat {
  label: string;
  value: number;
  description: string;
  descriptionType: "neutral" | "success" | "warning" | "danger";
}

export interface PortfolioInitiative {
  id: string;
  name: string;
  reference: string;
  createdOn: string;
  priority: string;
  priorityValue: number;
  currentStage: string;
  owner: string;
  progress: number | null;
  daysLeft: number | null;
  status: InitiativeStatus;
  action: string;
}

// One pending approval in a reviewer's Approval queue.
export interface ApprovalQueueItem {
  key: string;
  initiativeId: string;
  initiative: string;
  // "BDO Docs", "PID", "FRD", "BRD" or "SWR".
  documentLabel: string;
  priority: string;
  priorityValue: number;
  submittedBy: string;
  submittedDate: string;
  daysWaiting: number;
  reviewPath: string;
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
  type: "success" | "info" | "warning" | "danger";
}
