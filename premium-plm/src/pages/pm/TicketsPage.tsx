import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getAllUsers } from "../../service/UserService";
import {
  allocateTicketTimeline,
  createTicket,
  getTicketsForInitiative,
} from "../../mocks/ticketsMock";
import { getCurrentUserId, getStoredUser } from "../../apicalls/authStorage";
import { ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";
import { capitalize } from "../../utils/text";
import { resolvePrimaryRole } from "../../utils/roleRouting";

function TicketsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUserId = getCurrentUserId();

  // Ticket creation and timeline allocation are the PM's job — the Group
  // Head (and anyone else) can view this page to monitor progress, but
  // not create or manage tickets.
  const canManage = resolvePrimaryRole(getStoredUser()?.roles ?? []) === "ProjectManager";

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [leadEngineerId, setLeadEngineerId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [timelineDrafts, setTimelineDrafts] = useState<Record<string, string>>({});

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

  const proposalQuery = useQuery({
    queryKey: ["product-proposal", id],
    queryFn: () => getProposalByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const leadEngineers = (usersQuery.data ?? []).filter((user) =>
    user.role.includes("LeadEngineer"),
  );

  function userName(userId: string) {
    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned",
    );
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createTicket(
        {
          initiativeId: id as string,
          title: title.trim(),
          description: description.trim(),
          assignedLeadEngineerId: leadEngineerId,
        },
        currentUserId ?? "",
      ),
    onSuccess: () => {
      setErrorMessage("");
      setIsCreating(false);
      setTitle("");
      setDescription("");
      setLeadEngineerId("");
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    },
    onError: () => {
      setErrorMessage("Unable to create this ticket. Try again.");
    },
  });

  const timelineMutation = useMutation({
    mutationFn: ({ ticketId, days }: { ticketId: string; days: number }) =>
      allocateTicketTimeline(id as string, ticketId, days),
    onSuccess: (_data, variables) => {
      setTimelineDrafts((current) => {
        const next = { ...current };
        delete next[variables.ticketId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    },
  });

  function saveTimeline(ticketId: string) {
    const draft = timelineDrafts[ticketId];
    const days = Number(draft);

    if (!draft || Number.isNaN(days) || days < 0) {
      return;
    }

    timelineMutation.mutate({ ticketId, days });
  }

  function handleCreate() {
    if (!title.trim() || !description.trim() || !leadEngineerId) {
      setErrorMessage("Please fill in all fields.");
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
        <Link to="/dashboard/my-work" className="text-button">
          <ArrowLeft size={15} />
          Back to my work
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not
          have access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const tickets = ticketsQuery.data ?? [];
  const isBrdApproved = proposalQuery.data?.status === "Approved";

  return (
    <div className="dashboard-page">
      <Link to={`/dashboard/initiatives/${id}`} className="text-button">
        <ArrowLeft size={15} />
        Back to {initiative.projectName}
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Initiatives / {initiative.projectName} / Tickets
          </p>

          <h1 className="dashboard-title">Tickets</h1>

          <p className="dashboard-subtitle">
            {canManage
              ? "Create and assign tickets to a Lead Engineer before starting the BRD."
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

      <p className="mock-data-notice">
        Tickets are temporary, local-only data until the real tickets API is
        ready — they reset if you reload the page.
      </p>

      {canManage && isCreating && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>New ticket</h2>
            </div>
          </div>

          <div className="proposal-section">
            <div className="form-field">
              <label htmlFor="ticketTitle">Title</label>
              <input
                id="ticketTitle"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Build the loan application form"
              />
            </div>

            <div className="form-field">
              <label htmlFor="ticketDescription">Description</label>
              <textarea
                id="ticketDescription"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What does this ticket cover?"
              />
            </div>

            <div className="form-field">
              <label htmlFor="leadEngineerId">Lead Engineer</label>

              <select
                id="leadEngineerId"
                value={leadEngineerId}
                onChange={(event) => setLeadEngineerId(event.target.value)}
                disabled={usersQuery.isLoading}
              >
                <option value="" disabled>
                  {usersQuery.isLoading
                    ? "Loading Lead Engineers…"
                    : "Select a Lead Engineer"}
                </option>

                {leadEngineers.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {capitalize(user.userName)} ({user.email})
                  </option>
                ))}
              </select>

              {usersQuery.isSuccess && leadEngineers.length === 0 && (
                <p className="form-field_hint">
                  No users with the Lead Engineer role were found yet.
                </p>
              )}
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

      {canManage && tickets.length > 0 && !isBrdApproved && (
        <p className="mock-data-notice">
          Timeline allocation unlocks once this initiative's BRD is approved.
        </p>
      )}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Lead Engineer</th>
                <th>Status</th>
                <th>Timeline (days)</th>
              </tr>
            </thead>

            <tbody>
              {ticketsQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    Loading tickets…
                  </td>
                </tr>
              )}

              {!ticketsQuery.isLoading &&
                tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="initiative-cell">
                        <strong>{ticket.title}</strong>
                        <span>{ticket.description}</span>
                      </div>
                    </td>

                    <td>{userName(ticket.assignedLeadEngineerId)}</td>

                    <td>
                      <span className={ticketStatusBadgeClass(ticket.status)}>
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </td>

                    <td>
                      {isBrdApproved && canManage ? (
                        <div className="ticket-timeline-cell">
                          <input
                            type="number" onFocus={(event) => event.target.select()}
                            min={0}
                            className="ticket-timeline-input"
                            value={
                              timelineDrafts[ticket.id] ??
                              (ticket.timelineDaysAllocated ?? "")
                            }
                            onChange={(event) =>
                              setTimelineDrafts((current) => ({
                                ...current,
                                [ticket.id]: event.target.value,
                              }))
                            }
                          />

                          <button
                            type="button"
                            className="table-action"
                            onClick={() => saveTimeline(ticket.id)}
                            disabled={
                              timelineMutation.isPending &&
                              timelineMutation.variables?.ticketId === ticket.id
                            }
                          >
                            {timelineMutation.isPending &&
                            timelineMutation.variables?.ticketId === ticket.id
                              ? "Saving…"
                              : "Save"}
                          </button>
                        </div>
                      ) : (
                        (ticket.timelineDaysAllocated ?? "—")
                      )}
                    </td>
                  </tr>
                ))}

              {!ticketsQuery.isLoading && tickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
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
