// Tickets and developer tasks.
//
// Real endpoints (DevelopmentRequest in Swagger). Every ticket and task call
// answers with DevelopmentRequestResponseDto wrapped in a list; history
// answers with DeveloperTaskHistoryResponseDto.
//   POST ticketing-requests/create-parent-ticket                 PM creates
//   POST ticketing-requests/{id}/submit-ticket                   PM → Lead Engineer
//   POST ticketing-requests/{ticketId}/recall-ticket             PM takes it back
//   POST ticketing-requests/{ticketId}/accept-ticket             Lead Engineer
//   POST ticketing-requests/{ticketId}/reject-ticket             Lead Engineer, body: the reason as a JSON string
//   GET  ticketing-requests/{ticketId}/get-ticket                one ticket
//   POST development-requests/{ticketId}/assign-tasks-to-developers
//   GET  ticketing-requests/my-assigned-ticket/tasks             Developer's tasks
//   GET  ticketing-requests/{taskId}/get-ticket/task(one)        one task
//   POST ticketing-requests/{taskId}/dev-start-task
//   POST ticketing-requests/{taskId}/submit-dev-assigned-task
//   POST ticketing-requests/{taskId}/begin-devwork-review        Lead Engineer opens a submission
//   POST ticketing-requests/{taskId}/review-devwork-&give-conclusion
//                                                                Accepted / ReworkRequested / Rejected
//   GET  ticketing-requests/{taskId}/get-history-of-dev-assignedTask
//
// Missing (simulated in the browser — see mocks/localStore.ts and the gaps
// file): listing tickets by initiative (M9) or Lead Engineer (M8), a
// ticket's tasks (M10) and completing a ticket (M12). Every ticket and task
// created through this app is also recorded locally, so those lists have
// something to show. Lists are read from that record (no extra calls); a
// ticket or task page fetches the live version and refreshes the record.

import { apiClient, ApiError } from "../apicalls/apiClient";
import { getCurrentUserId, getToken } from "../apicalls/authStorage";
import { recordActivity } from "./ActivityService";
import type { ActivityTone } from "./ActivityService";
import { priorityFromApi, priorityToApi } from "../types/initiativeTypes";
import { taskStatusLabel } from "../utils/ticketStatus";
import type {
  CreateTaskRequest,
  CreateTicketRequest,
  DeveloperTask,
  DeveloperTaskStatus,
  SubmitTaskRequest,
  TaskHistoryEntry,
  TaskReview,
  TaskReviewDecision,
  Ticket,
  TicketStatus,
} from "../types/ticketTypes";
import {
  readArray,
  readCreatedId,
  readFirstRecord,
  readList,
  readRecord,
  readNumber,
  readString,
  statusKey,
} from "../utils/apiShape";
import type { ApiRecord } from "../utils/apiShape";
import { deleteRow, listRows, readRow, simulateLatency, updateRow, writeRow } from "../mocks/localStore";

const TICKETS = "tickets";
const TASKS = "developer-tasks";
// The Lead Engineer's latest decision and comment on each task, so the
// developer and the task card can show it without reading the history.
const TASK_REVIEWS = "task-reviews";
// Simulated: a ticket's completion (M12), applied on top of what the API reports.
const TICKET_COMPLETIONS = "ticket-completions";

function auth() {
  return { token: getToken() ?? undefined };
}

function nowIso() {
  return new Date().toISOString();
}

// yyyy-mm-dd from a date input → ISO, or null when blank.
function dateToApi(date: string): string | null {
  return date ? new Date(`${date}T00:00:00Z`).toISOString() : null;
}

// ---------------------------------------------------------------------------
// Reading the API's shapes

