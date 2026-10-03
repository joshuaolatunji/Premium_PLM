import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getTicketsForInitiative } from "../../mocks/ticketsMock";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import {
  currentStageFor,
  deriveStatus,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
} from "../../utils/initiativeStatus";
import { brdStatusBadgeClass } from "../../utils/brdStatus";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import type { DashboardStat } from "../../types/dashboardTypes";

function MyWork() {
  const navigate = useNavigate();

  // Real — the create-initiative endpoint now sets projectManagerId for
  // real, and this endpoint filters by it server-side.
  const assignedInitiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const initiatives = useMemo(
    () => assignedInitiativesQuery.data ?? [],
    [assignedInitiativesQuery.data],
  );

  // One BRD lookup and one ticket-count lookup per assigned initiative, run
  // in parallel. Fine at the scale this list runs at (a PM's own
  // initiatives, typically a handful) — there's no bulk endpoint for
  // either.
  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const ticketQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["tickets", initiative.id],
      queryFn: () => getTicketsForInitiative(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  // "Start BRD" stays disabled until this is "Approved" — the PM's whole
  // workflow begins once the Group Head approves the BDO's documentation.
  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  function brdStatusFor(index: number): {
    label: string;
    status: string | null;
    hasDraft: boolean;
  } {
    const query = proposalQueries[index];

    if (!query || query.isLoading) {
      return { label: "Checking…", status: null, hasDraft: false };
    }

    if (query.isError) {
      return { label: "Couldn't check", status: null, hasDraft: false };
    }

    return query.data
      ? { label: query.data.status, status: query.data.status, hasDraft: true }
      : { label: "Not started", status: null, hasDraft: false };
  }

  const isLoading =
    assignedInitiativesQuery.isLoading || discoveryQueries.some((query) => query.isLoading);
  const hasError =
    assignedInitiativesQuery.isError || discoveryQueries.some((query) => query.isError);

  const stats: DashboardStat[] = useMemo(() => {
    const dueSoon = initiatives.filter((initiative) => {
      const { daysLeft } = deriveStatus(initiative);
      return daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    }).length;

    const overdue = initiatives.filter(
      (initiative) => deriveStatus(initiative).status === "overdue",
    ).length;

    // Only counts initiatives actually ready for a BRD — the BDO's
    // documentation must be approved first, so a rejected or still-pending
    // one shouldn't inflate this card (there's nothing the PM can act on
    // yet either way).
    const brdsNotStarted = proposalQueries.filter((query, index) => {
      const bdoDocsApproved = discoveryQueries[index]?.data?.status === "Approved";
      return bdoDocsApproved && query.isSuccess && query.data === null;
    }).length;

    return [
      {
        label: "Active initiatives",
        value: initiatives.length,
        description: "Assigned to you",
        descriptionType: "neutral",
      },
      {
        label: "BRDs not started",
        value: brdsNotStarted,
        description: brdsNotStarted > 0 ? "Needs a BRD" : "All started",
        descriptionType: brdsNotStarted > 0 ? "warning" : "success",
      },
      {
        label: "Due within 7 days",
        value: dueSoon,
        description: "Deadline approaching",
        descriptionType: dueSoon > 0 ? "warning" : "neutral",
      },
      {
        label: "Overdue",
        value: overdue,
        description: overdue > 0 ? "Past deadline" : "Nothing overdue",
        descriptionType: overdue > 0 ? "danger" : "success",
      },
    ];
  }, [initiatives, proposalQueries, discoveryQueries]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / My work</p>

          <h1 className="dashboard-title">My work</h1>

          <p className="dashboard-subtitle">
            Initiatives assigned to you, and the BRDs they need.
          </p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="My work summary">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>My initiatives</h2>
            <p>Initiatives where you're the assigned project manager.</p>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Current stage</th>
                <th>Days left</th>
                <th>Tickets</th>
                <th>BRD</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    Loading your initiatives…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={7} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your initiatives. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                initiatives.map((initiative, index) => {
                  const { daysLeft } = deriveStatus(initiative);
                  const brd = brdStatusFor(index);
                  const ticketCount = ticketQueries[index]?.data?.length ?? 0;
                  const bdoSubmissionStatus =
                    discoveryQueries[index]?.data?.status ?? "NotStarted";
                  const bdoDocsApproved = bdoSubmissionStatus === "Approved";
                  const stage = currentStageFor(
                    bdoSubmissionStatus,
                    proposalQueries[index]?.data ?? null,
                  );

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
                        <span className={stageBadgeClass(stage)}>{stage}</span>
                      </td>

                      <td>
                        {daysLeft === null ? (
                          <span className="portfolio-empty-value">—</span>
                        ) : (
                          <span
                            className={
                              daysLeft < 0
                                ? "days-left days-left--overdue"
                                : "days-left"
                            }
                          >
                            {daysLeft < 0
                              ? `${Math.abs(daysLeft)}d overdue`
                              : `${daysLeft}d`}
                          </span>
                        )}
                      </td>

                      <td>{ticketCount}</td>

                      <td>
                        {brd.status ? (
                          <span className={brdStatusBadgeClass(brd.status)}>
                            {brd.label}
                          </span>
                        ) : (
                          brd.label
                        )}
                      </td>

                      <td className="brd-reviews-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() =>
                            navigate(`/dashboard/initiatives/${initiative.id}/tickets`)
                          }
                        >
                          Tickets
                        </button>

                        <button
                          type="button"
                          className="table-action"
                          onClick={() =>
                            navigate(`/dashboard/initiatives/${initiative.id}/brd`)
                          }
                          disabled={!bdoDocsApproved || (!brd.hasDraft && ticketCount === 0)}
                          title={
                            !bdoDocsApproved
                              ? "Available once the BDO's documentation is approved"
                              : !brd.hasDraft && ticketCount === 0
                                ? "Create at least one ticket before starting the BRD"
                                : undefined
                          }
                        >
                          {brd.hasDraft ? "Continue BRD" : "Start BRD"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && initiatives.length === 0 && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
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

export default MyWork;
