import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { DOCUMENT_META, documentTypeFromSlug } from "../../types/documentTypes";
import type { DocumentType, ProductDocument } from "../../types/documentTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import {
  documentStatusClass,
  documentStatusText,
  useInitiativeDocuments,
} from "../../utils/documentStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { backState } from "../../utils/navigation";
import { documentEditorPath } from "../../utils/documentRoutes";

interface HubRowProps {
  initiative: ProductInitiative;
  type: DocumentType;
  document?: ProductDocument;
  bdoDocsApproved: boolean;
}

function HubRow({ initiative, type, document, bdoDocsApproved }: HubRowProps) {
  const navigate = useNavigate();
  const cta = !document
    ? `Start ${type}`
    : document.status === "Draft" || document.status === "Rejected"
      ? `Continue ${type}`
      : `Open ${type}`;

  return (
    <tr>
      <td>
        <div className="initiative-cell">
          <strong title={initiative.projectName}>{initiative.projectName}</strong>
          <span>{initiative.id.slice(0, 8)}</span>
        </div>
      </td>

      <td>
        <span className={priorityBadgeClass(initiative.priority)}>{priorityLabel(initiative.priority)}</span>
      </td>

      {document && (
        <td>
          <span className={documentStatusClass(document)}>
            {documentStatusText(document)}
          </span>{" "}
          {document.version > 0 && <span className="brd-version-tag">v{document.version}</span>}
        </td>
      )}

      <td className="brd-reviews-actions">
        <button
          type="button"
          className="table-action table-action--dark"
          onClick={() => navigate(`/dashboard/initiatives/${initiative.id}`)}
        >
          View initiative
        </button>

        <button
          type="button"
          className="table-action table-action--premium"
          onClick={() =>
            navigate(documentEditorPath(initiative.id, type), {
              state: backState(`Back to ${type}s`),
            })
          }
          disabled={!bdoDocsApproved}
          title={!bdoDocsApproved ? "Available once the BDO's documentation is approved" : undefined}
        >
          {cta}
        </button>
      </td>
    </tr>
  );
}

// The PM's list for one document type (PIDs, FRDs, BRDs or SWRs): what still
// needs starting, and what's already in progress.
function DocumentHub() {
  const { docType } = useParams<{ docType: string }>();
  const type = documentTypeFromSlug(docType);

  // Real — filtered to the PM's own initiatives server-side.
  const assignedInitiativesQuery = useQuery({
    queryKey: ["product-initiatives-my-assigned"],
    queryFn: getMyAssignedInitiatives,
  });

  const initiatives = useMemo(
    () => assignedInitiativesQuery.data ?? [],
    [assignedInitiativesQuery.data],
  );

  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  // A document can't be started until the Group Head approves the BDO's
  // documentation.
  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  if (!type) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">This document type doesn't exist.</p>
      </div>
    );
  }

  const isLoading =
    assignedInitiativesQuery.isLoading ||
    documents.isLoading ||
    discoveryQueries.some((query) => query.isLoading);

  const hasError =
    assignedInitiativesQuery.isError ||
    documents.isError ||
    discoveryQueries.some((query) => query.isError);

  const notStarted: { initiative: ProductInitiative; bdoDocsApproved: boolean }[] = [];
  const inProgress: { initiative: ProductInitiative; document: ProductDocument; bdoDocsApproved: boolean }[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const document = documents.documentsFor(index)[type];
      const bdoDocsApproved = discoveryQueries[index]?.data?.status === "Approved";

      if (document) {
        inProgress.push({ initiative, document, bdoDocsApproved });
      } else {
        notStarted.push({ initiative, bdoDocsApproved });
      }
    });
  }

  const name = DOCUMENT_META[type].name;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / {type}s</p>

          <h1 className="dashboard-title">{type}s</h1>

          <p className="dashboard-subtitle">{name}s for initiatives assigned to you.</p>
        </div>
      </header>

      {isLoading && <p className="initiatives-empty">Loading your {type}s…</p>}

      {hasError && (
        <p className="initiatives-empty initiatives-empty--error">
          Couldn't load your {type}s. Try refreshing the page.
        </p>
      )}

      {!isLoading && !hasError && (
        <>
          <section className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Needs a {type}</h2>
                <p>These initiatives don't have a {type} started yet.</p>
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
                  {notStarted.map(({ initiative, bdoDocsApproved }) => (
                    <HubRow
                      key={initiative.id}
                      initiative={initiative}
                      type={type}
                      bdoDocsApproved={bdoDocsApproved}
                    />
                  ))}

                  {notStarted.length === 0 && (
                    <tr>
                      <td colSpan={3} className="initiatives-empty">
                        Nothing here — every assigned initiative has a {type} started.
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
                <p>{type}s saved so far. Open one to continue editing, submit it, or read it.</p>
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
                  {inProgress.map(({ initiative, document, bdoDocsApproved }) => (
                    <HubRow
                      key={initiative.id}
                      initiative={initiative}
                      type={type}
                      document={document}
                      bdoDocsApproved={bdoDocsApproved}
                    />
                  ))}

                  {inProgress.length === 0 && (
                    <tr>
                      <td colSpan={4} className="initiatives-empty">
                        No {type}s saved yet.
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

export default DocumentHub;