function toTicketStatus(value: unknown, fallback: TicketStatus): TicketStatus {
  const key = statusKey(value);

  if (key === "draft") return "Draft";
  if (["submitted", "withleadengineer"].includes(key)) {
    return "WithLeadEngineer";
  }
  if (key === "accepted") return "Accepted";
  if (key === "inprogress") return "InProgress";
  if (key === "completed") return "Completed";
  if (key === "cancelled") return "Cancelled";
  if (key === "rejected") return "Rejected";

  return fallback;
}

function toTaskStatus(value: unknown, fallback: DeveloperTaskStatus): DeveloperTaskStatus {
  const key = statusKey(value);

  if (key === "assigned") return "Assigned";
  if (key === "inprogress") return "InProgress";
  if (key === "submitted") return "Submitted";
  if (key === "underreview") return "UnderReview";
  if (key === "reworkrequested") return "ReworkRequested";
  if (key === "accepted") return "Accepted";
  if (key === "rejected") return "Rejected";

  return fallback;
}

function toTicket(record: ApiRecord, known: Ticket | null): Ticket {
  const id = readString(record, "id", "ticketId", "developmentRequestId") ?? known?.id ?? "";
  const priority = record.priority !== undefined ? priorityFromApi(record.priority) : (known?.priority ?? 0);

  const documentType = readString(record, "documentType");

  return {
    id,
    requestNumber: readString(record, "requestNumber") ?? known?.requestNumber ?? null,
    initiativeId: readString(record, "productInitiativeId", "initiativeId") ?? known?.initiativeId ?? "",
    documentId: readString(record, "documentProductId") ?? known?.documentId ?? null,
    documentType:
      documentType === "PID" || documentType === "FRD" || documentType === "BRD" || documentType === "SWR"
        ? documentType
        : (known?.documentType ?? null),
    documentVersion: readNumber(record, "documentVersion") ?? known?.documentVersion ?? null,
    leadEngineerId:
      readString(record, "leadEngineerId", "assignedLeadEngineerId", "leadEngineerUserId") ?? known?.leadEngineerId ?? "",
    // The response has no title field yet (gaps file R24); what the PM typed
    // is kept from the local record.
    title: readString(record, "title") ?? known?.title ?? "Untitled ticket",
    scope: readString(record, "scope") ?? known?.scope ?? "",
    functionalRequirements: readString(record, "functionalRequirements") ?? known?.functionalRequirements ?? "",
    expectedOutcome: readString(record, "expectedOutcome") ?? known?.expectedOutcome ?? "",
    priority,
    targetDate: readString(record, "targetDate", "dueDate") ?? known?.targetDate ?? null,
    status: toTicketStatus(record.status, known?.status ?? "Draft"),
    createdByUserId: readString(record, "createdByUserId", "createdBy", "requestedByUserId") ?? known?.createdByUserId ?? "",
    createdAt: readString(record, "createdAt", "dateCreated") ?? known?.createdAt ?? nowIso(),
    rejectionReason:
      readString(record, "rejectionReason", "rejectReason", "rejectionComment", "reason") ?? known?.rejectionReason ?? null,
  };
}

