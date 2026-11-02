import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getInitiativeDocuments } from "../../service/DocumentService";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { documentStatusClass, documentStatusText, documentsQueryKey, EMPTY_DOCUMENTS } from "../../utils/documentStatus";
import DocumentReadOnlyView from "./DocumentReadOnlyView";

interface DocumentsViewerProps {
  initiativeId: string;
  initiativeName: string;
  // False until documents can exist (the BDO's documentation is approved).
  enabled: boolean;
}

// Read-only PID / FRD / BRD / SWR switcher for people who only read the
// documents (the engineers' ticket workspaces). Opens on the BRD; all four
// load at once so each one's stage shows straight away.
function DocumentsViewer({ initiativeId, initiativeName, enabled }: DocumentsViewerProps) {
  const [selected, setSelected] = useState<DocumentType>("BRD");
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(initiativeId),
    queryFn: () => getInitiativeDocuments(initiativeId),
    enabled,
  });
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;
  const document = documents[selected];
  const { isLoading, isError } = documentsQuery;

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
              {documentsQuery.isSuccess && (
                <span className={`document-tab_status document-tab_status--${documents[type]?.status ?? "none"}`}>
                  {documentStatusText(documents[type])}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="initiatives-empty">Loading {selected}…</p>
        ) : isError ? (
          <p className="initiatives-empty initiatives-empty--error">Couldn't load the {selected}. Try refreshing the page.</p>
        ) : document && document.version > 0 ? (
          <>
            <p className="dashboard-subtitle initiative-detail-badges">
              <span className={documentStatusClass(document)}>{documentStatusText(document)}</span>
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
