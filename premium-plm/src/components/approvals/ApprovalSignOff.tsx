import { Check, Clock, X } from "lucide-react";

import type { ApprovalStep, ApprovalStepStatus } from "../../types/approvalTypes";
import { formatDate } from "../../utils/ticketStatus";

const STATUS_TEXT: Record<ApprovalStepStatus, string> = {
  Waiting: "Not yet sent",
  Pending: "Awaiting signature",
  Signed: "Signed",
  Rejected: "Rejected",
};

interface ApprovalSignOffProps {
  steps: ApprovalStep[];
  // Highlights the signed-in approver's own space.
  currentStepId?: string;
}

// The approvers' names with a signature space for each, in signing order —
// the same block the backend adds to the document's PDF. A space fills in
// with the signature and date once that person signs.
function ApprovalSignOff({ steps, currentStepId }: ApprovalSignOffProps) {
  return (
    <ol className="signoff-grid">
      {steps.map((step) => (
        <li
          key={step.id}
          className={[
            "signoff-card",
            `signoff-card--${step.status.toLowerCase()}`,
            step.id === currentStepId ? "signoff-card--current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="signoff-card_header">
            <span className="signoff-card_sequence">{step.sequence}</span>
            <span className="signoff-card_status">
              {step.status === "Signed" && <Check size={14} aria-hidden="true" />}
              {step.status === "Rejected" && <X size={14} aria-hidden="true" />}
              {step.status === "Pending" && <Clock size={14} aria-hidden="true" />}
              {STATUS_TEXT[step.status]}
            </span>
          </div>

          <div className="signoff-card_signature">
            {step.signatureImage ? (
              <img src={step.signatureImage} alt={`Signature of ${step.approverName}`} />
            ) : (
              <span className="signoff-card_placeholder">
                {step.status === "Signed" ? "Signed (image on the PDF)" : "Signature"}
              </span>
            )}
          </div>

          <div className="signoff-card_person">
            <strong title={step.approverName}>{step.approverName}</strong>
            <span title={step.approverRole}>{step.approverRole}</span>
            <span>Date: {step.decidedAt ? formatDate(step.decidedAt) : "—"}</span>
          </div>

          {step.status === "Rejected" && step.comment && (
            <p className="signoff-card_comment">“{step.comment}”</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export default ApprovalSignOff;
