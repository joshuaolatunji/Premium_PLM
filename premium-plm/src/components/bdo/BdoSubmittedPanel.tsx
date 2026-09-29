import { CheckCircle2 } from "lucide-react";

interface BdoSubmittedPanelProps {
  initiativeName: string;
  onBackToWork: () => void;
  onViewInitiative: () => void;
}

// Confirmation screen shown after a BDO successfully submits their
// documentation for Group Head approval — same pattern as
// dashboardcomponents/BrdSubmittedPanel.tsx.
function BdoSubmittedPanel({
  initiativeName,
  onBackToWork,
  onViewInitiative,
}: BdoSubmittedPanelProps) {
  return (
    <div className="dashboard-panel brd-submitted-card">
      <div className="success-panel">
        <div className="success-panel_badge">
          <CheckCircle2 size={28} strokeWidth={1.75} />
        </div>

        <h2 className="success-panel_title">Documentation submitted</h2>

        <p className="success-panel_body">
          Your product discovery, logic flow, and design screens
          documentation for <strong>{initiativeName}</strong> have been
          submitted and are now awaiting the Group Head's decision.
        </p>

        <div className="brd-submitted-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onViewInitiative}
          >
            View initiative
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={onBackToWork}
          >
            Back to my work
          </button>
        </div>
      </div>
    </div>
  );
}

export default BdoSubmittedPanel;
