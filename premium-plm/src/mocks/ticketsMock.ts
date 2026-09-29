// Mock service: tickets have no real endpoint at all yet. State lives in
// memory for the session only and resets on page reload — same convention
// as the other mock modules (mocks/bdoAssignmentMock.ts etc). Every
// function is `async` and shaped like a real service call so swapping this
// module's body for real `apiClient` calls later is a localized change.

import type { CreateTicketRequest, Ticket, TicketDecisionRecord } from "../types/ticketTypes";

const ticketsByInitiativeId = new Map<string, Ticket[]>();
const rejectionByTicketId = new Map<string, TicketDecisionRecord>();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

function makeId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateTicket(
  initiativeId: string,
  ticketId: string,
  patch: Partial<Ticket>,
): void {
  const existing = ticketsByInitiativeId.get(initiativeId) ?? [];

  ticketsByInitiativeId.set(
    initiativeId,
    existing.map((ticket) => (ticket.id === ticketId ? { ...ticket, ...patch } : ticket)),
  );
}

export async function getTicketsForInitiative(initiativeId: string): Promise<Ticket[]> {
  return delay(ticketsByInitiativeId.get(initiativeId) ?? []);
}

export async function createTicket(
  payload: CreateTicketRequest,
  createdByUserId: string,
): Promise<Ticket> {
  const ticket: Ticket = {
    id: makeId(),
    initiativeId: payload.initiativeId,
    title: payload.title,
    description: payload.description,
    assignedLeadEngineerId: payload.assignedLeadEngineerId,
    createdByUserId,
    createdAt: new Date().toISOString(),
    status: "Open",
    timelineDaysAllocated: null,
    assignedDeveloperId: null,
    developerTimelineDays: null,
  };

  const existing = ticketsByInitiativeId.get(payload.initiativeId) ?? [];
  ticketsByInitiativeId.set(payload.initiativeId, [...existing, ticket]);

  return delay(ticket);
}

// Every ticket assigned to a given Lead Engineer, across all initiatives —
// backs their "my tickets" dashboard (Stage 5).
export async function getTicketsForLeadEngineer(leadEngineerId: string): Promise<Ticket[]> {
  const all = Array.from(ticketsByInitiativeId.values()).flat();
  return delay(all.filter((ticket) => ticket.assignedLeadEngineerId === leadEngineerId));
}

// A single ticket by id, regardless of which initiative it belongs to —
// backs the ticket detail routes (Lead Engineer's workspace, and later the
// Developer's).
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const all = Array.from(ticketsByInitiativeId.values()).flat();
  return delay(all.find((ticket) => ticket.id === ticketId) ?? null);
}

// Lead Engineer's "assigns project ticket to developer" + "assigns a
// timeline slice to the developer" (Stage 5). Moves the ticket to
// "InProgress" now that a developer actually has work to do.
export async function assignTicketToDeveloper(
  initiativeId: string,
  ticketId: string,
  developerId: string,
  timelineDays: number,
): Promise<void> {
  updateTicket(initiativeId, ticketId, {
    assignedDeveloperId: developerId,
    developerTimelineDays: timelineDays,
    status: "InProgress",
  });

  await delay(undefined);
}

// Every ticket assigned to a given developer, across all initiatives —
// backs the Developer's own "my tickets" dashboard (Stage 6).
export async function getTicketsForDeveloper(developerId: string): Promise<Ticket[]> {
  const all = Array.from(ticketsByInitiativeId.values()).flat();
  return delay(all.filter((ticket) => ticket.assignedDeveloperId === developerId));
}

// PM's "assigns BRD and timeline to the Lead Engineer out of the remaining
// days left" — only meaningful once the BRD is approved, enforced by the
// caller (TicketsPage.tsx) rather than here.
export async function allocateTicketTimeline(
  initiativeId: string,
  ticketId: string,
  days: number,
): Promise<void> {
  updateTicket(initiativeId, ticketId, { timelineDaysAllocated: days });
  await delay(undefined);
}

// Developer's "updates ticket status after completing, submits to Lead
// Engineer for review" (Stage 6). Works whether this is the first
// submission or a resend after a Lead Engineer rejection.
export async function submitTicketForReview(
  initiativeId: string,
  ticketId: string,
): Promise<void> {
  updateTicket(initiativeId, ticketId, { status: "UnderReview" });
  rejectionByTicketId.delete(ticketId);
  await delay(undefined);
}

// Lead Engineer's approve/reject on a developer's submitted work (Stage
// 7). No comment on approval (same rule as every other leg in this app);
// rejection sends it back to the developer with the comment attached, so
// they can revise and resubmit.
export async function reviewTicket(
  initiativeId: string,
  ticketId: string,
  decision: { isApproved: boolean; comment: string },
): Promise<void> {
  updateTicket(initiativeId, ticketId, {
    status: decision.isApproved ? "Completed" : "Rejected",
  });

  if (decision.isApproved) {
    rejectionByTicketId.delete(ticketId);
  } else {
    rejectionByTicketId.set(ticketId, {
      comment: decision.comment,
      decidedAt: new Date().toISOString(),
    });
  }

  await delay(undefined);
}

export async function getTicketRejection(
  ticketId: string,
): Promise<TicketDecisionRecord | null> {
  return delay(rejectionByTicketId.get(ticketId) ?? null);
}
