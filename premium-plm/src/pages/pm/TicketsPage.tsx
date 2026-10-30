import { Fragment, useState } from "react";
import { useParams } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";

import { getInitiativeById } from "../../service/InitiativeService";
import { getInitiativeDocuments } from "../../service/DocumentService";
import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import { documentsQueryKey } from "../../utils/documentStatus";
import { getAllUsers } from "../../service/UserService";
import {
  createTicket,
  getTasksForTicket,
  getTicketsForInitiative,
  recallTicket,
  submitTicket,
} from "../../service/TicketService";
import { getStoredUser } from "../../apicalls/authStorage";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { CreateTicketRequest, Ticket } from "../../types/ticketTypes";
import {
  formatDate,
  taskStatusBadgeClass,
  taskStatusLabel,
  ticketStatusBadgeClass,
  ticketStatusLabel,
} from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { activeUsersWithRole } from "../../utils/userStatus";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import BackLink from "../../components/common/BackLink";
import { TicketFields } from "../../components/tickets/TicketBrief";

type TicketForm = Omit<CreateTicketRequest, "initiativeId">;

const EMPTY_TICKET: TicketForm = {
  title: "",
  scope: "",
  functionalRequirements: "",
  expectedOutcome: "",
  priority: 3,
  targetDate: "",
  leadEngineerId: "",
  documentId: "",
};

