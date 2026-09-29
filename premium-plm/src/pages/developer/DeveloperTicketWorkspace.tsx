import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  getTicketById,
  getTicketRejection,
  submitTicketForReview,
} from "../../mocks/ticketsMock";
import {
  getDesignScreens,
  getLogicFlowDocuments,
} from "../../mocks/bdoDocumentsMock";
import BrdReadOnlyView from "../../components/brd/BrdReadOnlyView";
import UploadedFileList from "../../components/bdo/UploadedFileList";
import { priorityLabel } from "../../utils/initiativeStatus";
import { ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";

// Mocked — tickets have no real endpoint yet (see mocks/ticketsMock.ts).
// The BRD/discovery lookups below are real; logic flow and design screens
// stay mocked (see mocks/bdoDocumentsMock.ts).
function DeveloperTicketWorkspace() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();

  const [errorMessage, setErrorMessage] = useState("");

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

  const rejectionQuery = useQuery({
    queryKey: ["ticket-rejection", ticketId],
    queryFn: () => getTicketRejection(ticketId as string),
    enabled: Boolean(ticketId),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTicketForReview(initiativeId as string, ticketId as string),
    onSuccess: () => {
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["developer-tickets"] });
    },
    onError: () => {
      setErrorMessage("Unable to submit this ticket for review. Try again.");
    },
  });

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
        <Link to="/dashboard/developer" className="text-button">
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
  const canSubmit = ticket.status === "InProgress" || ticket.status === "Rejected";

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/developer" className="text-button">
        <ArrowLeft size={15} />
        Back to your tickets
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Developer / {ticket.title}
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

        {canSubmit && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        )}
      </header>

      <p className="mock-data-notice">
        Tickets are temporary, local-only data until the real tickets API is
        ready — they reset if you reload the page.
      </p>

      {ticket.status === "Rejected" && rejectionQuery.data && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by your Lead Engineer:</strong> {rejectionQuery.data.comment}
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
            <span className="initiative-detail-grid_label">Your timeline slice</span>
            <span className="initiative-detail-grid_value">
              {ticket.developerTimelineDays !== null
                ? `${ticket.developerTimelineDays} days`
                : "—"}
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
    </div>
  );
}

export default DeveloperTicketWorkspace;
