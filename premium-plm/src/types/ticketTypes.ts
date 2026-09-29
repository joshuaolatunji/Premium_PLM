// Mocked domain — tickets don't exist on the real API at all yet. "Each
// ticket is tied to an initiative" per the spec. Status covers the full
// lifecycle described across the PM/Lead Engineer/Developer roles, even
// though only "Open" is reachable until the Lead Engineer/Developer
// stages (roadmap Stage 5/6) are built.
export type TicketStatus =
  | "Open"
  | "InProgress"
  | "UnderReview"
  | "Completed"
  | "Rejected";

export interface Ticket {
  id: string;
  initiativeId: string;
  title: string;
  description: string;
  assignedLeadEngineerId: string;
  createdByUserId: string;
  createdAt: string;
  status: TicketStatus;
  // Days allocated to this ticket out of the initiative's remaining
  // timeline — set once the BRD is approved (Stage 4b), null until then.
  timelineDaysAllocated: number | null;
  // The Lead Engineer's own developer assignment + timeline slice (Stage
  // 5) — both null until the Lead Engineer assigns the ticket.
  assignedDeveloperId: string | null;
  developerTimelineDays: number | null;
}

export interface CreateTicketRequest {
  initiativeId: string;
  title: string;
  description: string;
  assignedLeadEngineerId: string;
}

// The Lead Engineer's rejection of a developer's submitted work (Stage 7)
// — kept so the developer can see why when they return to their workspace.
export interface TicketDecisionRecord {
  comment: string;
  decidedAt: string;
}
