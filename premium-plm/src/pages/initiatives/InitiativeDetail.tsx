import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { downloadBrdPdf } from "../../service/PdfService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  deriveStatus,
  isAwaitingGroupHeadDecision,
  isBrdAwaitingBdoDecision,
  isBrdAwaitingGroupHeadDecision,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
} from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { getStoredUser } from "../../apicalls/authStorage";
import { resolvePrimaryRole } from "../../utils/roleRouting";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InitiativeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(id as string),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const proposalQuery = useQuery({
    queryKey: ["product-proposal", id],
    queryFn: () => getProposalByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", id],
    queryFn: () => getDiscoveryByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const downloadBrdMutation = useMutation({
    mutationFn: () =>
      downloadBrdPdf(id as string, initiativeQuery.data?.projectName ?? "BRD"),
    onError: () => setDownloadError("Unable to download the BRD PDF. Try again."),
    onSuccess: () => setDownloadError(""),
  });

  const [downloadError, setDownloadError] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["tickets", id],
    queryFn: () => getTicketsForInitiative(id as string),
    enabled: Boolean(id),
  });

  // Group Head (and Super Admin, who shares the same governance view) can
  // only review a BRD that's actually been submitted — they never get the
  // PM's editable form. The BDO gets the same treatment for their own leg.
  // Everyone else keeps the existing "Open BRD" -> editor behavior.
  const primaryRole = resolvePrimaryRole(getStoredUser()?.roles ?? []);
  const isReviewerRole = primaryRole === "GroupHead" || primaryRole === "SuperAdmin";
  const isBdoReviewerRole = primaryRole === "BusinessDevelopmentOfficer";
  // Project Managers create tickets, so their Tickets tab is always open.
  // Everyone else only gets it once a ticket exists for this initiative.
  const ticketsAvailable =
    primaryRole === "ProjectManager" || (ticketsQuery.data?.length ?? 0) > 0;
  // Excludes the BDO stage and "Rejected": a BRD still with the BDO, or
  // rejected back to the PM, isn't the Group Head's to review yet.
  // ("Rejected" is inferred to match the capitalized-word convention of
  // "Draft"/"Approved" — correct this if a real rejection reads differently.)
  const proposalSubmitted =
    isBrdAwaitingGroupHeadDecision(proposalQuery.data?.status) ||
    proposalQuery.data?.status === "Approved";
  const bdoReviewReady = isBrdAwaitingBdoDecision(proposalQuery.data?.status);

  // "Submitted" and "Rejected" are confirmed live on the discovery record;
  // "Approved" follows the same pattern but hasn't been directly observed.
  // Active while awaiting a decision, and after approval (viewing the
  // final version is harmless). NOT active once rejected — a rejected
  // submission goes back to the BDO to revise and is no longer the Group
  // Head's to review until it's resubmitted.
  const bdoDocsReviewReady =
    isAwaitingGroupHeadDecision(discoveryQuery.data?.status) ||
    discoveryQuery.data?.status === "Approved";
  const bdoDocsApproved = discoveryQuery.data?.status === "Approved";
  // The BRD can't meaningfully be reviewed until the BDO's documentation is
  // approved — the PM's whole BRD workflow only starts at that point.
  const brdReviewReady = bdoDocsApproved && proposalSubmitted;

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned",
    );
  }

  if (initiativeQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading initiative…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/initiatives" className="text-button">
          <ArrowLeft size={15} />
          Back to initiatives
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not have
          access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const { daysLeft } = deriveStatus(initiative);
  const totalExtensions =
    initiative.timelineExtensionCount + initiative.extensionsRemaining;
  const stage = currentStageFor(
    discoveryQuery.data?.status ?? "NotStarted",
    proposalQuery.data ?? null,
  );

  return (
    <div className="dashboard-page">
      <Link to="/dashboard/initiatives" className="text-button">
        <ArrowLeft size={15} />
        Back to initiatives
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Initiatives / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">{initiative.projectName}</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span className={priorityBadgeClass(initiative.priority)}>
              {priorityLabel(initiative.priority)}
            </span>
            <span className={stageBadgeClass(stage)}>{stage}</span>
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => navigate(`/dashboard/initiatives/${initiative.id}/tickets`)}
            disabled={!ticketsAvailable}
            title={ticketsAvailable ? undefined : "Available once the Project Manager has created a ticket"}
          >
            Tickets
          </button>

          {isReviewerRole ? (
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => navigate(`/dashboard/bdo-reviews/${initiative.id}`)}
                disabled={!bdoDocsReviewReady}
                title={
                  bdoDocsReviewReady
                    ? undefined
                    : discoveryQuery.data?.status === "Rejected"
                      ? "Back with the BDO to revise — available again once resubmitted"
                      : "Not yet submitted to you by the BDO"
                }
              >
                Review BDO Docs
              </button>

              {proposalQuery.data?.status === "Approved" ? (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => downloadBrdMutation.mutate()}
                  disabled={downloadBrdMutation.isPending}
                >
                  {downloadBrdMutation.isPending ? "Preparing PDF…" : "Download BRD"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate(`/dashboard/brd-reviews/${initiative.id}`)}
                  disabled={!brdReviewReady}
                  title={
                    !bdoDocsApproved
                      ? "Available once the BDO's documentation is approved"
                      : !proposalSubmitted
                        ? proposalQuery.data?.status === "Rejected"
                          ? "Back with the PM to revise — available again once resubmitted"
                          : "Not yet submitted for review"
                        : undefined
                  }
                >
                  Review BRD
                </button>
              )}
            </>
          ) : isBdoReviewerRole ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => navigate(`/dashboard/bdo-brd-reviews/${initiative.id}`)}
              disabled={!bdoReviewReady}
              title={!bdoReviewReady ? "Not yet submitted to you for review" : undefined}
            >
              Review BRD
            </button>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => navigate(`/dashboard/initiatives/${initiative.id}/brd`)}
              disabled={!bdoDocsApproved}
              title={!bdoDocsApproved ? "Available once the BDO's documentation is approved" : undefined}
            >
              Open BRD
            </button>
          )}
        </div>
      </header>

      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Description</h2>
          </div>
        </div>

        <p className="initiative-detail-description">{initiative.description}</p>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Initiative information</h2>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <div>
            <span className="initiative-detail-grid_label">Reference</span>
            <span className="initiative-detail-grid_value">
              {initiative.id.slice(0, 8)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">
              Business Development Officer
            </span>
            <span className="initiative-detail-grid_value">
              {userName(initiative.bdoId)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Project manager</span>
            <span className="initiative-detail-grid_value">
              {userName(initiative.projectManagerId)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Created by</span>
            <span className="initiative-detail-grid_value">
              {userName(initiative.createdByUserId)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Created</span>
            <span className="initiative-detail-grid_value">
              {formatDate(initiative.createdAt)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Target duration</span>
            <span className="initiative-detail-grid_value">
              {initiative.timelineDays} days
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Timeline started</span>
            <span className="initiative-detail-grid_value">
              {formatDate(initiative.timelineStartedAt)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Original deadline</span>
            <span className="initiative-detail-grid_value">
              {formatDate(initiative.originalDeadline)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Current deadline</span>
            <span className="initiative-detail-grid_value">
              {formatDate(initiative.currentDeadline)}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Days remaining</span>
            <span className="initiative-detail-grid_value">
              {daysLeft === null ? "—" : `${daysLeft}d`}
            </span>
          </div>

          <div>
            <span className="initiative-detail-grid_label">Extensions used</span>
            <span className="initiative-detail-grid_value">
              {initiative.timelineExtensionCount} of {totalExtensions}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default InitiativeDetail;
