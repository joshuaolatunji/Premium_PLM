import { NavLink } from "react-router-dom";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType, InitiativeDocuments } from "../../types/documentTypes";
import { documentStatusLabel } from "../../utils/documentStatus";

interface DocumentTabsProps {
  documents: InitiativeDocuments;
  // Builds the link for each tab, e.g. the PM's editor or a review page.
  pathFor: (type: DocumentType) => string;
}

// PID · FRD · BRD · SWR switcher shown above a document, with each one's
// status underneath — the four can be worked on in any order, so this lets
// the reader move between them without going back to a list.
function DocumentTabs({ documents, pathFor }: DocumentTabsProps) {
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
          <span className={`document-tab_status document-tab_status--${documents[type]?.status ?? "none"}`}>
            {documentStatusLabel(documents[type]?.status)}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

export default DocumentTabs;
