import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getInitiativeIdsAssignedToBdo } from "../../mocks/bdoAssignmentMock";
import { getSubmissionStatus } from "../../mocks/bdoDocumentsMock";
import { getCurrentUserId } from "../../apicalls/authStorage";
import { priorityLabel } from "../../utils/initiativeStatus";

const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  SubmittedForApproval: "Submitted for approval",
};

function BdoDashboard() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const assignedIdsQuery = useQuery({
    queryKey: ["bdo-assigned-initiative-ids", currentUserId],
    queryFn: () => getInitiativeIdsAssignedToBdo(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const assignedIds = assignedIdsQuery.data ?? [];

  const initiativeQueries = useQueries({
    queries: assignedIds.map((initiativeId) => ({
      queryKey: ["product-initiative", initiativeId],
      queryFn: () => getInitiativeById(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  const statusQueries = useQueries({
    queries: assignedIds.map((initiativeId) => ({
      queryKey: ["bdo-submission-status", initiativeId],
      queryFn: () => getSubmissionStatus(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  const isLoading =
    assignedIdsQuery.isLoading ||
    initiativeQueries.some((query) => query.isLoading) ||
    statusQueries.some((query) => query.isLoading);

  const hasError =
    assignedIdsQuery.isError ||
    initiativeQueries.some((query) => query.isError) ||
    statusQueries.some((query) => query.isError);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Dashboard</p>

          <h1 className="dashboard-title">BDO workspace</h1>

          <p className="dashboard-subtitle">
            Initiatives the Group Head has assigned to you.
          </p>
        </div>
      </header>

      <p className="mock-data-notice">
        Initiative assignment is temporary, local-only data until the real
        BDO assignment API is ready — it resets if you reload the page.
      </p>

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Documentation status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    Loading your assigned initiatives…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={4} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your assigned initiatives. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                assignedIds.map((initiativeId, index) => {
                  const initiative = initiativeQueries[index]?.data;
                  const status = statusQueries[index]?.data ?? "NotStarted";

                  if (!initiative) {
                    return null;
                  }

                  return (
                    <tr key={initiativeId}>
                      <td>
                        <div className="initiative-cell">
                          <strong>{initiative.projectName}</strong>
                          <span>{initiative.id.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>
                        <span className="priority-badge">
                          {priorityLabel(initiative.priority)}
                        </span>
                      </td>

                      <td>
                        <span className="status-badge status-badge--not-started">
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => navigate(`/dashboard/bdo/${initiativeId}`)}
                        >
                          {status === "NotStarted" ? "Start documentation" : "Continue"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && assignedIds.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    No initiatives are currently assigned to you.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default BdoDashboard;
