import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  getDesignScreens,
  getLogicFlowDocuments,
  reviewBdoDocumentation,
} from "../../mocks/bdoDocumentsMock";
import UploadedFileList from "../../components/bdo/UploadedFileList";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";

function BdoDocReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(id as string),
    enabled: Boolean(id),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", id],
    queryFn: () => getDiscoveryByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const logicFlowQuery = useQuery({
    queryKey: ["bdo-logic-flow", id],
    queryFn: () => getLogicFlowDocuments(id as string),
    enabled: Boolean(id),
  });

  const designScreensQuery = useQuery({
    queryKey: ["bdo-design-screens", id],
    queryFn: () => getDesignScreens(id as string),
    enabled: Boolean(id),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ isApproved, comment }: { isApproved: boolean; comment: string }) =>
      reviewBdoDocumentation(id as string, { isApproved, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdo-submission-status", id] });
      queryClient.invalidateQueries({ queryKey: ["bdo-rejection", id] });
      navigate("/dashboard/bdo-reviews");
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
    initiativeQuery.isLoading ||
    discoveryQuery.isLoading ||
    logicFlowQuery.isLoading ||
    designScreensQuery.isLoading;

  const hasError =
    initiativeQuery.isError ||
    !initiativeQuery.data ||
    discoveryQuery.isError ||
    logicFlowQuery.isError ||
    designScreensQuery.isError;

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading documentation…</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo-reviews" className="text-button">
          <ArrowLeft size={15} />
          Back to BDO Reviews
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this documentation. It may not exist, or you may not
          have access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const discovery = discoveryQuery.data;
  const logicFlowFiles = logicFlowQuery.data ?? [];
  const designScreenFiles = designScreensQuery.data ?? [];

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/bdo-reviews" className="text-button">
        <ArrowLeft size={15} />
        Back to BDO Reviews
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / BDO Reviews / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">{initiative.projectName} — Documentation</h1>

          <p className="dashboard-subtitle">
            Product discovery, logic flow, and design screens submitted by the BDO.
          </p>
        </div>

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
      </header>

      <p className="mock-data-notice">
        This documentation is temporary, local-only data until the real BDO
        workflow API is ready.
      </p>

      <section className="dashboard-panel">
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

      {pendingDecision && (
        <DecisionModal
          decision={pendingDecision}
          approveTitle="Approve documentation"
          rejectTitle="Reject documentation"
          approveBody="This approves the BDO's documentation. No comment is needed."
          rejectLabel="Rejection rationale"
          rejectPlaceholder="What needs to change before resubmission?"
          isPending={decisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPendingDecision(null)}
          onConfirm={confirmDecision}
        />
      )}
    </div>
  );
}

export default BdoDocReview;