function toTask(record: ApiRecord, known: DeveloperTask | null): DeveloperTask {
  const parent = readRecord(record, "developmentRequest", "ticket", "parentTicket");
  const submissionComment = readString(record, "submissionComment", "comment", "developerComment");
  const submittedAt = readString(record, "submittedAt", "dateSubmitted");

  return {
    id: readString(record, "id", "taskId", "developerTaskId") ?? known?.id ?? "",
    ticketId:
      readString(record, "developmentRequestId", "ticketId", "parentTicketId") ??
      readString(parent, "id") ??
      known?.ticketId ??
      "",
    title: readString(record, "title", "name") ?? known?.title ?? "Untitled task",
    description: readString(record, "description") ?? known?.description ?? "",
    developerId: readString(record, "assignedDeveloperId", "developerId", "assignedToUserId") ?? known?.developerId ?? "",
    priority: record.priority !== undefined ? priorityFromApi(record.priority) : (known?.priority ?? 0),
    startDate: readString(record, "startDate") ?? known?.startDate ?? null,
    targetDate: readString(record, "targetDate", "dueDate") ?? known?.targetDate ?? null,
    status: toTaskStatus(record.status, known?.status ?? "Assigned"),
    createdAt: readString(record, "createdAt", "dateCreated") ?? known?.createdAt ?? nowIso(),
    startedAt: readString(record, "startedAt", "dateStarted") ?? known?.startedAt ?? null,
    submission:
      submissionComment || submittedAt
        ? {
            comment: submissionComment ?? "",
            pullRequestUrl: readString(record, "pullRequestUrl") ?? null,
            branchName: readString(record, "branchName") ?? null,
            submittedAt: submittedAt ?? known?.submission?.submittedAt ?? nowIso(),
          }
        : (known?.submission ?? null),
    review: known?.review ?? null,
    ticketTitle:
      readString(record, "ticketTitle", "developmentRequestTitle", "parentTitle") ??
      readString(parent, "title") ??
      known?.ticketTitle ??
      null,
    initiativeId:
      readString(record, "productInitiativeId", "initiativeId") ??
      readString(parent, "productInitiativeId", "initiativeId") ??
      known?.initiativeId ??
      null,
  };
}

// Adds the Lead Engineer's latest comment recorded here. The status always
// comes from the API.
function withReview(task: DeveloperTask): DeveloperTask {
  const review = readRow<TaskReview>(TASK_REVIEWS, task.id);
  return review ? { ...task, review } : task;
}

function withCompletion(ticket: Ticket): Ticket {
  return readRow(TICKET_COMPLETIONS, ticket.id) ? { ...ticket, status: "Completed" } : ticket;
}

function rememberTicket(ticket: Ticket) {
  if (ticket.id) {
    writeRow(TICKETS, ticket.id, ticket);
  }
}

function rememberTask(task: DeveloperTask) {
  if (task.id) {
    // Only the API's own fields are stored; the review lives in its own table.
    writeRow(TASKS, task.id, { ...task, review: null });
  }
}

function setTicketStatus(ticketId: string, status: TicketStatus, extra: Partial<Ticket> = {}) {
  updateRow<Ticket>(TICKETS, ticketId, (ticket) => ({ ...ticket, status, ...extra }));
}

function setTaskStatus(taskId: string, status: DeveloperTaskStatus, extra: Partial<DeveloperTask> = {}) {
  updateRow<DeveloperTask>(TASKS, taskId, (task) => ({ ...task, status, ...extra }));
}

// Records the action for the Group Head (see ActivityService). `action`
// follows the person's name, e.g. "sent a ticket to the Lead Engineer".
function logActivity(ticketId: string, action: string, tone: ActivityTone, task?: DeveloperTask | null) {
  const ticket = readRow<Ticket>(TICKETS, ticketId);
  const initiativeId = ticket?.initiativeId ?? task?.initiativeId ?? null;
  const ticketTitle = ticket?.title ?? task?.ticketTitle ?? null;

  recordActivity({
    initiativeId,
    area: task ? "Tasks" : "Tickets",
    action,
    detail: [task?.title, ticketTitle ? `Ticket: ${ticketTitle}` : null].filter(Boolean).join(" · "),
    tone,
    link: initiativeId ? `/dashboard/initiatives/${initiativeId}/tickets` : undefined,
  });
}

function taskFor(taskId: string) {
  return readRow<DeveloperTask>(TASKS, taskId);
}

// ---------------------------------------------------------------------------
// Tickets

