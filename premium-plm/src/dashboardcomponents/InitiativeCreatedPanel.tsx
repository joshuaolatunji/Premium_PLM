import { CheckCircle2 } from "lucide-react";

interface InitiativeCreatedPanelProps {
  projectName: string;
  bdoName: string | null;
  pmName: string | null;
  onOpenInitiative: () => void;
}

// Confirmation screen shown after a new initiative is successfully created.
function InitiativeCreatedPanel({
  projectName,
  bdoName,
  pmName,
  onOpenInitiative,
}: InitiativeCreatedPanelProps) {
  return (
    <div className="success-panel">
      <div className="success-panel_badge">
        <CheckCircle2 size={28} strokeWidth={1.75} />
      </div>

      <h2 id="initiative-created-title" className="success-panel_title">
        Initiative created
      </h2>

      <p className="success-panel_body">
        <strong>{projectName}</strong> has been created.
        {bdoName
          ? ` ${bdoName} has been assigned and can begin preparing the discovery documentation.`
          : " The assigned Business Development Officer can begin preparing the discovery documentation."}
        {pmName
          ? ` ${pmName} has also been assigned as Project Manager and will be notified once the documentation is approved.`
          : " A Project Manager has also been assigned and will be notified once the documentation is approved."}
      </p>

      <div className="success-panel_note">
        The delivery countdown does not start until the BRD is approved.
      </div>

      <button
        type="button"
        className="button button--primary success-panel_action"
        onClick={onOpenInitiative}
      >
        Open initiative
      </button>
    </div>
  );
}

export default InitiativeCreatedPanel;
