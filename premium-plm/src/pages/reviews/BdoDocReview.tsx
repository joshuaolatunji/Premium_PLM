import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Link2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { ApiError } from "../../apicalls/apiClient";
import {
  getDiscoveryAttachments,
  getDiscoveryByInitiativeId,
  getDiscoveryWorkflowLinks,
  openDiscoveryAttachment,
  reviewDiscovery,
} from "../../service/ProductDiscoveryService";
import { capitalize } from "../../utils/text";
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

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  function reviewerName(userId: string | null) {
    if (!userId) {
      return "the Group Head";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "the Group Head",
    );
  }

  const discoveryId = discoveryQuery.data?.id ?? null;

  const attachmentsQuery = useQuery({
    queryKey: ["discovery-attachments", discoveryId],
    queryFn: () => getDiscoveryAttachments(discoveryId as string),
    enabled: Boolean(discoveryId),
  });

  const workflowLinksQuery = useQuery({
    queryKey: ["discovery-workflow-links", discoveryId],
    queryFn: () => getDiscoveryWorkflowLinks(discoveryId as string),
    enabled: Boolean(discoveryId),
  });

  const openAttachmentMutation = useMutation({
    mutationFn: ({ attachmentId, targetWindow }: { attachmentId: string; targetWindow: Window | null }) =>
      openDiscoveryAttachment(attachmentId, targetWindow),
    onSuccess: () => setErrorMessage(""),
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to open that attachment. Try again.",
      );
    },
  });

  // Opened synchronously in the click handler (before the mutation's first
  // await) so browsers still treat it as a user-gesture-triggered window,
  // not a blocked popup.
  function handleOpenAttachment(attachmentId: string) {
    const targetWindow = window.open("", "_blank");
    openAttachmentMutation.mutate({ attachmentId, targetWindow });
  }

  const decisionMutation = useMutation({
    mutationFn: ({ isApproved, comment }: { isApproved: boolean; comment: string }) =>
      reviewDiscovery(id as string, { isApproved, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-discovery", id] });
      navigate("/dashboard/bdo-reviews");
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to record this decision. Try again.",
      );
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

  // Only the initiative and discovery record are essential to review and
  // decide on — attachments/links failing to load (e.g. an authorization
  // gap on just that one endpoint) shouldn't block Approve/Reject on
  // everything else that did load. Those two sections show their own
  // inline error instead.
  const isLoading = initiativeQuery.isLoading || discoveryQuery.isLoading;

  const hasError = initiativeQuery.isError || !initiativeQuery.data || discoveryQuery.isError;

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

  // Once rejected, this documentation is back with the BDO to revise —
  // it's no longer the Group Head's to review until it's resubmitted
  // ("Submitted" again). Approved stays viewable (nothing left to decide,
  // but no harm in seeing the final version).
  if (discovery?.status === "Rejected") {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo-reviews" className="text-button">
          <ArrowLeft size={15} />
          Back to BDO Reviews
        </Link>

        <p className="initiatives-empty initiative-detail-message">
          You rejected {initiative.projectName}'s documentation
          {discovery.reviewComment ? `: "${discovery.reviewComment}"` : "."} It's
          back with the BDO to revise — this'll be available to review again
          once they resubmit it.
        </p>
      </div>
    );
  }

  const attachments = attachmentsQuery.data ?? [];
  const workflowLinks = workflowLinksQuery.data ?? [];
  const isDecided = discovery?.status === "Approved";

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

        {!isDecided && (
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

      {discovery?.status === "Approved" && (
        <p className="brd-status-message" role="status">
          Already approved by {reviewerName(discovery.reviewedByUserId)}.
        </p>
      )}

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Product discovery</h2>
          </div>
        </div>

        {discovery ? (
          <div className="proposal-section">
            {[
              { id: "businessLogic", label: "Business logic", value: discovery.businessLogic },
              { id: "customerJourney", label: "Customer journey", value: discovery.customerJourney },
              { id: "userFlow", label: "User flow", value: discovery.userFlow },
              { id: "businessProcess", label: "Business process", value: discovery.businessProcess },
              { id: "assumptions", label: "Assumptions", value: discovery.assumptions },
            ].map((field) => (
              <div className="form-field" key={field.id}>
                <label htmlFor={`review-${field.id}`}>{field.label}</label>
                <textarea
                  id={`review-${field.id}`}
                  rows={3}
                  readOnly
                  value={field.value || "—"}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="initiatives-empty">No discovery document was saved.</p>
        )}
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Attachments</h2>
          </div>
        </div>

        <div className="bdo-upload-section">
          {attachmentsQuery.isError ? (
            <p className="initiatives-empty initiatives-empty--error">
              Couldn't load attachments. Try refreshing the page.
            </p>
          ) : attachments.length === 0 ? (
            <p className="bdo-upload-empty">No attachments were uploaded.</p>
          ) : (
            <ul className="bdo-upload-list">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="bdo-upload-list_item">
                  <span className="bdo-upload-list_icon">
                    <FileText size={16} />
                  </span>

                  <div className="bdo-upload-list_info">
                    <span className="bdo-upload-list_name">{attachment.fileName}</span>
                  </div>

                  <button
                    type="button"
                    className="bdo-upload-list_open"
                    onClick={() => handleOpenAttachment(attachment.id)}
                    disabled={openAttachmentMutation.isPending}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Design links</h2>
          </div>
        </div>

        <div className="bdo-upload-section">
          {workflowLinksQuery.isError ? (
            <p className="initiatives-empty initiatives-empty--error">
              Couldn't load design links. Try refreshing the page.
            </p>
          ) : workflowLinks.length === 0 ? (
            <p className="bdo-upload-empty">No links were added.</p>
          ) : (
            <ul className="bdo-upload-list">
              {workflowLinks.map((link) => (
                <li key={link.id} className="bdo-upload-list_item">
                  <span className="bdo-upload-list_icon">
                    <Link2 size={16} />
                  </span>

                  <div className="bdo-upload-list_info">
                    <span className="bdo-upload-list_name">{link.title}</span>
                    {link.description && (
                      <span className="bdo-upload-list_meta">{link.description}</span>
                    )}
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bdo-upload-list_open"
                  >
                    Open link
                  </a>
                </li>
              ))}
            </ul>
          )}
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