export async function createTicket(request: CreateTicketRequest): Promise<Ticket> {
  const body = await apiClient<unknown>("api/ticketing-requests/create-parent-ticket", {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      productInitiativeId: request.initiativeId,
      documentProductId: request.documentId,
      leadEngineerId: request.leadEngineerId,
      title: request.title,
      scope: request.scope,
      functionalRequirements: request.functionalRequirements,
      expectedOutcome: request.expectedOutcome,
      priority: priorityToApi(request.priority),
      targetDate: dateToApi(request.targetDate),
    }),
  });

  const data = readFirstRecord(body);
  const id = readCreatedId(body, "ticketId", "developmentRequestId");

  if (!id) {
    throw new Error(
      "The ticket was sent, but the server didn't return its id, so it can't be tracked here. Check with the backend before creating it again.",
    );
  }

  const ticket = toTicket(data ?? {}, {
    id,
    requestNumber: null,
    initiativeId: request.initiativeId,
    documentId: request.documentId,
    documentType: null,
    documentVersion: null,
    leadEngineerId: request.leadEngineerId,
    title: request.title,
    scope: request.scope,
    functionalRequirements: request.functionalRequirements,
    expectedOutcome: request.expectedOutcome,
    priority: request.priority,
    targetDate: dateToApi(request.targetDate),
    status: "Draft",
    createdByUserId: getCurrentUserId() ?? "",
    createdAt: nowIso(),
    rejectionReason: null,
  });

  rememberTicket(ticket);
  logActivity(ticket.id, "created a ticket", "info");
  return ticket;
}

// The live ticket, refreshed into the local record. Falls back to the local
// record if the API can't return it.
export async function getTicket(ticketId: string): Promise<Ticket> {
  const known = readRow<Ticket>(TICKETS, ticketId);

  try {
    const body = await apiClient<unknown>(`api/ticketing-requests/${ticketId}/get-ticket`, { method: "GET", ...auth() });
    const data = readFirstRecord(body);

    if (!data) {
      throw new ApiError("The ticket wasn't found.", 404, body);
    }

    const ticket = toTicket(data, known);
    rememberTicket(ticket);

    // get-ticket may already include the tasks — keep them for the task list.
    readArray(data, "developerTasks", "tasks", "assignedTasks")?.forEach((record) => {
      const task = toTask(record, readRow<DeveloperTask>(TASKS, readString(record, "id", "taskId") ?? ""));
      rememberTask({ ...task, ticketId: task.ticketId || ticket.id });
    });

    return withCompletion(ticket);
  } catch (error) {
    if (known) {
      return withCompletion(known);
    }

    throw error;
  }
}

function sortNewestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// M9 — simulated from the local record.
export async function getTicketsForInitiative(initiativeId: string): Promise<Ticket[]> {
  const tickets = listRows<Ticket>(TICKETS).filter((ticket) => ticket.initiativeId === initiativeId);
  return simulateLatency(sortNewestFirst(tickets.map(withCompletion)));
}

// M8 — simulated from the local record. Drafts haven't reached them yet.
export async function getTicketsForLeadEngineer(leadEngineerId: string): Promise<Ticket[]> {
  const tickets = listRows<Ticket>(TICKETS).filter(
    (ticket) => ticket.leadEngineerId === leadEngineerId && ticket.status !== "Draft",
  );
  return simulateLatency(sortNewestFirst(tickets.map(withCompletion)));
}

export async function submitTicket(ticketId: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${ticketId}/submit-ticket`, { method: "POST", ...auth() });
  setTicketStatus(ticketId, "WithLeadEngineer", { rejectionReason: null });
  logActivity(ticketId, "sent a ticket to the Lead Engineer", "warning");
}

export async function recallTicket(ticketId: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${ticketId}/recall-ticket`, { method: "POST", ...auth() });
  setTicketStatus(ticketId, "Draft");
  logActivity(ticketId, "recalled a ticket", "warning");
}

