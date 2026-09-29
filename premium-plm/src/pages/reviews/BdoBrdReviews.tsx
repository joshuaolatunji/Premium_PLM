import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import { getInitiativeIdsAssignedToBdo } from "../../mocks/bdoAssignmentMock";
import { getBrdBdoLegStatus } from "../../mocks/brdBdoReviewMock";
import { getCurrentUserId } from "../../apicalls/authStorage";
import { priorityLabel } from "../../utils/initiativeStatus";

// Mocked — there's no real "who is the BDO" field on an initiative and no
// real approval-leg concept, so this mirrors pages/reviews/BdoDocReviews.tsx:
// look up every initiative assigned to this BDO, then filter to the ones
// whose BRD leg is pending.
function BdoBrdReviews() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const assignedIdsQuery = useQuery({
    queryKey: ["bdo-assigned-initiative-ids", currentUserId],
    queryFn: () => getInitiativeIdsAssignedToBdo(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const assignedIds = useMemo(() => assignedIdsQuery.data ?? [], [assignedIdsQuery.data]);

  const initiativeQueries = useQueries({
    queries: assignedIds.map((initiativeId) => ({
      queryKey: ["product-initiative", initiativeId],
      queryFn: () => getInitiativeById(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  const legStatusQueries = useQueries({
    queries: assignedIds.map((initiativeId) => ({
      queryKey: ["brd-bdo-leg", initiativeId],
      queryFn: () => getBrdBdoLegStatus(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  const isLoading =
    assignedIdsQuery.isLoading ||
    initiativeQueries.some((query) => query.isLoading) ||
    legStatusQueries.some((query) => query.isLoading);

  const hasError =
    assignedIdsQuery.isError ||
    initiativeQueries.some((query) => query.isError) ||
    legStatusQueries.some((query) => query.isError);

  const awaitingReview = assignedIds
    .map((_initiativeId, index) => ({
      initiative: initiativeQueries[index]?.data,
      legStatus: legStatusQueries[index]?.data,
    }))
    .filter((row) => row.initiative && row.legStatus === "PendingBdoReview") as {
    initiative: NonNullable<(typeof initiativeQueries)[number]["data"]>;
    legStatus: "PendingBdoReview";
  }[];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / BRD Reviews</p>

          <h1 className="dashboard-title">BRD Reviews</h1>

          <p className="dashboard-subtitle">
            BRDs submitted by Project Managers, awaiting your decision before
            they go to the Group Head.
          </p>
        </div>
      </header>

      <p className="mock-data-notice">
        This approval leg is temporary, local-only data until the real BRD
        approval-leg API is ready — it resets if you reload the page.
      </p>

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={3} className="initiatives-empty">
                    Loading submitted BRDs…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={3} className="initiatives-empty initiatives-empty--error">
                    Couldn't load submissions. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                awaitingReview.map(({ initiative }) => (
                  <tr key={initiative.id}>
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
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          navigate(`/dashboard/bdo-brd-reviews/${initiative.id}`)
                        }
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && awaitingReview.length === 0 && (
                <tr>
                  <td colSpan={3} className="initiatives-empty">
                    No BRDs are currently awaiting your review.
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

export default BdoBrdReviews;
