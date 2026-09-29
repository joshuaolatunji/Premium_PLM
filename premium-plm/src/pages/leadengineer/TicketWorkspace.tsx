import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getAllUsers } from "../../service/UserService";
import {
  assignTicketToDeveloper,
  getTicketById,
  getTicketRejection,
  reviewTicket,
} from "../../mocks/ticketsMock";
import {
  getDesignScreens,
  getLogicFlowDocuments,
} from "../../mocks/bdoDocumentsMock";
import BrdReadOnlyView from "../../components/brd/BrdReadOnlyView";
import UploadedFileList from "../../components/bdo/UploadedFileList";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";
import { priorityLabel } from "../../utils/initiativeStatus";
import { ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";

// Mocked — tickets, and the developer assignment on them, have no real
// endpoint yet (see mocks/ticketsMock.ts). The BRD/discovery lookups below
// are real; logic flow and design screens stay mocked (see
// mocks/bdoDocumentsMock.ts).
function TicketWorkspace() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [developerId, setDeveloperId] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketById(ticketId as string),
    enabled: Boolean(ticketId),
  });

  const initiativeId = ticketQuery.data?.initiativeId ?? null;

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", initiativeId],
    queryFn: () => getInitiativeById(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const proposalQuery = useQuery({
    queryKey: ["product-proposal", initiativeId],
    queryFn: () => getProposalByInitiativeId(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", initiativeId],
    queryFn: () => getDiscoveryByInitiativeId(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const logicFlowQuery = useQuery({
    queryKey: ["bdo-logic-flow", initiativeId],
    queryFn: () => getLogicFlowDocuments(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const designScreensQuery = useQuery({
    queryKey: ["bdo-design-screens", initiativeId],
    queryFn: () => getDesignScreens(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const rejectionQuery = useQuery({
    queryKey: ["ticket-rejection", ticketId],
    queryFn: () => getTicketRejection(ticketId as string),
    enabled: Boolean(ticketId),
  });

  const developers = (usersQuery.data ?? []).filter((user) =>
    user.role.includes("SoftwareEngineer"),
  );

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned";
  }

  const assignMutation = useMutation({
    mutationFn: () =>
      assignTicketToDeveloper(
        initiativeId as string,
        ticketId as string,
        developerId,
        Number(timelineDays),
      ),
    onSuccess: () => {
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["lead-engineer-tickets"] });
    },
    onError: () => {
      setErrorMessage("Unable to assign this ticket. Try again.");
    },
  });

  function handleAssign() {
    const days = Number(timelineDays);

    if (!developerId) {
      setErrorMessage("Select a developer.");
      return;
    }

    if (!timelineDays || Number.isNaN(days) || days < 0) {
      setErrorMessage("Enter a valid number of days.");
      return;
    }

    setErrorMessage("");
    assignMutation.mutate();
  }

  const decisionMutation = useMutation({
    mutationFn: ({ isApproved, comment }: { isApproved: boolean; comment: string }) =>
      reviewTicket(initiativeId as string, ticketId as string, { isApproved, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-engineer-tickets"] });
      navigate("/dashboard/lead-engineer");
    },
    onError: () => {
      setErrorMessage("Unable to record this decision. Try again.");
    },
  });

  function openDecision(decision: Decision) {
    setErrorMessage("");
    setPendingDecision(decision);
  }

  function confirmDecision(comment: string) {
    setErrorMessage("");
    decisionMutation.mutate({ isApproved: pendingDecision === "approve", comment });
  }

  const isLoading =
    ticketQuery.isLoading ||
    (Boolean(initiativeId) &&
      (initiativeQuery.isLoading ||
        proposalQuery.isLoading ||
        discoveryQuery.isLoading ||
        logicFlowQuery.isLoading ||
        designScreensQuery.isLoading));

  const hasError =
    ticketQuery.isError ||
    !ticketQuery.data ||
    initiativeQuery.isError ||
    (Boolean(initiativeId) && !initiativeQuery.data);

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading ticket…</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/lead-engineer" className="text-button">
          <ArrowLeft size={15} />
          Back to your tickets
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this ticket. It may not exist, or you may not have
          access to it.
        </p>
      </div>
    );
  }

  const ticket = ticketQuery.data!;
  const initiative = initiativeQuery.data!;
  const proposal = proposalQuery.data;
  const discovery = discoveryQuery.data;
  const logicFlowFiles = logicFlowQuery.data ?? [];
  const designScreenFiles = designScreensQuery.data ?? [];

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/lead-engineer" className="text-button">
        <ArrowLeft size={15} />
        Back to your tickets
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Lead Engineer / {ticket.title}
          </p>

          <h1 className="dashboard-title">{ticket.title}</h1>

          <p className="dashboard-subtitle">{ticket.description}</p>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span className="priority-badge">{priorityLabel(initiative.priority)}</span>
            <span className={ticketStatusBadgeClass(ticket.status)}>
              {ticketStatusLabel(ticket.status)}
            </span>
          </p>
        </div>

        {ticket.status === "UnderReview" && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--secondary brd-reject-button"
              onClick={() => openDecision("reject")}
              disabled={decisionMutation.isPending}
            >
              Reject
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={() => openDecision("approve")}
              disabled={decisionMutation.isPending}
            >
              Approve
            </button>
          </div>
        )}
      </header>

      <p className="mock-data-notice">
        Tickets and developer assignment are temporary, local-only data
        until the real tickets API is ready — they reset if you reload the
        page.
      </p>

      {ticket.status === "Rejected" && rejectionQuery.data && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by you:</strong> {rejectionQuery.data.comment}
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
            <h2>Project</h2>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <div>
            <span className="initiative-detail-grid_label">Initiative</span>
            <span className="initiative-detail-grid_value">{initiative.projectName}</span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Ticket timeline</span>
            <span className="initiative-detail-grid_value">
              {ticket.timelineDaysAllocated !== null
                ? `${ticket.timelineDaysAllocated} days`
                : "Not yet allocated by the Project Manager"}
            </span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Business Requirements Document</h2>
          </div>
        </div>

        {proposal ? (
          <BrdReadOnlyView proposal={proposal} />
        ) : (
          <p className="initiatives-empty">No BRD has been created yet.</p>
        )}
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Product discovery</h2>
          </div>
        </div>

        {discovery ? (
          <div className="initiative-detail-grid">
            <div>
              <span className="initiative-detail-grid_label">Business logic</span>
              <span className="initiative-detail-grid_value brd-readonly-value">
                {discovery.businessLogic || "—"}
              </span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">Customer journey</span>
              <span className="initiative-detail-grid_value brd-readonly-value">
                {discovery.customerJourney || "—"}
              </span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">User flow</span>
              <span className="initiative-detail-grid_value brd-readonly-value">
                {discovery.userFlow || "—"}
              </span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">Business process</span>
              <span className="initiative-detail-grid_value brd-readonly-value">
                {discovery.businessProcess || "—"}
              </span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">Assumptions</span>
              <span className="initiative-detail-grid_value brd-readonly-value">
                {discovery.assumptions || "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="initiatives-empty">No discovery document was saved.</p>
        )}
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Logic flow document</h2>
          </div>
        </div>

        <div className="bdo-upload-section">
          <UploadedFileList
            files={logicFlowFiles}
            emptyLabel="No logic flow document was uploaded."
          />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Design screens documentation</h2>
          </div>
        </div>

        <div className="bdo-upload-section">
          <UploadedFileList
            files={designScreenFiles}
            emptyLabel="No design screens were uploaded."
          />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Developer assignment</h2>
          </div>
        </div>

        {ticket.assignedDeveloperId ? (
          <div className="initiative-detail-grid">
            <div>
              <span className="initiative-detail-grid_label">Developer</span>
              <span className="initiative-detail-grid_value">
                {userName(ticket.assignedDeveloperId)}
              </span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">Timeline slice</span>
              <span className="initiative-detail-grid_value">
                {ticket.developerTimelineDays} days
              </span>
            </div>
          </div>
        ) : (
          <div className="proposal-section">
            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="developerId">Developer</label>

                <select
                  id="developerId"
                  value={developerId}
                  onChange={(event) => setDeveloperId(event.target.value)}
                  disabled={usersQuery.isLoading}
                >
                  <option value="" disabled>
                    {usersQuery.isLoading ? "Loading developers…" : "Select a developer"}
                  </option>

                  {developers.map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.userName} ({user.email})
                    </option>
                  ))}
                </select>

                {usersQuery.isSuccess && developers.length === 0 && (
                  <p className="form-field_hint">
                    No users with the Developer role were found yet.
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="timelineDays">Timeline slice (days)</label>
                <input
                  id="timelineDays"
                  type="number"
                  min={0}
                  value={timelineDays}
                  onChange={(event) => setTimelineDays(event.target.value)}
                  placeholder={
                    ticket.timelineDaysAllocated !== null
                      ? `Out of ${ticket.timelineDaysAllocated} days`
                      : undefined
                  }
                />
              </div>
            </div>

            <button
              type="button"
              className="button button--primary"
              onClick={handleAssign}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning…" : "Assign to developer"}
            </button>
          </div>
        )}
      </section>

      {pendingDecision && (
        <DecisionModal
          decision={pendingDecision}
          approveTitle="Approve work"
          rejectTitle="Reject work"
          approveBody="This marks the ticket as completed. No comment is needed."
          rejectLabel="Rejection rationale"
          rejectPlaceholder="What needs to change before the developer resubmits?"
          isPending={decisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPendingDecision(null)}
          onConfirm={confirmDecision}
        />
      )}
    </div>
  );
}

export default TicketWorkspace;
