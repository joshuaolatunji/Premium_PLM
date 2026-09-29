import { CheckCircle2 } from "lucide-react";

interface BrdSubmittedPanelProps {
  initiativeName: string;
  wasResubmission: boolean;
  onBackToWork: () => void;
  onViewInitiative: () => void;
}

// Confirmation screen shown after a BRD is successfully submitted or
// resubmitted for review — replaces the editor rather than just flashing an
// inline banner over a form the BRD's author no longer needs to act on.
function BrdSubmittedPanel({
  initiativeName,
  wasResubmission,
  onBackToWork,
  onViewInitiative,
}: BrdSubmittedPanelProps) {
  return (
    <div className="dashboard-panel brd-submitted-card">
      <div className="success-panel">
        <div className="success-panel_badge">
          <CheckCircle2 size={28} strokeWidth={1.75} />
        </div>

        <h2 className="success-panel_title">
          {wasResubmission ? "BRD resubmitted for review" : "BRD submitted for review"}
        </h2>

        <p className="success-panel_body">
          The BRD for <strong>{initiativeName}</strong> has been{" "}
          {wasResubmission ? "resubmitted" : "submitted"} and is now awaiting a
          decision.
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

export default BrdSubmittedPanel;
