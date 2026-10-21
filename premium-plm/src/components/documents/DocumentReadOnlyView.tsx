import { Download } from "lucide-react";

import RichTextContent from "../editor/RichTextContent";
import type { ProductDocument } from "../../types/documentTypes";

interface FieldProps {
  label: string;
  value: string;
}

// A bold label over the value in a box — the same look as the BDO
// documentation review, so reading a document feels like reading a filled
// form. The box grows with its text, so nothing is cut off or scrolled.
function Field({ label, value }: FieldProps) {
  return (
    <div className="brd-readonly-field">
      <span className="brd-readonly-field_label">{label}</span>
      <div className="brd-readonly-field_value">{value || "—"}</div>
    </div>
  );
}

interface DocumentReadOnlyViewProps {
  document: ProductDocument;
  // When provided, a "Download {type}" button sits on the right of the
  // Overview panel.
  onDownload?: () => void;
}

// A PID / FRD / BRD / SWR, read-only: the "{type} Overview" panel, then the
// formatted Description. Used by reviewers, by the PM once a document is
// submitted, and on the engineers' workspaces.
function DocumentReadOnlyView({ document, onDownload }: DocumentReadOnlyViewProps) {
  const { overview } = document;

  return (
    <>
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>{document.type} Overview</h2>
          </div>

          {onDownload && (
            <button type="button" className="button button--dark" onClick={onDownload}>
              <Download size={17} aria-hidden="true" />
              Download {document.type}
            </button>
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
