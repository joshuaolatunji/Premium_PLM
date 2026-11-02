import { NavLink } from "react-router-dom";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { documentStatusText } from "../../utils/documentStatus";
import type { KnownDocuments } from "../../utils/documentStatus";

interface DocumentTabsProps {
  // Only documents already loaded; a tab without one shows no status.
  documents: KnownDocuments;
  // Builds the link for each tab, e.g. the PM's editor or a review page.
  // Without it the four show as a status strip (the approval page).
  pathFor?: (type: DocumentType) => string;
  // The document on screen, highlighted when there are no links.
  current?: DocumentType | null;
}

// PID · FRD · BRD · SWR switcher shown above a document, with each one's
// status underneath — the four can be worked on in any order, so this lets
// the reader move between them without going back to a list.
function DocumentTabs({ documents, pathFor, current }: DocumentTabsProps) {
  const status = (type: DocumentType) =>
    documents[type] !== undefined && (
      <span className={`document-tab_status document-tab_status--${documents[type]?.status ?? "none"}`}>
        {documentStatusText(documents[type])}
      </span>
    );

  if (!pathFor) {
    return (
      <div className="document-tabs" aria-label="Documents for this initiative">
        {DOCUMENT_TYPES.map((type) => (
          <div
            key={type}
            className={type === current ? "document-tab document-tab--static document-tab--active" : "document-tab document-tab--static"}
            title={DOCUMENT_META[type].name}
          >
            <strong>{type}</strong>
            {status(type)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <nav className="document-tabs" aria-label="Documents for this initiative">
      {DOCUMENT_TYPES.map((type) => (
        <NavLink
          key={type}
          to={pathFor(type)}
          replace
          className={({ isActive }) => (isActive ? "document-tab document-tab--active" : "document-tab")}
          title={DOCUMENT_META[type].name}
        >
          <strong>{type}</strong>
          {status(type)}
        </NavLink>
      ))}
    </nav>
  );
}

export default DocumentTabs;