export async function acceptTicket(ticketId: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${ticketId}/accept-ticket`, { method: "POST", ...auth() });
  setTicketStatus(ticketId, "Accepted");
  logActivity(ticketId, "accepted a ticket", "success");
}

// The body is the reason as a bare JSON string. The ticket response doesn't
// return it yet (gaps file R23), so it's also kept on this browser for the
// Product Manager to see.
export async function rejectTicket(ticketId: string, reason: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${ticketId}/reject-ticket`, {
    method: "POST",
    body: JSON.stringify(reason),
    ...auth(),
  });
  setTicketStatus(ticketId, "Rejected", { rejectionReason: reason });
  logActivity(ticketId, "rejected a ticket", "danger");
}

// M12 — simulated. Only once every task has been approved.
export async function completeTicket(ticketId: string): Promise<void> {
  writeRow(TICKET_COMPLETIONS, ticketId, { completedAt: nowIso() });
  logActivity(ticketId, "marked a ticket completed", "success");
  await simulateLatency(undefined);
}

// ---------------------------------------------------------------------------
// Developer tasks

export async function assignTask(ticketId: string, request: CreateTaskRequest): Promise<DeveloperTask> {
  const body = await apiClient<unknown>(`api/development-requests/${ticketId}/assign-tasks-to-developers`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({
      title: request.title,
      description: request.description,
      assignedDeveloperId: request.developerId,
      priority: priorityToApi(request.priority),
      startDate: dateToApi(request.startDate),
      targetDate: dateToApi(request.targetDate),
    }),
  });

  const data = readFirstRecord(body);
  const ticket = readRow<Ticket>(TICKETS, ticketId);
  const id = readCreatedId(body, "taskId", "developerTaskId");

  if (!id) {
    throw new Error(
      "The task was sent, but the server didn't return its id, so it can't be tracked here. Check with the backend before assigning it again.",
    );
  }

  const task = toTask(data ?? {}, {
    id,
    ticketId,
    title: request.title,
    description: request.description,
    developerId: request.developerId,
    priority: request.priority,
    startDate: dateToApi(request.startDate),
    targetDate: dateToApi(request.targetDate),
    status: "Assigned",
    createdAt: nowIso(),
    startedAt: null,
    submission: null,
    review: null,
    ticketTitle: ticket?.title ?? null,
    initiativeId: ticket?.initiativeId ?? null,
  });

  rememberTask(task);
  setTicketStatus(ticketId, "InProgress");
  logActivity(ticketId, "assigned a task to a developer", "info", task);
  return task;
}

// M10 — the tasks recorded for this ticket (including any get-ticket returned).
export async function getTasksForTicket(ticketId: string): Promise<DeveloperTask[]> {
  const tasks = listRows<DeveloperTask>(TASKS).filter((task) => task.ticketId === ticketId);
  return simulateLatency(sortNewestFirst(tasks).reverse().map(withReview));
}

// The signed-in developer's tasks (real), plus any recorded locally that the
// API didn't list.
export async function getMyTasks(): Promise<DeveloperTask[]> {
  const myId = getCurrentUserId();
  const local = listRows<DeveloperTask>(TASKS).filter((task) => task.developerId === myId);
  let live: DeveloperTask[] = [];

  try {
    const body = await apiClient<unknown>("api/ticketing-requests/my-assigned-ticket/tasks", { method: "GET", ...auth() });
    live = readList(body, ["tasks", "items"]).map((record) => {
      const task = toTask(record, readRow<DeveloperTask>(TASKS, readString(record, "id", "taskId") ?? ""));
      rememberTask(task);
      return task;
    });
  } catch (error) {
    // No tasks yet can come back as a 404; anything else is a real failure
    // unless there's a local record to show instead.
    if (!(error instanceof ApiError && error.status === 404) && local.length === 0) {
      throw error;
    }
  }

  const liveIds = new Set(live.map((task) => task.id));
  return sortNewestFirst([...live, ...local.filter((task) => !liveIds.has(task.id))]).map(withReview);
}

