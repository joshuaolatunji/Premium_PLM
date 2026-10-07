import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getCurrentUserId } from "../../apicalls/authStorage";
import {
  isAwaitingGroupHeadDecision,
  priorityBadgeClass,
  priorityLabel,
} from "../../utils/initiativeStatus";

// "NotStarted" is our own placeholder for "no discovery record exists
// yet" (the real API has no concept of it). "Submitted", "Resubmitted",
// and "Rejected" are confirmed live; "Approved" follows the same pattern
// but hasn't been directly observed yet.
const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not started",
  Submitted: "Submitted for approval",
  Resubmitted: "Resubmitted for approval",
  Approved: "Approved",
  Rejected: "Rejected",
};

function statusBadgeClass(status: string) {
  if (isAwaitingGroupHeadDecision(status)) {
    return "status-badge status-badge--awaiting-gh-documentation-approval";
  }

  switch (status) {
    case "Approved":
      return "status-badge status-badge--approved";
    case "Rejected":
      return "status-badge status-badge--bdo-documentation-rejected";
    default:
      return "status-badge status-badge--not-started";
  }
}

function BdoDashboard() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  // Both GET /api/product-initiatives and /my-assigned are confirmed
  // (live-tested) to return 403 for the BDO role — a backend authorization
  // gap, reported to the backend team, not fixable from here. Left
  // pointing at /my-assigned (the same endpoint the PM workspace uses)
  // since that's the more likely one to end up authorized for BDO too;
  // swap this back to getProductInitiatives if the backend fixes the
  // other endpoint instead. The bdoId filter below is a client-side
  // safety net in case the endpoint ever returns a broader set than just
  // this BDO's own initiatives.
  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const assignedInitiatives = useMemo(
    () =>
      (initiativesQuery.data ?? []).filter(
        (initiative) => initiative.bdoId === currentUserId,
      ),
    [initiativesQuery.data, currentUserId],
  );

  const discoveryQueries = useQueries({
    queries: assignedInitiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading || discoveryQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError || discoveryQueries.some((query) => query.isError);

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
                assignedInitiatives.map((initiative, index) => {
                  const status = discoveryQueries[index]?.data?.status ?? "NotStarted";

                  return (
                    <tr key={initiative.id}>
                      <td>
                        <div className="initiative-cell">
                          <strong>{initiative.projectName}</strong>
                          <span>{initiative.id.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>
                        <span className={priorityBadgeClass(initiative.priority)}>
                          {priorityLabel(initiative.priority)}
                        </span>
                      </td>

                      <td>
                        <span className={statusBadgeClass(status)}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => navigate(`/dashboard/bdo/${initiative.id}`)}
                        >
                          {status === "NotStarted" ? "Start documentation" : "Continue"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && assignedInitiatives.length === 0 && (
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
