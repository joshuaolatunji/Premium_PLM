import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId, reviewProposal } from "../../service/ProposalService";
import { isBrdAwaitingBdoDecision } from "../../utils/initiativeStatus";
import BrdReadOnlyView from "../../components/brd/BrdReadOnlyView";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";

function BdoBrdReview() {
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
      navigate("/dashboard/bdo-brd-reviews");
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

  const isLoading = initiativeQuery.isLoading || proposalQuery.isLoading;
  const hasError =
    initiativeQuery.isError ||
    !initiativeQuery.data ||
    proposalQuery.isError ||
    !proposalQuery.data;

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading BRD…</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo-brd-reviews" className="text-button">
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
    return null;
  }

  // Only a BRD still in the BDO's stage is actionable. Once decided it has
  // either moved on to the Group Head or been rejected back to the PM.
  if (!isBrdAwaitingBdoDecision(proposal.status)) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo-brd-reviews" className="text-button">
          <ArrowLeft size={15} />
          Back to BRD Reviews
        </Link>

        <p className="initiatives-empty initiative-detail-message">
          {proposal.status === "Rejected"
            ? `${initiative.projectName}'s BRD is back with the PM to revise. It will be available to review again once they resubmit it.`
            : `This BRD is no longer waiting on your decision. It has already been forwarded to the Group Head or approved.`}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/bdo-brd-reviews" className="text-button">
        <ArrowLeft size={15} />
        Back to BRD Reviews
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / BRD Reviews / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">{initiative.projectName} — BRD</h1>

          <p className="dashboard-subtitle">
            Approving sends this BRD on to the Group Head for the final
            decision. Rejecting sends it back to the Project Manager.
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

      <BrdReadOnlyView proposal={proposal} />

      {pendingDecision && (
        <DecisionModal
          decision={pendingDecision}
          approveTitle="Approve BRD"
          rejectTitle="Reject BRD"
          approveBody="This forwards the BRD to the Group Head for the final decision. No comment is needed."
          rejectLabel="Rejection rationale"
          rejectPlaceholder="What needs to change before the Project Manager resends this?"
          isPending={decisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPendingDecision(null)}
          onConfirm={confirmDecision}
        />
      )}
    </div>
  );
}

export default BdoBrdReview;
