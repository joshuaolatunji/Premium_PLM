import type { DeveloperTaskStatus, TicketStatus } from "../types/ticketTypes";

const TICKET_LABEL: Record<TicketStatus, string> = {
  Draft: "Draft",
  WithLeadEngineer: "With Lead Engineer",
  Accepted: "Accepted",
  InProgress: "In progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Rejected: "Rejected",
};

const TICKET_BADGE: Record<TicketStatus, string> = {
  Draft: "status-badge status-badge--brd-drafting",
  WithLeadEngineer: "status-badge status-badge--brd-awaiting-bdo-review",
  Accepted: "status-badge status-badge--brd-under-review",
  InProgress: "status-badge status-badge--brd-under-review",
  Completed: "status-badge status-badge--approved",
  Cancelled: "status-badge status-badge--not-started",
  Rejected: "status-badge status-badge--overdue",
};

const TASK_LABEL: Record<DeveloperTaskStatus, string> = {
  Assigned: "Not started",
  InProgress: "In progress",
  Submitted: "Submitted for review",
  UnderReview: "Under review",
  ReworkRequested: "Rework requested",
  Accepted: "Accepted",
  Rejected: "Rejected",
};

const TASK_BADGE: Record<DeveloperTaskStatus, string> = {
  Assigned: "status-badge status-badge--not-started",
  InProgress: "status-badge status-badge--brd-under-review",
  Submitted: "status-badge status-badge--brd-awaiting-bdo-review",
  UnderReview: "status-badge status-badge--brd-under-review",
  ReworkRequested: "status-badge status-badge--at-risk",
  Accepted: "status-badge status-badge--approved",
  Rejected: "status-badge status-badge--overdue",
};

export function ticketStatusLabel(status: TicketStatus): string {
  return TICKET_LABEL[status];
}

export function ticketStatusBadgeClass(status: TicketStatus): string {
  return TICKET_BADGE[status];
}

export function taskStatusLabel(status: DeveloperTaskStatus): string {
  return TASK_LABEL[status];
}

export function taskStatusBadgeClass(status: DeveloperTaskStatus): string {
  return TASK_BADGE[status];
}

// Still needs someone's work — what the PM's "open tickets" counts.
export function isOpenTicket(status: TicketStatus): boolean {
  return status !== "Completed" && status !== "Cancelled";
}

// A developer can work on it right now.
export function isTaskWorkable(status: DeveloperTaskStatus): boolean {
  return status === "Assigned" || status === "InProgress" || status === "ReworkRequested";
}

// Finished with: accepted or rejected by the Lead Engineer.
export function isTaskClosed(status: DeveloperTaskStatus): boolean {
  return status === "Accepted" || status === "Rejected";
}

// "2026-11-03T00:00:00Z" → "3 Nov 2026"; "—" when there's no date.
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
