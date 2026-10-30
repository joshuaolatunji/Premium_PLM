import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GitBranch } from "lucide-react";

import { useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";
import { getInitiativeById } from "../../service/InitiativeService";
import { getTask, getTaskHistory, getTicket, startTask, submitTask } from "../../service/TicketService";
import type { SubmitTaskRequest } from "../../types/ticketTypes";
import TicketBrief from "../../components/tickets/TicketBrief";
import InitiativeContext from "../../components/tickets/InitiativeContext";
import BackLink from "../../components/common/BackLink";
import ReadOnlyField from "../../components/common/ReadOnlyField";
import { formatDate, taskStatusBadgeClass, taskStatusLabel } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

const EMPTY_SUBMISSION: SubmitTaskRequest = { comment: "", pullRequestUrl: "", branchName: "" };

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// One task for the developer: start it, then submit it to the Lead Engineer
// with a note, the pull request and the branch.
function DeveloperTicketWorkspace() {
  const { taskId } = useParams<{ taskId: string }>();
  const queryClient = useQueryClient();

  // What's typed for the submission is kept on this device until it's sent.
  const [submission, setSubmission, submissionDraft] = useDraftState<SubmitTaskRequest>(
    `task-submit:${taskId}`,
    EMPTY_SUBMISSION,
  );
  const [errorMessage, setErrorMessage] = useState("");

  const taskQuery = useQuery({
    queryKey: ["developer-task", taskId],
    queryFn: () => getTask(taskId as string),
    enabled: Boolean(taskId),
  });

  const task = taskQuery.data ?? null;

  // The parent ticket, for the PM's brief. A developer may not be allowed to
  // read it, so a failure just hides the brief.
  const ticketQuery = useQuery({
    queryKey: ["ticket", task?.ticketId],
    queryFn: () => getTicket(task?.ticketId as string),
    enabled: Boolean(task?.ticketId),
    retry: false,
  });

  const initiativeId = ticketQuery.data?.initiativeId || task?.initiativeId || null;

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", initiativeId],
    queryFn: () => getInitiativeById(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const historyQuery = useQuery({
    queryKey: ["developer-task-history", taskId],
    queryFn: () => getTaskHistory(taskId as string),
    enabled: Boolean(taskId),
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["developer-task", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["developer-task-history", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["developer-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["ticket-tasks"] }),
    ]);
  }

  const startMutation = useMutation({
    mutationFn: () => startTask(taskId as string),
    onSuccess: async () => {
      setErrorMessage("");
      await refresh();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't start this task."),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitTask(taskId as string, {
        comment: submission.comment.trim(),
        pullRequestUrl: submission.pullRequestUrl.trim(),
        branchName: submission.branchName.trim(),
      }),
    onSuccess: async () => {
      setErrorMessage("");
      setSubmission(EMPTY_SUBMISSION);
      await refresh();
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't submit this task."),
  });

  function handleSubmit() {
    if (!submission.comment.trim()) {
      setErrorMessage("Add a note for your Lead Engineer about what you did.");
      return;
    }

    if (submission.pullRequestUrl.trim() && !isValidUrl(submission.pullRequestUrl.trim())) {
      setErrorMessage("The pull request link must be a full web address, starting with https://");
      return;
    }

    setErrorMessage("");
    submitMutation.mutate();
  }

  if (taskQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading task…</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="dashboard-page">
        <BackLink fallbackTo="/dashboard/developer" fallbackLabel="Back to your tasks" />

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this task. It may not exist, or you may not have access to it.
        </p>
      </div>
    );
  }

  const history = historyQuery.data ?? [];
  // The Lead Engineer's comment from the history, for when it wasn't
  // recorded on this device.
  const reviewComment = history.find((entry) => entry.comment && entry.actor !== task.developerId)?.comment ?? null;
  const canSubmit = task.status === "InProgress" || task.status === "ReworkRequested";

  return (
    <div className="dashboard-page">
      <BackLink fallbackTo="/dashboard/developer" fallbackLabel="Back to your tasks" />

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Tasks / {initiativeQuery.data ? `${initiativeQuery.data.projectName} / ` : ""}
            {task.title}
          </p>

          <h1 className="dashboard-title">{task.title}</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            {initiativeQuery.data && <span>{initiativeQuery.data.projectName}</span>}
            {task.ticketTitle && <span>Ticket: {task.ticketTitle}</span>}
            <span className={priorityBadgeClass(task.priority)}>{priorityLabel(task.priority)}</span>
            <span className={taskStatusBadgeClass(task.status)}>{taskStatusLabel(task.status)}</span>
          </p>
        </div>

        {task.status === "Assigned" && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? "Starting…" : "Start task"}
            </button>
          </div>
        )}
      </header>

      <DraftRestoredNotice
        savedAt={submissionDraft.restoredAt}
        onDiscard={submissionDraft.discard}
        keepHint="Submit the task to keep them."
      />

      {task.status === "ReworkRequested" && (
        <div className="bdo-rejection-notice">
          <strong>Rework requested by your Lead Engineer:</strong>{" "}
          {task.review?.comment || reviewComment || "Make the changes asked for, then resubmit."}
        </div>
      )}

      {task.status === "Rejected" && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by your Lead Engineer:</strong> {task.review?.comment || reviewComment || "No reason recorded."}
        </div>
      )}

      {task.status === "UnderReview" && (
        <div className="document-returned-note">
          <strong>Your Lead Engineer is reviewing this task.</strong>
        </div>
      )}

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Task</h2>
          </div>
        </div>

        <div className="proposal-section ticket-view">
          <div className="ticket-view_facts">
            <ReadOnlyField label="Start date" value={formatDate(task.startDate)} />
            <ReadOnlyField label="Target date" value={formatDate(task.targetDate)} />
            <ReadOnlyField label="Started" value={formatDate(task.startedAt)} />
          </div>

          <ReadOnlyField label="What to do" value={task.description} />
        </div>
      </section>

      {canSubmit && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>{task.status === "ReworkRequested" ? "Resubmit for review" : "Submit for review"}</h2>
              <p>Send your work to the Lead Engineer when it's ready.</p>
            </div>
          </div>

          <div className="proposal-section">
            <div className="form-field">
              <label htmlFor="submitComment">Note for the Lead Engineer</label>
              <textarea
                id="submitComment"
                rows={3}
                value={submission.comment}
                onChange={(event) => setSubmission((current) => ({ ...current, comment: event.target.value }))}
                placeholder="What did you build or change, and how was it tested?"
              />
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="submitPr">Pull request link (optional)</label>
                <input
                  id="submitPr"
                  type="url"
                  value={submission.pullRequestUrl}
                  onChange={(event) => setSubmission((current) => ({ ...current, pullRequestUrl: event.target.value }))}
                  placeholder="https://github.com/…/pull/123"
                />
              </div>

              <div className="form-field">
                <label htmlFor="submitBranch">Branch (optional)</label>
                <input
                  id="submitBranch"
                  type="text"
                  value={submission.branchName}
                  onChange={(event) => setSubmission((current) => ({ ...current, branchName: event.target.value }))}
                  placeholder="feature/loan-form"
                />
              </div>
            </div>

            <div className="brd-reviews-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </div>
        </section>
      )}

      {task.submission && task.status === "Submitted" && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>Your submission</h2>
              <p>With your Lead Engineer for review since {formatDate(task.submission.submittedAt)}.</p>
            </div>
          </div>

          <div className="task-card_submission task-card_submission--panel">
            <p>{task.submission.comment || "—"}</p>
            <div className="task-card_links">
              {task.submission.pullRequestUrl && (
                <a href={task.submission.pullRequestUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} aria-hidden="true" />
                  Pull request
                </a>
              )}
              {task.submission.branchName && (
                <span>
                  <GitBranch size={14} aria-hidden="true" />
                  {task.submission.branchName}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>History</h2>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="initiatives-empty">{historyQuery.isLoading ? "Loading history…" : "Nothing recorded yet."}</p>
        ) : (
          <ol className="task-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span className="task-history_when">{entry.at ? formatDate(entry.at) : "—"}</span>
                <div>
                  <strong>{entry.action}</strong>
                  {/* The history gives a user id: on a task it's either the developer or their Lead Engineer. */}
                  {entry.actor && <span> · {entry.actor === task.developerId ? "You" : "Lead Engineer"}</span>}
                  {entry.comment && <p>{entry.comment}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {ticketQuery.data && initiativeQuery.data && (
        <TicketBrief ticket={ticketQuery.data} initiativeName={initiativeQuery.data.projectName} />
      )}

      {initiativeQuery.data && (
        <InitiativeContext initiativeId={initiativeQuery.data.id} initiativeName={initiativeQuery.data.projectName} />
      )}
    </div>
  );
}

export default DeveloperTicketWorkspace;
