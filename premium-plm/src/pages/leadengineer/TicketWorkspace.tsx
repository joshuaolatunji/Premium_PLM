import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GitBranch } from "lucide-react";

import { clearDraft, useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";
import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers, isUserListForbidden } from "../../service/UserService";
import {
  acceptTicket,
  assignTask,
  completeTicket,
  getTasksForTicket,
  getTicket,
  beginTaskReview,
  concludeTaskReview,
  rejectTicket,
} from "../../service/TicketService";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { CreateTaskRequest, DeveloperTask, TaskReviewDecision } from "../../types/ticketTypes";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";
import ReviewDecisionBar from "../../components/review/ReviewDecisionBar";
import TicketBrief from "../../components/tickets/TicketBrief";
import InitiativeContext from "../../components/tickets/InitiativeContext";
import BackLink from "../../components/common/BackLink";
import {
  formatDate,
  isTaskClosed,
  taskStatusBadgeClass,
  taskStatusLabel,
  ticketStatusBadgeClass,
  ticketStatusLabel,
} from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { currentTimestamp } from "../../utils/documentStatus";
import { capitalize } from "../../utils/text";
import { activeUsersWithRole } from "../../utils/userStatus";

const EMPTY_TASK: CreateTaskRequest = {
  title: "",
  description: "",
  developerId: "",
  priority: 3,
  startDate: "",
  targetDate: "",
};

// What the Lead Engineer is deciding: the ticket itself, or their
// conclusion on one task under review.
type PendingDecision =
  | { kind: "ticket"; decision: Decision }
  | { kind: "task"; outcome: TaskReviewDecision; task: DeveloperTask };

// The decision modal for each conclusion on a task.
const TASK_OUTCOME_COPY: Record<
  TaskReviewDecision,
  { decision: Decision; title: string; label: string; placeholder: string }
> = {
  Accepted: { decision: "approve", title: "Accept work", label: "", placeholder: "" },
  ReworkRequested: {
    decision: "reject",
    title: "Request rework",
    label: "What needs to change",
    placeholder: "What should the developer fix before resubmitting?",
  },
  Rejected: {
    decision: "reject",
    title: "Reject work",
    label: "Reason",
    placeholder: "Why is this work being rejected?",
  },
};

