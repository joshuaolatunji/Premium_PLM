import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { isAwaitingGroupHeadDecision, priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { backState } from "../../utils/navigation";
import type { ProductInitiative } from "../../types/initiativeTypes";

function BdoDocReviews() {
  const navigate = useNavigate();

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading || discoveryQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError || discoveryQueries.some((query) => query.isError);

  function userName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned",
    );
  }

  const awaitingReview: { initiative: ProductInitiative; bdoId: string | null }[] = [];
  // Documentation the Group Head has already approved — listed below the
  // queue so it can still be opened and read.
  const approved: { initiative: ProductInitiative; bdoId: string | null }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const discovery = discoveryQueries[index]?.data;

      if (discovery && isAwaitingGroupHeadDecision(discovery.status)) {
        awaitingReview.push({ initiative, bdoId: initiative.bdoId });
      } else if (discovery?.status === "Approved") {
        approved.push({ initiative, bdoId: initiative.bdoId });
      }
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / BDO Reviews</p>

          <h1 className="dashboard-title">BDO Reviews</h1>

          <p className="dashboard-subtitle">
            Discovery documentation submitted by BDOs, awaiting your decision.
          </p>
        </div>
      </header>

      {/* <p className="mock-data-notice">
        This queue is now driven by the real submission status. The decision
        you record (approve/reject) is also real, but its rejection comment
        and the BDO's own view of it are still temporary, local-only data
        until that part is confirmed.
      </p> */}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Business Development Officer</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    Loading submitted documentation…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={4} className="initiatives-empty initiatives-empty--error">
                    Couldn't load submissions. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                awaitingReview.map(({ initiative, bdoId }) => (
                  <tr key={initiative.id}>
                    <td>
                      <div className="initiative-cell">
                        <strong title={initiative.projectName}>{initiative.projectName}</strong>
                        <span>{initiative.id.slice(0, 8)}</span>
                      </div>
                    </td>

                    <td>
                      <span className={priorityBadgeClass(initiative.priority)}>
                        {priorityLabel(initiative.priority)}
                      </span>
                    </td>

                    <td>{userName(bdoId)}</td>

                    <td>
                      <button
                        type="button"
                        className="table-action table-action--premium"
                        onClick={() =>
                          navigate(`/dashboard/bdo-reviews/${initiative.id}`, {
                            state: backState("Back to BDO Reviews"),
                          })
                        }
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && awaitingReview.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    No documentation is currently awaiting your review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Approved documentation</h2>
            <p>BDO documentation you've already approved. Open one to view it.</p>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Business Development Officer</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {!isLoading &&
                !hasError &&
                approved.map(({ initiative, bdoId }) => (
                  <tr key={initiative.id}>
                    <td>
                      <div className="initiative-cell">
                        <strong title={initiative.projectName}>{initiative.projectName}</strong>
                        <span>{initiative.id.slice(0, 8)}</span>
                      </div>
                    </td>

                    <td>
                      <span className={priorityBadgeClass(initiative.priority)}>
                        {priorityLabel(initiative.priority)}
                      </span>
                    </td>

                    <td>{userName(bdoId)}</td>

                    <td>
                      <button
                        type="button"
                        className="table-action table-action--premium table-action--wide"
                        onClick={() =>
                          navigate(`/dashboard/bdo-reviews/${initiative.id}`, {
                            state: backState("Back to BDO Reviews"),
                          })
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && approved.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    No documentation has been approved yet.
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

export default BdoDocReviews;
