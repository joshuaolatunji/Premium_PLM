import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getBdoAssignment } from "../../mocks/bdoAssignmentMock";
import { deriveStatus, priorityLabel, STATUS_LABEL } from "../../utils/initiativeStatus";

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

  const bdoAssignmentQuery = useQuery({
    queryKey: ["bdo-assignment", id],
    queryFn: () => getBdoAssignment(id as string),
    enabled: Boolean(id),
  });

  function userName(userId: string | null) {
    if (!userId) {
      return "Unassigned";
    }

    return usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "Unassigned";
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
  const { status, daysLeft } = deriveStatus(initiative);
  const totalExtensions =
    initiative.timelineExtensionCount + initiative.extensionsRemaining;

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
            <span className="priority-badge">
              {priorityLabel(initiative.priority)}
            </span>
            <span className={`status-badge status-badge--${status}`}>
              {STATUS_LABEL[status]}
            </span>
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => navigate(`/dashboard/initiatives/${initiative.id}/tickets`)}
          >
            Tickets
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={() => navigate(`/dashboard/initiatives/${initiative.id}/brd`)}
          >
            Open BRD
          </button>
        </div>
      </header>

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
              {userName(bdoAssignmentQuery.data?.bdoId ?? null)}
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
