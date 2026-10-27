import { useState } from "react";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType, InitiativeDocuments } from "../../types/documentTypes";
import { documentStatusBadgeClass, documentStatusLabel } from "../../utils/documentStatus";
import DocumentReadOnlyView from "./DocumentReadOnlyView";

interface DocumentsViewerProps {
  documents: InitiativeDocuments;
  initiativeName: string;
}

// Read-only PID / FRD / BRD / SWR switcher for people who only read the
// documents (the engineers' ticket workspaces). Opens on the BRD.
function DocumentsViewer({ documents, initiativeName }: DocumentsViewerProps) {
  const [selected, setSelected] = useState<DocumentType>("BRD");
  const document = documents[selected];

  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Product documents</h2>
          <p>{DOCUMENT_META[selected].name}</p>
        </div>
      </div>

      <div className="proposal-section">
        <div className="document-tabs" role="tablist" aria-label="Product documents">
          {DOCUMENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={type === selected}
              className={type === selected ? "document-tab document-tab--active" : "document-tab"}
              onClick={() => setSelected(type)}
              title={DOCUMENT_META[type].name}
            >
              <strong>{type}</strong>
              <span className={`document-tab_status document-tab_status--${documents[type]?.status ?? "none"}`}>
                {documentStatusLabel(documents[type]?.status)}
              </span>
            </button>
          ))}
        </div>

        {document && document.version > 0 ? (
          <>
            <p className="dashboard-subtitle initiative-detail-badges">
              <span className={documentStatusBadgeClass(document.status)}>{documentStatusLabel(document.status)}</span>
              <span className="brd-version-tag">v{document.version}</span>
            </p>

            <DocumentReadOnlyView document={document} initiativeName={initiativeName} />
          </>
        ) : (
          <p className="initiatives-empty">No {selected} has been submitted yet.</p>
        )}
      </div>
    </section>
  );
}

export default DocumentsViewer;
