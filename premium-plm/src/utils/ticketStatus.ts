// Unlike BRD/initiative status, every one of these strings is our own
// mock (see mocks/ticketsMock.ts) — there's no real endpoint to defer to,
// so labels and colors here are safe to define outright.
import type { TicketStatus } from "../types/ticketTypes";

const LABEL: Record<TicketStatus, string> = {
  Open: "Open",
  InProgress: "In progress",
  UnderReview: "Under review",
  Completed: "Completed",
  Rejected: "Rejected",
};

const BADGE_CLASS: Record<TicketStatus, string> = {
  Open: "status-badge status-badge--not-started",
  InProgress: "status-badge status-badge--not-started",
  UnderReview: "status-badge status-badge--at-risk",
  Completed: "status-badge status-badge--approved",
  Rejected: "status-badge status-badge--overdue",
};

export function ticketStatusLabel(status: TicketStatus): string {
  return LABEL[status];
}

export function ticketStatusBadgeClass(status: TicketStatus): string {
  return BADGE_CLASS[status];
}
