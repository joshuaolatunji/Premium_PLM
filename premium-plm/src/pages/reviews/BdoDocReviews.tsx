import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getBdoAssignment } from "../../mocks/bdoAssignmentMock";
import { getSubmissionStatus } from "../../mocks/bdoDocumentsMock";
import { priorityLabel } from "../../utils/initiativeStatus";
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

  // One lookup per initiative for both the BDO assignment and the
  // submission status — same "no bulk endpoint" situation as everywhere
  // else in this mock, plus BRD reviews for the real equivalent.
  const assignmentQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["bdo-assignment", initiative.id],
      queryFn: () => getBdoAssignment(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const statusQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["bdo-submission-status", initiative.id],
      queryFn: () => getSubmissionStatus(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    initiativesQuery.isLoading ||
    assignmentQueries.some((query) => query.isLoading) ||
    statusQueries.some((query) => query.isLoading);

  const hasError =
    initiativesQuery.isError ||
    assignmentQueries.some((query) => query.isError) ||
    statusQueries.some((query) => query.isError);

  function userName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned";
  }

  const awaitingReview: { initiative: ProductInitiative; bdoId: string | null }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const status = statusQueries[index]?.data;

      if (status === "SubmittedForApproval") {
        awaitingReview.push({
          initiative,
          bdoId: assignmentQueries[index]?.data?.bdoId ?? null,
        });
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

      <p className="mock-data-notice">
        Submission status here is temporary, local-only data until the real
        BDO workflow API is ready — it resets if you reload the page.
      </p>

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
                        <strong>{initiative.projectName}</strong>
                        <span>{initiative.id.slice(0, 8)}</span>
                      </div>
                    </td>

                    <td>
                      <span className="priority-badge">
                        {priorityLabel(initiative.priority)}
                      </span>
                    </td>

                    <td>{userName(bdoId)}</td>

                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          navigate(`/dashboard/bdo-reviews/${initiative.id}`)
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
    </div>
  );
}

export default BdoDocReviews;
