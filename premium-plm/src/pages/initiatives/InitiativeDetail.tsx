import { useParams, useNavigate } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getInitiativeDocuments } from "../../service/DocumentService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  deriveStatus,
  isAwaitingGroupHeadDecision,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
} from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { getStoredUser } from "../../apicalls/authStorage";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import BackLink from "../../components/common/BackLink";
import { backState } from "../../utils/navigation";
import { documentsQueryKey } from "../../utils/documentStatus";
import InitiativeDocumentsPanel from "../../components/documents/InitiativeDocumentsPanel";

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

  // PID / FRD / BRD / SWR (mock — see DocumentService).
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(id),
    queryFn: () => getInitiativeDocuments(id as string),
    enabled: Boolean(id),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", id],
    queryFn: () => getDiscoveryByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets", id],
    queryFn: () => getTicketsForInitiative(id as string),
    enabled: Boolean(id),
  });

  // Group Head (and Super Admin, who shares the same governance view) and
  // the BDO review documents; the PM edits them (see the Documents panel).
  const primaryRole = resolvePrimaryRole(getStoredUser()?.roles ?? []);
  const isReviewerRole = primaryRole === "GroupHead" || primaryRole === "SuperAdmin";
  const isBdoReviewerRole = primaryRole === "BusinessDevelopmentOfficer";

  // Everyone assigned to an initiative can open this page, so "back" goes
  // to the viewer's own workspace — the Initiatives list is Group Head /
  // Super Admin only.
  const backTo =
    primaryRole === "BusinessDevelopmentOfficer"
      ? { path: "/dashboard/bdo", label: "Back to BDO workspace", crumb: "BDO workspace" }
      : primaryRole === "ProjectManager"
        ? { path: "/dashboard/my-work", label: "Back to my work", crumb: "My work" }
        : primaryRole === "LeadEngineer"
          ? { path: "/dashboard/lead-engineer", label: "Back to my tickets", crumb: "My tickets" }
          : primaryRole === "SoftwareEngineer"
            ? { path: "/dashboard/developer", label: "Back to my tickets", crumb: "My tickets" }
            : { path: "/dashboard/initiatives", label: "Back to initiatives", crumb: "Initiatives" };
  // Product Managers create tickets, so their Tickets tab is always open.
  // Everyone else only gets it once a ticket exists for this initiative.
  const ticketsAvailable =
    primaryRole === "ProjectManager" || (ticketsQuery.data?.length ?? 0) > 0;
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
        <BackLink fallbackTo={backTo.path} fallbackLabel={backTo.label} />

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not have
          access to it.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const { daysLeft } = deriveStatus(initiative);
  const stage = currentStageFor(discoveryQuery.data?.status ?? "NotStarted", documentsQuery.data ?? null);

  return (
    <div className="dashboard-page">
      <BackLink fallbackTo={backTo.path} fallbackLabel={backTo.label} />

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / {backTo.crumb} / {initiative.projectName}
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
            onClick={() => navigate(`/dashboard/initiatives/${initiative.id}/tickets`, { state: backState(`Back to ${initiative.projectName}`) })}
            disabled={!ticketsAvailable}
            title={ticketsAvailable ? undefined : "Available once the Product Manager has created a ticket"}
          >
            Tickets
          </button>

          {isReviewerRole ? (
            <>
              {/* Once approved there's nothing left to decide — the same page
                  is then just for viewing the approved documentation. */}
              <button
                type="button"
                className={bdoDocsApproved ? "button button--dark" : "button button--secondary"}
                onClick={() => navigate(`/dashboard/bdo-reviews/${initiative.id}`, { state: backState(`Back to ${initiative.projectName}`) })}
                disabled={!bdoDocsReviewReady}
                title={
                  bdoDocsReviewReady
                    ? undefined
                    : discoveryQuery.data?.status === "Rejected"
                      ? "Back with the BDO to revise — available again once resubmitted"
                      : "Not yet submitted to you by the BDO"
                }
              >
                {bdoDocsApproved ? "View BDO Docs" : "Review BDO Docs"}
              </button>
            </>
          ) : isBdoReviewerRole ? (
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => navigate(`/dashboard/bdo/${initiative.id}`, { state: backState(`Back to ${initiative.projectName}`) })}
              >
                Open documentation
              </button>
            </>
          ) : null}
        </div>
      </header>

      {documentsQuery.data && (
        <InitiativeDocumentsPanel
          initiativeId={initiative.id}
          initiativeName={initiative.projectName}
          documents={documentsQuery.data}
          bdoDocsApproved={bdoDocsApproved}
          viewer={
            isReviewerRole
              ? "GroupHead"
              : isBdoReviewerRole
                ? "BDO"
                : primaryRole === "ProjectManager"
                  ? "ProductManager"
                  : "Other"
          }
        />
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
            <span className="initiative-detail-grid_label">Product manager</span>
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

          {/* "Original deadline" is hidden until timeline extensions exist —
              without them it always equals the current deadline. */}
          <div>
            <span className="initiative-detail-grid_label">Deadline</span>
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
        </div>
      </section>
    </div>
  );
}

export default InitiativeDetail;
