// Tickets ("development requests" on the API) and the developer tasks a Lead
// Engineer splits them into. The flow:
//
//   PM creates a ticket (Draft) → submits it to a Lead Engineer
//     ↳ PM can recall it while it's waiting (back to Draft)
//   Lead Engineer accepts it, or rejects it with a reason (back to the PM)
//   Lead Engineer assigns tasks to developers → ticket In progress
//   Developer starts a task → submits it (comment, PR link, branch)
//   Lead Engineer starts reviewing it (Under review), then accepts it,
//     asks for rework (back to the developer) or rejects it
//   Lead Engineer marks the ticket completed                        [mock, M12]
//
// Ticket statuses follow the API's DevelopmentRequestStatus, with its
// "Submitted" shown as "With Lead Engineer". "Rejected" is the app's own:
// the API has no rejected status, so a ticket the Lead Engineer rejects is
// tracked as rejected on this browser (gaps file R23).

export type TicketStatus =
  | "Draft"
  | "WithLeadEngineer"
  | "Accepted"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "Rejected";

// The API's DeveloperTaskStatus, exactly.
export type DeveloperTaskStatus =
  | "Assigned"
  | "InProgress"
  | "Submitted"
  | "UnderReview"
  | "ReworkRequested"
  | "Accepted"
  | "Rejected";

// The Lead Engineer's conclusion on a task (ReviewDeveloperTaskDto.decision).
export type TaskReviewDecision = "Accepted" | "ReworkRequested" | "Rejected";

export interface Ticket {
  id: string;
  // e.g. "DR-0012", when the API returns one.
  requestNumber: string | null;
  initiativeId: string;
  // The document it's built from, and that document's version at the time.
  documentId: string | null;
  documentType: "PID" | "FRD" | "BRD" | "SWR" | null;
  documentVersion: number | null;
  leadEngineerId: string;
  title: string;
  scope: string;
  functionalRequirements: string;
  expectedOutcome: string;
  // The app's numeric tier (1 = Critical … 5 = Low), as for initiatives.
  priority: number;
  targetDate: string | null;
  status: TicketStatus;
  createdByUserId: string;
  createdAt: string;
  // The Lead Engineer's reason, when they rejected it.
  rejectionReason: string | null;
}

export interface TaskSubmission {
  comment: string;
  pullRequestUrl: string | null;
  branchName: string | null;
  submittedAt: string;
}

export interface TaskReview {
  decision: TaskReviewDecision;
  comment: string;
  reviewedAt: string;
}

export interface DeveloperTask {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  developerId: string;
  priority: number;
  startDate: string | null;
  targetDate: string | null;
  status: DeveloperTaskStatus;
  createdAt: string;
  startedAt: string | null;
  submission: TaskSubmission | null;
  // The Lead Engineer's latest decision and comment, as recorded here (the
  // task's history on the API has it too).
  review: TaskReview | null;
  // Shown on the Developer's list when the API includes them.
  ticketTitle: string | null;
  initiativeId: string | null;
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  comment: string | null;
  actor: string | null;
  at: string;
}

export interface CreateTicketRequest {
  initiativeId: string;
  // The PID, FRD, BRD or SWR the ticket is built from.
  documentId: string;
  leadEngineerId: string;
  title: string;
  scope: string;
  functionalRequirements: string;
  expectedOutcome: string;
  priority: number;
  // yyyy-mm-dd from a date input, or "" for none.
  targetDate: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  developerId: string;
  priority: number;
  startDate: string;
  targetDate: string;
}

export interface SubmitTaskRequest {
  comment: string;
  pullRequestUrl: string;
  branchName: string;
}
