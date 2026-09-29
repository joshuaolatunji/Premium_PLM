import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { priorityLabel } from "../../utils/initiativeStatus";
import { brdStatusBadgeClass } from "../../utils/brdStatus";
import type { ProductInitiative } from "../../types/initiativeTypes";
import type { ProductProposal } from "../../types/proposalTypes";

interface BrdRowProps {
  initiative: ProductInitiative;
  proposal?: ProductProposal;
  cta: string;
  onOpen: (initiativeId: string) => void;
}

function BrdRow({ initiative, proposal, cta, onOpen }: BrdRowProps) {
  return (
    <tr>
      <td>
        <div className="initiative-cell">
          <strong>{initiative.projectName}</strong>
          <span>{initiative.id.slice(0, 8)}</span>
        </div>
      </td>

      <td>
        <span className="priority-badge">{priorityLabel(initiative.priority)}</span>
      </td>

      {proposal && (
        <td>
          <span className={brdStatusBadgeClass(proposal.status)}>
            {proposal.status}
          </span>{" "}
          <span className="brd-version-tag">v{proposal.version}</span>
        </td>
      )}

      <td>
        <button type="button" className="table-action" onClick={() => onOpen(initiative.id)}>
          {cta}
        </button>
      </td>
    </tr>
  );
}

function BrdHub() {
  const navigate = useNavigate();

  function openBrd(initiativeId: string) {
    navigate(`/dashboard/initiatives/${initiativeId}/brd`);
  }

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

  // One BRD lookup per assigned initiative — see MyWork.tsx for why this
  // is fine at this scale (no bulk "my proposals" endpoint exists).
  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const isLoading =
    assignedInitiativesQuery.isLoading || proposalQueries.some((query) => query.isLoading);

  const hasError =
    assignedInitiativesQuery.isError || proposalQueries.some((query) => query.isError);

  const notStarted: ProductInitiative[] = [];
  const inProgress: { initiative: ProductInitiative; proposal: ProductProposal }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const proposal = proposalQueries[index]?.data;

      if (proposal) {
        inProgress.push({ initiative, proposal });
      } else {
        notStarted.push(initiative);
      }
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / BRDs</p>

          <h1 className="dashboard-title">BRDs</h1>

          <p className="dashboard-subtitle">
            Business Requirements Documents for initiatives assigned to you.
          </p>
        </div>
      </header>

      {isLoading && <p className="initiatives-empty">Loading your BRDs…</p>}

      {hasError && (
        <p className="initiatives-empty initiatives-empty--error">
          Couldn't load your BRDs. Try refreshing the page.
        </p>
      )}

      {!isLoading && !hasError && (
        <>
          <section className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Needs a BRD</h2>
                <p>These initiatives don't have a BRD started yet.</p>
              </div>
            </div>

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
                  {notStarted.map((initiative) => (
                    <BrdRow
                      key={initiative.id}
                      initiative={initiative}
                      cta="Start BRD"
                      onOpen={openBrd}
                    />
                  ))}

                  {notStarted.length === 0 && (
                    <tr>
                      <td colSpan={3} className="initiatives-empty">
                        Nothing here — every assigned initiative has a BRD started.
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
                <h2>In progress</h2>
                <p>Drafts saved so far. Open one to continue editing or submit it.</p>
              </div>
            </div>

            <div className="portfolio-table-wrapper">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Initiative</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {inProgress.map(({ initiative, proposal }) => (
                    <BrdRow
                      key={initiative.id}
                      initiative={initiative}
                      proposal={proposal}
                      cta="Continue BRD"
                      onOpen={openBrd}
                    />
                  ))}

                  {inProgress.length === 0 && (
                    <tr>
                      <td colSpan={4} className="initiatives-empty">
                        No BRD drafts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default BrdHub;
