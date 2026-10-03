import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";

import { getProductInitiatives } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getAllUsers } from "../../service/UserService";
import { downloadBrdPdf } from "../../service/PdfService";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { brdStatusBadgeClass } from "../../utils/brdStatus";
import { capitalize } from "../../utils/text";
import type { ProductInitiative } from "../../types/initiativeTypes";
import type { ProductProposal } from "../../types/proposalTypes";

function BrdReviews() {
  const navigate = useNavigate();
  const [downloadError, setDownloadError] = useState("");

  const downloadMutation = useMutation({
    mutationFn: ({ initiativeId, initiativeName }: { initiativeId: string; initiativeName: string }) =>
      downloadBrdPdf(initiativeId, initiativeName),
    onSuccess: () => setDownloadError(""),
    onError: () => setDownloadError("Unable to download the BRD PDF. Try again."),
  });

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

  // One BRD lookup per initiative — same pattern as MyWork.tsx/BrdHub.tsx.
  // There's no "list proposals awaiting review" endpoint, so this is the
  // only way to find them.
  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading = initiativesQuery.isLoading || proposalQueries.some((q) => q.isLoading);

  const hasError = initiativesQuery.isError || proposalQueries.some((q) => q.isError);

  function managerName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned",
    );
  }

  // "Draft" and "Approved" are the status strings we've confirmed live.
  // "Rejected" is inferred (matches the same convention, and the
  // discovery model's own confirmed Submitted/Approved/Rejected) — once
  // rejected, a BRD goes back to the PM to revise and should leave this
  // queue until it's resubmitted, same as it leaves BdoDocReviews once
  // the Group Head rejects BDO documentation. Correct this if a real
  // rejection reads differently. Anything else (submitted, under review —
  // exact name unknown) reads as "needs attention" here, since we can't
  // safely map other unobserved status strings to specific meanings.
  const awaitingReview: {
    initiative: ProductInitiative;
    proposal: ProductProposal;
    pmId: string | null;
  }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const proposal = proposalQueries[index]?.data;

      if (
        proposal &&
        proposal.status !== "Draft" &&
        proposal.status !== "Approved" &&
        proposal.status !== "Rejected"
      ) {
        awaitingReview.push({
          initiative,
          proposal,
          pmId: initiative.projectManagerId,
        });
      }
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / BRD Reviews</p>

          <h1 className="dashboard-title">BRD Reviews</h1>

          <p className="dashboard-subtitle">
            Submitted BRDs across all initiatives, awaiting your decision.
          </p>
        </div>
      </header>

      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Project manager</th>
                <th>BRD status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    Loading submitted BRDs…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={5} className="initiatives-empty initiatives-empty--error">
                    Couldn't load BRDs. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                awaitingReview.map(({ initiative, proposal, pmId }) => (
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

                    <td>{managerName(pmId)}</td>

                    <td>
                      <span className={brdStatusBadgeClass(proposal.status)}>
                        {proposal.status}
                      </span>{" "}
                      <span className="brd-version-tag">v{proposal.version}</span>
                    </td>

                    <td className="brd-reviews-actions">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          navigate(`/dashboard/brd-reviews/${initiative.id}`)
                        }
                      >
                        Review
                      </button>

                      {proposal.status === "Approved" && (
                        <button
                          type="button"
                          className="table-action"
                          onClick={() =>
                            downloadMutation.mutate({
                              initiativeId: initiative.id,
                              initiativeName: initiative.projectName,
                            })
                          }
                          disabled={
                            downloadMutation.isPending &&
                            downloadMutation.variables?.initiativeId === initiative.id
                          }
                        >
                          {downloadMutation.isPending &&
                          downloadMutation.variables?.initiativeId === initiative.id
                            ? "Preparing…"
                            : "Download"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && awaitingReview.length === 0 && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
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

export default BrdReviews;
