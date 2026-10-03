import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getBrdBdoLegStatus } from "../../mocks/brdBdoReviewMock";
import { getCurrentUserId } from "../../apicalls/authStorage";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

// The BRD approval-leg concept itself is still mocked (no real endpoint) —
// but which initiatives belong to this BDO is real now (bdoId).
function BdoBrdReviews() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const assignedInitiatives = useMemo(
    () =>
      (initiativesQuery.data ?? []).filter(
        (initiative) => initiative.bdoId === currentUserId,
      ),
    [initiativesQuery.data, currentUserId],
  );

  const legStatusQueries = useQueries({
    queries: assignedInitiatives.map((initiative) => ({
      queryKey: ["brd-bdo-leg", initiative.id],
      queryFn: () => getBrdBdoLegStatus(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading || legStatusQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError || legStatusQueries.some((query) => query.isError);

  const awaitingReview = assignedInitiatives.filter(
    (_initiative, index) => legStatusQueries[index]?.data === "PendingBdoReview",
  );

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
        This approval-leg status is temporary, local-only data until the real
        BRD approval-leg API is ready — it resets if you reload the page.
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
                awaitingReview.map((initiative) => (
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
