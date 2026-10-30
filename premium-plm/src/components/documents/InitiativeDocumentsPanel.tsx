import { useNavigate } from "react-router-dom";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType, InitiativeDocuments } from "../../types/documentTypes";
import { documentStatusClass, documentStatusText } from "../../utils/documentStatus";
import { documentEditorPath, documentReviewPath } from "../../utils/documentRoutes";
import { backState } from "../../utils/navigation";

type Viewer = "GroupHead" | "BDO" | "ProductManager" | "Other";

interface InitiativeDocumentsPanelProps {
  initiativeId: string;
  initiativeName: string;
  documents: InitiativeDocuments;
  viewer: Viewer;
  bdoDocsApproved: boolean;
}

interface RowAction {
  label: string;
  path?: string;
  disabledReason?: string;
}

// What each viewer can do with one document from the initiative page.
function actionFor(
  viewer: Viewer,
  type: DocumentType,
  initiativeId: string,
  documents: InitiativeDocuments,
  bdoDocsApproved: boolean,
): RowAction | null {
  const status = documents[type]?.status;

  if (viewer === "ProductManager") {
    if (!bdoDocsApproved) {
      return { label: `Start ${type}`, disabledReason: "Available once the BDO's documentation is approved" };
    }

    const label = !status ? `Start ${type}` : status === "Draft" || status === "Rejected" ? `Continue ${type}` : `Open ${type}`;
    return { label, path: documentEditorPath(initiativeId, type) };
  }

  if (viewer === "GroupHead") {
    if (status === "PendingGroupHeadReview") {
      return { label: `Review ${type}`, path: documentReviewPath("GroupHead", type, initiativeId) };
    }

    if (status === "Approved") {
      return { label: `View ${type}`, path: documentReviewPath("GroupHead", type, initiativeId) };
    }

    return {
      label: `Review ${type}`,
      disabledReason:
        status === "PendingBDOReview"
          ? "With the BDO — available once they approve it"
          : status === "Rejected"
            ? "Back with the PM to revise — available again once resubmitted"
            : "Not yet submitted for review",
    };
  }

  if (viewer === "BDO") {
    if (status === "PendingBDOReview") {
      return { label: `Review ${type}`, path: documentReviewPath("BDO", type, initiativeId) };
    }

    if (status === "PendingGroupHeadReview" || status === "Approved") {
      return { label: `View ${type}`, path: documentReviewPath("BDO", type, initiativeId) };
    }

    return {
      label: `Review ${type}`,
      disabledReason: status === "Rejected" ? "Back with the PM to revise" : "Not yet submitted to you for review",
    };
  }

  return null;
}

// The PID, FRD, BRD and SWR for one initiative, with each one's status and
// the action that suits whoever is looking.
function InitiativeDocumentsPanel({
  initiativeId,
  initiativeName,
  documents,
  viewer,
  bdoDocsApproved,
}: InitiativeDocumentsPanelProps) {
  const navigate = useNavigate();

  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Documents</h2>
          <p>
            {bdoDocsApproved
              ? "Prepared by the Product Manager, reviewed by the BDO, then approved by the Group Head. They can be done in any order."
              : "These open once the Group Head approves the BDO's documentation."}
          </p>
        </div>
      </div>

      <div className="portfolio-table-wrapper">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Version</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {DOCUMENT_TYPES.map((type) => {
              const document = documents[type];
              const action = actionFor(viewer, type, initiativeId, documents, bdoDocsApproved);

              return (
                <tr key={type}>
                  <td>
                    <div className="initiative-cell">
                      <strong>{type}</strong>
                      <span>{DOCUMENT_META[type].name}</span>
                    </div>
                  </td>

                  <td>
                    <span className={documentStatusClass(document)}>
                      {documentStatusText(document)}
                    </span>
                  </td>

                  <td>
                    {document && document.version > 0 ? (
                      <span className="brd-version-tag">v{document.version}</span>
                    ) : (
                      <span className="portfolio-empty-value">—</span>
                    )}
                  </td>

                  <td className="brd-reviews-actions">
                    {action && (
                      <button
                        type="button"
                        className="table-action table-action--premium"
                        onClick={() =>
                          action.path && navigate(action.path, { state: backState(`Back to ${initiativeName}`) })
                        }
                        disabled={!action.path}
                        title={action.disabledReason}
                      >
                        {action.label}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default InitiativeDocumentsPanel;
