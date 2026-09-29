import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId, reviewProposal } from "../../service/ProposalService";
import { downloadBrdPdf } from "../../service/PdfService";
import { ApiError } from "../../apicalls/apiClient";
import BrdReadOnlyView from "../../components/brd/BrdReadOnlyView";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";
import { brdStatusBadgeClass } from "../../utils/brdStatus";

function BrdReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(id as string),
    enabled: Boolean(id),
  });

  const proposalQuery = useQuery({
    queryKey: ["product-proposal", id],
    queryFn: () => getProposalByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ isApproved, comment }: { isApproved: boolean; comment: string }) =>
      reviewProposal(proposalQuery.data?.id as string, { isApproved, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-proposal", id] });
      navigate("/dashboard/brd-reviews");
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to record this decision.",
      );
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadBrdPdf(id as string, initiativeQuery.data?.projectName ?? "BRD"),
    onSuccess: () => setDownloadError(""),
    onError: () => setDownloadError("Unable to download the BRD PDF. Try again."),
  });

  function openDecision(decision: Decision) {
    setErrorMessage("");
    setPendingDecision(decision);
  }

  function confirmDecision(comment: string) {
    setErrorMessage("");
    decisionMutation.mutate({ isApproved: pendingDecision === "approve", comment });
  }

  if (initiativeQuery.isLoading || proposalQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading BRD…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || proposalQuery.isError) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/brd-reviews" className="text-button">
          <ArrowLeft size={15} />
          Back to BRD Reviews
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this BRD. It may not exist, or you may not have
          access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const proposal = proposalQuery.data;

  if (!proposal) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/brd-reviews" className="text-button">
          <ArrowLeft size={15} />
          Back to BRD Reviews
        </Link>

        <p className="initiatives-empty initiative-detail-message">
          {initiative.projectName} doesn't have a BRD yet — there's nothing to
          review.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/brd-reviews" className="text-button">
        <ArrowLeft size={15} />
        Back to BRD Reviews
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / BRD Reviews / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">{initiative.projectName} — BRD</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span className={brdStatusBadgeClass(proposal.status)}>
              {proposal.status}
            </span>
            <span className="brd-version-tag">v{proposal.version}</span>
          </p>
        </div>

        <div className="dashboard-header__actions">
          {proposal.status === "Approved" ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending ? "Preparing PDF…" : "Download PDF"}
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>

      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}

      <BrdReadOnlyView proposal={proposal} />

      {pendingDecision && (
        <DecisionModal
          decision={pendingDecision}
          approveTitle="Approve BRD"
          rejectTitle="Reject BRD"
          approveBody="This approves the BRD. No comment is needed."
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

export default BrdReview;