export async function getTask(taskId: string): Promise<DeveloperTask> {
  const known = readRow<DeveloperTask>(TASKS, taskId);

  try {
    const body = await apiClient<unknown>(`api/ticketing-requests/${taskId}/get-ticket/task(one)`, {
      method: "GET",
      ...auth(),
    });
    const data = readFirstRecord(body);

    if (!data) {
      throw new ApiError("The task wasn't found.", 404, body);
    }

    const task = toTask(data, known);
    rememberTask(task);
    return withReview(task);
  } catch (error) {
    if (known) {
      return withReview(known);
    }

    throw error;
  }
}

export async function startTask(taskId: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${taskId}/dev-start-task`, { method: "POST", ...auth() });
  setTaskStatus(taskId, "InProgress", { startedAt: nowIso() });
  const task = taskFor(taskId);
  logActivity(task?.ticketId ?? "", "started a task", "info", task);
}

export async function submitTask(taskId: string, request: SubmitTaskRequest): Promise<void> {
  const submission = {
    comment: request.comment,
    pullRequestUrl: request.pullRequestUrl.trim() || null,
    branchName: request.branchName.trim() || null,
  };

  await apiClient<unknown>(`api/ticketing-requests/${taskId}/submit-dev-assigned-task`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify(submission),
  });

  // A fresh submission clears the previous review's comment.
  deleteRow(TASK_REVIEWS, taskId);
  setTaskStatus(taskId, "Submitted", { submission: { ...submission, submittedAt: nowIso() } });
  const task = taskFor(taskId);
  logActivity(task?.ticketId ?? "", "submitted a task for review", "warning", task);
}

// The Lead Engineer opens a submitted task for review (Submitted → Under review).
export async function beginTaskReview(taskId: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${taskId}/begin-devwork-review`, { method: "POST", ...auth() });
  setTaskStatus(taskId, "UnderReview");
  const task = taskFor(taskId);
  logActivity(task?.ticketId ?? "", "started reviewing a task", "info", task);
}

const REVIEW_ACTIVITY: Record<TaskReviewDecision, { action: string; tone: ActivityTone }> = {
  Accepted: { action: "accepted a task", tone: "success" },
  ReworkRequested: { action: "requested rework on a task", tone: "warning" },
  Rejected: { action: "rejected a task", tone: "danger" },
};

// The Lead Engineer's conclusion on a task under review.
export async function concludeTaskReview(taskId: string, decision: TaskReviewDecision, comment: string): Promise<void> {
  await apiClient<unknown>(`api/ticketing-requests/${taskId}/review-devwork-&give-conclusion`, {
    method: "POST",
    ...auth(),
    body: JSON.stringify({ decision, comment: comment || null }),
  });

  writeRow<TaskReview>(TASK_REVIEWS, taskId, { decision, comment, reviewedAt: nowIso() });
  setTaskStatus(taskId, decision);
  const task = taskFor(taskId);
  logActivity(task?.ticketId ?? "", REVIEW_ACTIVITY[decision].action, REVIEW_ACTIVITY[decision].tone, task);
}

function toHistoryEntry(record: ApiRecord, index: number): TaskHistoryEntry {
  const newStatus = readString(record, "newStatus");
  const action =
    readString(record, "action") ?? (newStatus ? taskStatusLabel(toTaskStatus(newStatus, "Assigned")) : "Update");

  return {
    id: readString(record, "id") ?? `history-${index}`,
    action,
    comment: readString(record, "comment", "notes", "remarks"),
    // Only the user's id is returned; the page turns it into a name.
    actor: readString(record, "performedByUserId"),
    at: readString(record, "createdAt") ?? "",
  };
}

// The API's history of a task, newest first.
export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  let live: TaskHistoryEntry[] = [];

  try {
    const body = await apiClient<unknown>(`api/ticketing-requests/${taskId}/get-history-of-dev-assignedTask`, {
      method: "GET",
      ...auth(),
    });
    live = readList(body).map(toHistoryEntry);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error;
    }
  }

  return live.sort((a, b) => b.at.localeCompare(a.at));
}
