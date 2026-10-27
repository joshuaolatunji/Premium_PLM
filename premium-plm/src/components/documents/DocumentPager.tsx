import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";

interface DocumentPagerProps {
  current: DocumentType;
  // Builds the link for a document, e.g. the PM's editor or a review page.
  pathFor: (type: DocumentType) => string;
}

// The page scrolls inside the app shell, not the window, so that's what goes
// back to the top when moving to another document.
function scrollToTop() {
  window.document.querySelector(".app-shell_content")?.scrollTo({ top: 0, behavior: "smooth" });
}

// Previous / Next between the PID, FRD, BRD and SWR (in that order) at the
// bottom of a long document, so there's no scrolling back up to the tabs.
function DocumentPager({ current, pathFor }: DocumentPagerProps) {
  const index = DOCUMENT_TYPES.indexOf(current);
  const previous = index > 0 ? DOCUMENT_TYPES[index - 1] : null;
  const next = index < DOCUMENT_TYPES.length - 1 ? DOCUMENT_TYPES[index + 1] : null;

  return (
    <div className="document-pager">
      {previous ? (
        <Link
          to={pathFor(previous)}
          replace
          className="button button--dark document-pager_link"
          onClick={scrollToTop}
          title={DOCUMENT_META[previous].name}
        >
          <ChevronLeft size={17} aria-hidden="true" />
          Previous: {previous}
        </Link>
      ) : (
        <span />
      )}

      {next ? (
        <Link
          to={pathFor(next)}
          replace
          className="button button--dark document-pager_link"
          onClick={scrollToTop}
          title={DOCUMENT_META[next].name}
        >
          Next: {next}
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export default DocumentPager;
