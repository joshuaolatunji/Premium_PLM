import { Download, Eye } from "lucide-react";

import RichTextContent from "../editor/RichTextContent";
import Field from "../common/ReadOnlyField";
import type { ProductDocument } from "../../types/documentTypes";
import { downloadDocument, previewDocument } from "../../utils/printDocument";

interface DocumentReadOnlyViewProps {
  document: ProductDocument;
  // When provided, "Preview" and "Download {type}" buttons sit on the right
  // of the Overview panel (the name goes in the PDF's title and file name).
  initiativeName?: string;
}

// A PID / FRD / BRD / SWR, read-only: the "{type} Overview" panel, then the
// formatted Description. Used by reviewers, by the PM once a document is
// submitted, and on the engineers' workspaces.
function DocumentReadOnlyView({ document, initiativeName }: DocumentReadOnlyViewProps) {
  const { overview } = document;

  return (
    <>
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>{document.type} Overview</h2>
          </div>

          {initiativeName && (
            <div className="brd-reviews-actions">
              <button
                type="button"
                className="button button--dark"
                onClick={() => void previewDocument(document, initiativeName)}
              >
                <Eye size={17} aria-hidden="true" />
                Preview
              </button>

              <button
                type="button"
                className="button button--dark"
                onClick={() => void downloadDocument(document, initiativeName)}
              >
                <Download size={17} aria-hidden="true" />
                Download {document.type}
              </button>
            </div>
          )}
        </div>

        <div className="initiative-detail-grid">
          <Field label="Author" value={overview.author} />
          <Field label="Sponsor" value={overview.sponsor} />
          <Field label="User group" value={overview.userGroup} />
          <Field label="Product manager" value={overview.productManager} />
        </div>

        <div className="proposal-section">
          <Field label="Introduction" value={overview.introduction} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Description</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="document-description-view">
            <RichTextContent html={document.description} emptyText="No description was written." />
          </div>
        </div>
      </section>
    </>
  );
}

export default DocumentReadOnlyView;