function TicketWorkspace() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The task being written is kept on this device until it's assigned.
  const [task, setTask, taskDraft] = useDraftState<CreateTaskRequest>(`task-new:${ticketId}`, EMPTY_TASK);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId as string),
    enabled: Boolean(ticketId),
  });

  const ticket = ticketQuery.data ?? null;

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", ticket?.initiativeId],
    queryFn: () => getInitiativeById(ticket?.initiativeId as string),
    enabled: Boolean(ticket?.initiativeId),
  });

  // M10 — the tasks recorded for this ticket.
  const tasksQuery = useQuery({
    queryKey: ["ticket-tasks", ticketId],
    queryFn: () => getTasksForTicket(ticketId as string),
    enabled: Boolean(ticketId) && ticketQuery.isSuccess,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  // Only active accounts can be assigned — deactivated users are left out.
  const developers = activeUsersWithRole(usersQuery.data, "Developer");

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return capitalize(usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned");
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
      queryClient.invalidateQueries({ queryKey: ["ticket-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["lead-engineer-tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["developer-tasks"] }),
    ]);
  }

  const ticketDraftKey = `decision:ticket:${ticketId}`;
  const taskDraftKey = (taskId: string) => `decision:task:${taskId}`;

  const ticketDecisionMutation = useMutation({
    mutationFn: ({ accept, reason }: { accept: boolean; reason: string }) =>
      accept ? acceptTicket(ticketId as string) : rejectTicket(ticketId as string, reason),
    onSuccess: async (_data, { accept }) => {
      setPending(null);
      clearDraft(ticketDraftKey);
      await refresh();

      if (!accept) {
        navigate("/dashboard/lead-engineer");
      }
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't record your decision."),
  });

  const beginReviewMutation = useMutation({
    mutationFn: (taskId: string) => beginTaskReview(taskId),
    onSuccess: async () => {
      setErrorMessage("");
      await refresh();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't start the review."),
  });

  const taskDecisionMutation = useMutation({
    mutationFn: ({ taskId, outcome, comment }: { taskId: string; outcome: TaskReviewDecision; comment: string }) =>
      concludeTaskReview(taskId, outcome, comment),
    onSuccess: async (_data, { taskId }) => {
      setPending(null);
      clearDraft(taskDraftKey(taskId));
      await refresh();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't record your decision."),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignTask(ticketId as string, { ...task, title: task.title.trim(), description: task.description.trim() }),
    onSuccess: async () => {
      setTask(EMPTY_TASK);
      setErrorMessage("");
      await refresh();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Unable to assign this task."),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeTicket(ticketId as string),
    onSuccess: async () => {
      setConfirmingComplete(false);
      await refresh();
    },
  });

  function handleAssign() {
    if (!task.title.trim() || !task.developerId) {
      setErrorMessage("Give the task a title and choose a developer.");
      return;
    }

    if (task.startDate && task.targetDate && task.targetDate < task.startDate) {
      setErrorMessage("The target date must be on or after the start date.");
      return;
    }

    if (ticket?.targetDate && task.targetDate && task.targetDate > ticket.targetDate.slice(0, 10)) {
      setErrorMessage(`The target date is after the ticket's own (${formatDate(ticket.targetDate)}).`);
      return;
    }

    setErrorMessage("");
    assignMutation.mutate();
  }

  function confirmDecision(comment: string) {
    if (!pending) {
      return;
    }

    setErrorMessage("");

    if (pending.kind === "ticket") {
      ticketDecisionMutation.mutate({ accept: pending.decision === "approve", reason: comment });
    } else {
      taskDecisionMutation.mutate({ taskId: pending.task.id, outcome: pending.outcome, comment });
    }
  }

  if (ticketQuery.isLoading || (ticket && initiativeQuery.isLoading)) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket || !initiativeQuery.data) {
    return (
      <div className="dashboard-page">
        <BackLink fallbackTo="/dashboard/lead-engineer" fallbackLabel="Back to your tickets" />

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this ticket. It may not exist, or you may not have access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const tasks = tasksQuery.data ?? [];
  const isNew = ticket.status === "WithLeadEngineer";
  const canAssign = ticket.status === "Accepted" || ticket.status === "InProgress";
  // Every task finished, at least one of them accepted.
  const allApproved =
    tasks.some((item) => item.status === "Accepted") && tasks.every((item) => isTaskClosed(item.status));
  const today = new Date(currentTimestamp()).toISOString().slice(0, 10);
  const isDeciding = ticketDecisionMutation.isPending || taskDecisionMutation.isPending || beginReviewMutation.isPending;

  return (
    <div className="dashboard-page">
      <BackLink fallbackTo="/dashboard/lead-engineer" fallbackLabel="Back to your tickets" />

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Tickets / {initiative.projectName} / {ticket.title}
          </p>

          <h1 className="dashboard-title">{ticket.title}</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span>{initiative.projectName}</span>
            <span className={ticketStatusBadgeClass(ticket.status)}>{ticketStatusLabel(ticket.status)}</span>
          </p>
        </div>

        {isNew && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--secondary brd-reject-button"
              onClick={() => setPending({ kind: "ticket", decision: "reject" })}
              disabled={isDeciding}
            >
              Reject
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={() => setPending({ kind: "ticket", decision: "approve" })}
              disabled={isDeciding}
            >
              Accept ticket
            </button>
          </div>
        )}

        {canAssign && allApproved && (
          <div className="dashboard-header__actions">
            <button type="button" className="button button--primary" onClick={() => setConfirmingComplete(true)}>
              Mark ticket completed
            </button>
          </div>
        )}
      </header>

      <DraftRestoredNotice
        savedAt={taskDraft.restoredAt}
        onDiscard={taskDraft.discard}
        keepHint="Assign the task to keep them."
      />

      {ticket.status === "Rejected" && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by you:</strong> {ticket.rejectionReason || "No reason recorded."}
        </div>
      )}

      {errorMessage && !pending && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      <TicketBrief ticket={ticket} initiativeName={initiative.projectName} />

      {(canAssign || ticket.status === "Completed") && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>Developer tasks</h2>
              <p>
                {tasks.length === 0
                  ? "Split the ticket into tasks and assign each to a developer."
                  : `${tasks.filter((item) => item.status === "Accepted").length} of ${tasks.length} accepted.`}
              </p>
            </div>
          </div>

          {tasks.length > 0 && (
            <ul className="task-cards">
              {tasks.map((item) => (
                <li key={item.id} className="task-card">
                  <div className="task-card_header">
                    <div className="initiative-cell">
                      <strong title={item.title}>{item.title}</strong>
                      <span>
                        {userName(item.developerId)} · {formatDate(item.startDate)} → {formatDate(item.targetDate)}
                      </span>
                    </div>

                    <div className="task-card_badges">
                      <span className={priorityBadgeClass(item.priority)}>{priorityLabel(item.priority)}</span>
                      <span className={taskStatusBadgeClass(item.status)}>{taskStatusLabel(item.status)}</span>
                    </div>
                  </div>

                  {item.description && <p className="task-card_description">{item.description}</p>}

                  {item.submission && item.status !== "Assigned" && item.status !== "InProgress" && (
                    <div className="task-card_submission">
                      <strong>Developer's note</strong>
                      <p>{item.submission.comment || "—"}</p>
                      <div className="task-card_links">
                        {item.submission.pullRequestUrl && (
                          <a href={item.submission.pullRequestUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} aria-hidden="true" />
                            Pull request
                          </a>
                        )}
                        {item.submission.branchName && (
                          <span>
                            <GitBranch size={14} aria-hidden="true" />
                            {item.submission.branchName}
                          </span>
                        )}
                        <span>Submitted {formatDate(item.submission.submittedAt)}</span>
                      </div>
                    </div>
                  )}

                  {(item.status === "ReworkRequested" || item.status === "Rejected") && item.review?.comment && (
                    <p className="task-card_review">
                      <strong>{item.status === "Rejected" ? "You rejected it:" : "You asked for rework:"}</strong>{" "}
                      {item.review.comment}
                    </p>
                  )}

                  {item.status === "Submitted" && (
                    <div className="brd-reviews-actions task-card_actions">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => beginReviewMutation.mutate(item.id)}
                        disabled={isDeciding}
                      >
                        {beginReviewMutation.isPending && beginReviewMutation.variables === item.id
                          ? "Starting…"
                          : "Start review"}
                      </button>
                    </div>
                  )}

                  {item.status === "UnderReview" && (
                    <div className="brd-reviews-actions task-card_actions">
                      <button
                        type="button"
                        className="button button--secondary brd-reject-button"
                        onClick={() => setPending({ kind: "task", outcome: "Rejected", task: item })}
                        disabled={isDeciding}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="button button--dark"
                        onClick={() => setPending({ kind: "task", outcome: "ReworkRequested", task: item })}
                        disabled={isDeciding}
                      >
                        Request rework
                      </button>
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => setPending({ kind: "task", outcome: "Accepted", task: item })}
                        disabled={isDeciding}
                      >
                        Accept work
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canAssign && (
            <div className="proposal-section task-form">
              <h3 className="ticket-details_heading">Assign a task</h3>

              <div className="form-field">
                <label htmlFor="taskTitle">Title</label>
                <input
                  id="taskTitle"
                  type="text"
                  value={task.title}
                  onChange={(event) => setTask((current) => ({ ...current, title: event.target.value }))}
                  placeholder="e.g. Build the application form API"
                />
              </div>

              <div className="form-field">
                <label htmlFor="taskDescription">Description</label>
                <textarea
                  id="taskDescription"
                  rows={3}
                  value={task.description}
                  onChange={(event) => setTask((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What should the developer build, and how will it be checked?"
                />
              </div>

              <div className="form-field-row">
                <div className="form-field">
                  <label htmlFor="taskDeveloper">Developer</label>
                  <select
                    id="taskDeveloper"
                    value={task.developerId}
                    onChange={(event) => setTask((current) => ({ ...current, developerId: event.target.value }))}
                    disabled={usersQuery.isLoading}
                  >
                    <option value="" disabled>
                      {usersQuery.isLoading ? "Loading developers…" : "Select a developer"}
                    </option>

                    {developers.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {capitalize(user.userName)} ({user.email})
                      </option>
                    ))}
                  </select>

                  {usersQuery.isSuccess && developers.length === 0 && (
                    <p className={isUserListForbidden() ? "form-error" : "form-field_hint"}>
                  {isUserListForbidden()
                    ? "Your role isn't allowed to read the user list yet, so no one can be chosen. This is waiting on the backend (gaps file R7)."
                    : "No active users with the Developer role were found."}
                </p>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="taskPriority">Priority</label>
                  <select
                    id="taskPriority"
                    value={task.priority}
                    onChange={(event) => setTask((current) => ({ ...current, priority: Number(event.target.value) }))}
                  >
                    {INITIATIVE_PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field-row">
                <div className="form-field">
                  <label htmlFor="taskStart">Start date</label>
                  <input
                    id="taskStart"
                    type="date"
                    min={today}
                    value={task.startDate}
                    onChange={(event) => setTask((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="taskTarget">Target date</label>
                  <input
                    id="taskTarget"
                    type="date"
                    min={task.startDate || today}
                    max={ticket.targetDate?.slice(0, 10)}
                    value={task.targetDate}
                    onChange={(event) => setTask((current) => ({ ...current, targetDate: event.target.value }))}
                  />
                </div>
              </div>

              <div className="brd-reviews-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleAssign}
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? "Assigning…" : "Assign task"}
                </button>
              </div>
            </div>
          )}

          <p className="mock-data-notice">
            Assigning and reviewing tasks use the live API. The task list and completing the ticket are
            simulated on this browser until the backend adds them (gaps files M10 and M12).
          </p>
        </section>
      )}

      <InitiativeContext initiativeId={initiative.id} initiativeName={initiative.projectName} />

      {isNew && (
        <ReviewDecisionBar
          hint="Read the ticket and the initiative's documents? Accept it to start assigning tasks, or reject it with a reason."
          onReject={() => setPending({ kind: "ticket", decision: "reject" })}
          onApprove={() => setPending({ kind: "ticket", decision: "approve" })}
          disabled={isDeciding}
        />
      )}

      {pending?.kind === "ticket" && (
        <DecisionModal
          decision={pending.decision}
          draftKey={ticketDraftKey}
          approveTitle="Accept ticket"
          rejectTitle="Reject ticket"
          approveBody="You'll then split it into tasks for your developers. No comment is needed."
          rejectLabel="Reason"
          rejectPlaceholder="What does the Product Manager need to change?"
          isPending={ticketDecisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPending(null)}
          onConfirm={confirmDecision}
        />
      )}

      {pending?.kind === "task" && (
        <DecisionModal
          decision={TASK_OUTCOME_COPY[pending.outcome].decision}
          draftKey={taskDraftKey(pending.task.id)}
          approveTitle={TASK_OUTCOME_COPY.Accepted.title}
          rejectTitle={TASK_OUTCOME_COPY[pending.outcome].title}
          approveBody={`This marks "${pending.task.title}" as done. No comment is needed.`}
          rejectLabel={TASK_OUTCOME_COPY[pending.outcome].label}
          rejectPlaceholder={TASK_OUTCOME_COPY[pending.outcome].placeholder}
          isPending={taskDecisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPending(null)}
          onConfirm={confirmDecision}
        />
      )}

      {confirmingComplete && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirmingComplete(false)}>
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-complete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="ticket-complete-title">Mark ticket completed</h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                Every task on this ticket has been reviewed. Completing it tells the Product Manager the work
                is done.
              </p>
            </div>

            <div className="modal-panel_footer">
              <button type="button" className="button button--secondary" onClick={() => setConfirmingComplete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? "Completing…" : "Complete ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketWorkspace;