// A ticket opened under its row: what was asked for, read like a filled-in
// form, then its developer tasks.
function TicketDetails({ ticket, userName }: { ticket: Ticket; userName: (id: string) => string }) {
  const tasksQuery = useQuery({
    queryKey: ["ticket-tasks", ticket.id],
    queryFn: () => getTasksForTicket(ticket.id),
  });

  const tasks = tasksQuery.data ?? [];

  return (
    <div className="ticket-details">
      {ticket.status === "Rejected" && (
        <div className="document-returned-note" role="status">
          <strong>Rejected by the Lead Engineer</strong>
          <p>{ticket.rejectionReason || "No reason was given."}</p>
        </div>
      )}

      <TicketFields ticket={ticket} leadEngineerName={userName(ticket.leadEngineerId)} />

      <div className="ticket-details_tasks">
        <h3 className="ticket-details_heading">Developer tasks</h3>

        {tasks.length === 0 ? (
          <p className="bdo-upload-empty">
            {tasksQuery.isLoading ? "Loading tasks…" : "The Lead Engineer hasn't assigned any tasks yet."}
          </p>
        ) : (
          <ul className="task-mini-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <span className="task-mini-list_title" title={task.title}>
                  {task.title}
                </span>
                <span>{userName(task.developerId)}</span>
                <span>Due {formatDate(task.targetDate)}</span>
                <span className={taskStatusBadgeClass(task.status)}>{taskStatusLabel(task.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TicketsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Creating and sending tickets is the PM's job — the Group Head (and
  // anyone else) can view this page to follow progress.
  const canManage = resolvePrimaryRole(getStoredUser()?.roles ?? []) === "ProjectManager";

  // A ticket being written is kept on this device until it's created.
  const [form, setForm, formDraft] = useDraftState<TicketForm>(`ticket-new:${id}`, EMPTY_TICKET);
  const [isCreating, setIsCreating] = useState(() => Boolean(formDraft.restoredAt));
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(id as string),
    enabled: Boolean(id),
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", id],
    queryFn: () => getTicketsForInitiative(id as string),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  // A ticket is built from one of the initiative's approved documents.
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(id),
    queryFn: () => getInitiativeDocuments(id as string),
    enabled: Boolean(id) && canManage,
  });

  const approvedDocuments = DOCUMENT_TYPES.map((type) => documentsQuery.data?.[type] ?? null).filter(
    (document) => document?.status === "Approved",
  );

  // Only active accounts can be assigned — deactivated users are left out.
  const leadEngineers = activeUsersWithRole(usersQuery.data, "LeadEngineer");

  function userName(userId: string) {
    return capitalize(usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned");
  }

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["lead-engineer-tickets"] }),
    ]);
  }

  function update<K extends keyof TicketForm>(key: K, value: TicketForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createTicket({
        ...form,
        initiativeId: id as string,
        title: form.title.trim(),
        scope: form.scope.trim(),
        functionalRequirements: form.functionalRequirements.trim(),
        expectedOutcome: form.expectedOutcome.trim(),
      }),
    onSuccess: async () => {
      setErrorMessage("");
      setIsCreating(false);
      setForm(EMPTY_TICKET);
      await refresh();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this ticket. Try again.");
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ ticketId, action }: { ticketId: string; action: "submit" | "recall" }) =>
      action === "submit" ? submitTicket(ticketId) : recallTicket(ticketId),
    onSuccess: async () => {
      setActionError("");
      await refresh();
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Couldn't update this ticket. Try again.");
    },
  });

  function handleCreate() {
    if (
      !form.documentId ||
      !form.title.trim() ||
      !form.scope.trim() ||
      !form.functionalRequirements.trim() ||
      !form.expectedOutcome.trim() ||
      !form.leadEngineerId
    ) {
      setErrorMessage("Choose the document, then fill in the title, scope, functional requirements, expected outcome and Lead Engineer.");
      return;
    }

    if (form.targetDate && form.targetDate < new Date().toISOString().slice(0, 10)) {
      setErrorMessage("The target date can't be in the past.");
      return;
    }

    setErrorMessage("");
    createMutation.mutate();
  }

  if (initiativeQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading tickets…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || !id) {
    return (
      <div className="dashboard-page">
        <BackLink fallbackTo="/dashboard/my-work" fallbackLabel="Back to my work" />

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not
          have access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const tickets = ticketsQuery.data ?? [];
  const isActing = (ticketId: string) => actionMutation.isPending && actionMutation.variables?.ticketId === ticketId;

  return (
    <div className="dashboard-page">
      <BackLink fallbackTo={`/dashboard/initiatives/${id}`} fallbackLabel={`Back to ${initiative.projectName}`} />

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Initiatives / {initiative.projectName} / Tickets
          </p>

          <h1 className="dashboard-title">{initiative.projectName} Tickets</h1>

          <p className="dashboard-subtitle">
            {canManage
              ? "Create tickets for the build and send each to a Lead Engineer, who splits it into developer tasks."
              : "Tickets for this initiative and their progress."}
          </p>
        </div>

        {canManage && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
            >
              + New ticket
            </button>
          </div>
        )}
      </header>

      <DraftRestoredNotice
        savedAt={formDraft.restoredAt}
        onDiscard={formDraft.discard}
        keepHint="Create the ticket to keep them."
      />

      <p className="mock-data-notice">
        This list shows the tickets created on this browser until the backend can list an initiative's
        tickets (gaps file M9).
      </p>

      {canManage && isCreating && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>New {initiative.projectName} ticket</h2>
              <p>
                It's attached to {initiative.projectName} and saved as a draft. Send it to the Lead Engineer when
                it's ready.
              </p>
            </div>
          </div>

          <div className="proposal-section">
            <div className="form-field">
              <label htmlFor="ticketDocument">Document</label>
              <select
                id="ticketDocument"
                value={form.documentId ?? ""}
                onChange={(event) => update("documentId", event.target.value)}
                disabled={documentsQuery.isLoading}
              >
                <option value="" disabled>
                  {documentsQuery.isLoading ? "Loading documents…" : "Select the document this ticket is built from"}
                </option>

                {approvedDocuments.map((document) =>
                  document ? (
                    <option key={document.id} value={document.id}>
                      {document.type} · {DOCUMENT_META[document.type].name}
                    </option>
                  ) : null,
                )}
              </select>

              {documentsQuery.isSuccess && approvedDocuments.length === 0 && (
                <p className="form-field_hint">
                  None of this initiative's documents is approved yet. A ticket can be created once the Group Head
                  approves its PID, FRD, BRD or SWR.
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="ticketTitle">Title</label>
              <input
                id="ticketTitle"
                type="text"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="e.g. Build the loan application form"
              />
            </div>

            <div className="form-field">
              <label htmlFor="ticketScope">Scope</label>
              <textarea
                id="ticketScope"
                rows={3}
                value={form.scope}
                onChange={(event) => update("scope", event.target.value)}
                placeholder="What does this ticket cover, and what's out of scope?"
              />
            </div>

            <div className="form-field">
              <label htmlFor="ticketRequirements">Functional requirements</label>
              <textarea
                id="ticketRequirements"
                rows={4}
                value={form.functionalRequirements}
                onChange={(event) => update("functionalRequirements", event.target.value)}
                placeholder="What must it do? One requirement per line works well."
              />
            </div>

            <div className="form-field">
              <label htmlFor="ticketOutcome">Expected outcome</label>
              <textarea
                id="ticketOutcome"
                rows={2}
                value={form.expectedOutcome}
                onChange={(event) => update("expectedOutcome", event.target.value)}
                placeholder="How will we know it's done?"
              />
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="ticketPriority">Priority</label>
                <select
                  id="ticketPriority"
                  value={form.priority}
                  onChange={(event) => update("priority", Number(event.target.value))}
                >
                  {INITIATIVE_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="ticketTargetDate">Target date</label>
                <input
                  id="ticketTargetDate"
                  type="date"
                  value={form.targetDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => update("targetDate", event.target.value)}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="leadEngineerId">Lead Engineer</label>

              <select
                id="leadEngineerId"
                value={form.leadEngineerId}
                onChange={(event) => update("leadEngineerId", event.target.value)}
                disabled={usersQuery.isLoading}
              >
                <option value="" disabled>
                  {usersQuery.isLoading ? "Loading Lead Engineers…" : "Select a Lead Engineer"}
                </option>

                {leadEngineers.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {capitalize(user.userName)} ({user.email})
                  </option>
                ))}
              </select>

              {/* {usersQuery.isSuccess && leadEngineers.length === 0 && (
                <p className={isUserListForbidden() ? "form-error" : "form-field_hint"}>
                  {isUserListForbidden()
                    ? "No permissions"
                    : "No active users with the Lead Engineer role were found."}
                </p>
              )} */}
            </div>

            {errorMessage && (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="modal-panel_footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                // Cancelling the new ticket on purpose — don't keep what was typed.
                formDraft.discard();
                setIsCreating(false);
                setErrorMessage("");
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </section>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Lead Engineer</th>
                <th>Priority</th>
                <th>Target date</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {ticketsQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Loading tickets…
                  </td>
                </tr>
              )}

              {!ticketsQuery.isLoading &&
                tickets.map((ticket) => (
                  <Fragment key={ticket.id}>
                    <tr>
                      <td>
                        <div className="initiative-cell">
                          <strong title={ticket.title}>{ticket.title}</strong>
                          <span>
                            {[ticket.requestNumber, ticket.documentType, `Created ${formatDate(ticket.createdAt)}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      </td>

                      <td>{userName(ticket.leadEngineerId)}</td>

                      <td>
                        <span className={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>
                      </td>

                      <td>{formatDate(ticket.targetDate)}</td>

                      <td>
                        <span className={ticketStatusBadgeClass(ticket.status)}>{ticketStatusLabel(ticket.status)}</span>
                      </td>

                      <td>
                        <div className="brd-reviews-actions ticket-row-actions">
                        <button
                          type="button"
                          className="table-action table-action--dark"
                          onClick={() => setOpenTicketId((current) => (current === ticket.id ? null : ticket.id))}
                          aria-expanded={openTicketId === ticket.id}
                        >
                          {openTicketId === ticket.id ? "Hide" : "View"}
                        </button>

                        {canManage && (ticket.status === "Draft" || ticket.status === "Rejected") && (
                          <button
                            type="button"
                            className="table-action table-action--premium"
                            onClick={() => actionMutation.mutate({ ticketId: ticket.id, action: "submit" })}
                            disabled={isActing(ticket.id)}
                          >
                            {isActing(ticket.id)
                              ? "Sending…"
                              : ticket.status === "Rejected"
                                ? "Send again"
                                : "Send to Lead Engineer"}
                          </button>
                        )}

                        {canManage && ticket.status === "WithLeadEngineer" && (
                          <button
                            type="button"
                            className="table-action table-action--dark"
                            onClick={() => actionMutation.mutate({ ticketId: ticket.id, action: "recall" })}
                            disabled={isActing(ticket.id)}
                          >
                            {isActing(ticket.id) ? "Recalling…" : "Recall"}
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>

                    {openTicketId === ticket.id && (
                      <tr className="ticket-details-row">
                        <td colSpan={6}>
                          <TicketDetails ticket={ticket} userName={userName} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}

              {!ticketsQuery.isLoading && tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    No tickets created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default TicketsPage;
