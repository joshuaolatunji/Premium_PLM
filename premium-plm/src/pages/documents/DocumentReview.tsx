import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getInitiativeDocuments, reviewDocument } from "../../service/DocumentService";
import { DOCUMENT_META, documentTypeFromSlug } from "../../types/documentTypes";
import type { DocumentReviewer } from "../../types/documentTypes";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
  documentsQueryKey,
  EMPTY_DOCUMENTS,
} from "../../utils/documentStatus";
import { documentReviewPath, documentReviewsPath } from "../../utils/documentRoutes";
import BackLink from "../../components/common/BackLink";
import DocumentTabs from "../../components/documents/DocumentTabs";
import DocumentPager from "../../components/documents/DocumentPager";
import DocumentReadOnlyView from "../../components/documents/DocumentReadOnlyView";
import DecisionModal, { type Decision } from "../../components/review/DecisionModal";
import { clearDraft } from "../../utils/useDraftState";
import ReviewDecisionBar from "../../components/review/ReviewDecisionBar";

interface DocumentReviewProps {
  reviewer: DocumentReviewer;
}

// One PID / FRD / BRD / SWR, opened by its reviewer. The BDO decides first;
// approving forwards it to the Group Head, whose approval is final. Either
// can reject it back to the PM with a reason.
function DocumentReview({ reviewer }: DocumentReviewProps) {
  const { docType, id } = useParams<{ docType: string; id: string }>();
  const type = documentTypeFromSlug(docType);
  const initiativeId = id as string;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isBdo = reviewer === "BDO";

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(initiativeId),
    enabled: Boolean(id),
  });

  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(id),
    queryFn: () => getInitiativeDocuments(initiativeId),
    enabled: Boolean(id),
  });

  // Where a rejection reason being typed is kept until the decision is made.
  const decisionDraftKey = `decision:document:${initiativeId}:${type}:${reviewer}`;

  const decisionMutation = useMutation({
    mutationFn: ({ approved, comment }: { approved: boolean; comment: string }) =>
      reviewDocument(initiativeId, type!, reviewer, approved, comment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey(id) });
      clearDraft(decisionDraftKey);
      setPendingDecision(null);
      navigate(documentReviewsPath(reviewer, type!));
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to record this decision.");
    },
  });

  const listPath = type ? documentReviewsPath(reviewer, type) : "/dashboard";
  const back = <BackLink fallbackTo={listPath} fallbackLabel={type ? `Back to ${type} Reviews` : "Back"} />;

  if (!type) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiative-detail-message">This document type doesn't exist.</p>
      </div>
    );
  }

  if (initiativeQuery.isLoading || documentsQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading {type}…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || documentsQuery.isError) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this {type}. It may not exist, or you may not have access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;
  const document = documents[type];
  const myStep = isBdo ? "PendingBDOReview" : "PendingGroupHeadReview";
  const canDecide = document?.status === myStep;

  // What each reviewer may open: the BDO from their step onwards; the Group
  // Head only once the BDO has forwarded it.
  const visible =
    document &&
    (isBdo
      ? ["PendingBDOReview", "PendingGroupHeadReview", "Approved"].includes(document.status)
      : ["PendingGroupHeadReview", "Approved"].includes(document.status));

  let unavailableMessage = "";

  if (!document) {
    unavailableMessage = `${initiative.projectName} doesn't have a ${type} yet — there's nothing to review.`;
  } else if (document.status === "Draft") {
    unavailableMessage = `${initiative.projectName}'s ${type} hasn't been submitted for review yet.`;
  } else if (document.status === "Cancelled") {
    unavailableMessage = `This ${type} has been cancelled.`;
  } else if (document.status === "Rejected") {
    unavailableMessage = `This ${type} was returned to the Product Manager to revise. It'll be available again once they resubmit it.`;
  } else if (!isBdo && document.status === "PendingBDOReview") {
    unavailableMessage = `${initiative.projectName}'s ${type} is still with the Business Development Officer. It'll be available for your decision once they approve it.`;
  }

  return (
    <div className="dashboard-page">
      {back}

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / {type} Reviews / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">
            {initiative.projectName} {type}
          </h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span>{DOCUMENT_META[type].name}</span>
            {document && (
              <>
                <span className={documentStatusBadgeClass(document.status)}>
                  {documentStatusLabel(document.status)}
                </span>
                {document.version > 0 && <span className="brd-version-tag">v{document.version}</span>}
              </>
            )}
          </p>
        </div>

        {canDecide && (
          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--secondary brd-reject-button"
              onClick={() => {
                setErrorMessage("");
                setPendingDecision("reject");
              }}
              disabled={decisionMutation.isPending}
            >
              Reject
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setErrorMessage("");
                setPendingDecision("approve");
              }}
              disabled={decisionMutation.isPending}
            >
              Approve
            </button>
          </div>
        )}
      </header>

      <DocumentTabs documents={documents} pathFor={(tabType) => documentReviewPath(reviewer, tabType, initiativeId)} />

      {!visible || !document ? (
        <p className="initiatives-empty initiative-detail-message">{unavailableMessage}</p>
      ) : (
        <>
          {!canDecide && (
            <p className="initiatives-empty initiative-detail-message">
              {document.status === "Approved"
                ? `This ${type} has been approved.`
                : `You approved this ${type}; it's now with the Group Head.`}
            </p>
          )}

          <DocumentReadOnlyView document={document} initiativeName={initiative.projectName} />

          <DocumentPager current={type} pathFor={(tabType) => documentReviewPath(reviewer, tabType, initiativeId)} />

          {canDecide && (
            <ReviewDecisionBar
              hint={`Reviewed the full ${type}? Approve it, or reject it with a reason.`}
              onReject={() => setPendingDecision("reject")}
              onApprove={() => setPendingDecision("approve")}
              disabled={decisionMutation.isPending}
            />
          )}
        </>
      )}

      {pendingDecision && (
        <DecisionModal
          decision={pendingDecision}
          draftKey={decisionDraftKey}
          approveTitle={`Approve ${type}`}
          rejectTitle={`Reject ${type}`}
          approveBody={
            isBdo
              ? `This approves the ${type} and forwards it to the Group Head for the final decision.`
              : `This gives the ${type} its final approval.`
          }
          rejectLabel="Rejection rationale"
          rejectPlaceholder="What needs to change before resubmission?"
          isPending={decisionMutation.isPending}
          errorMessage={errorMessage}
          onCancel={() => setPendingDecision(null)}
          onConfirm={(comment) =>
            decisionMutation.mutate({ approved: pendingDecision === "approve", comment })
          }
        />
      )}
    </div>
  );
}

export default DocumentReview;
