import { useQuery } from "@tanstack/react-query";
import { Check, Clock, X } from "lucide-react";

import { approvalKeys, fetchSignatureImage } from "../../service/ApprovalWorkflowService";
import type { ApprovalStep, ApprovalStepStatus } from "../../types/approvalTypes";
import { formatDate } from "../../utils/ticketStatus";

const STATUS_TEXT: Record<ApprovalStepStatus, string> = {
  Waiting: "Not yet sent",
  Pending: "Awaiting signature",
  Signed: "Signed",
  Rejected: "Rejected",
};

// A signed step's signature, from signature-image. Each one is cached, so
// it's fetched once per session.
function StepSignature({ workflowId, step }: { workflowId: string; step: ApprovalStep }) {
  const signatureQuery = useQuery({
    queryKey: approvalKeys.signature(workflowId, step.id),
    queryFn: () => fetchSignatureImage(workflowId, step.id),
    staleTime: Infinity,
    retry: false,
  });

  if (signatureQuery.data) {
    return <img src={signatureQuery.data} alt={`Signature of ${step.approverName}`} />;
  }

  return (
    <span className="signoff-card_placeholder">
      {signatureQuery.isLoading ? "Loading signature…" : "Signed (image on the PDF)"}
    </span>
  );
}

interface ApprovalSignOffProps {
  // Whose steps these are, for fetching each signature.
  workflowId?: string;
  steps: ApprovalStep[];
  // Highlights the signed-in approver's own space.
  currentStepId?: string;
}

// The approvers' names with a signature space for each, in signing order —
// the same block the backend adds to the document's PDF. A space fills in
// with the signature and date once that person signs.
function ApprovalSignOff({ workflowId, steps, currentStepId }: ApprovalSignOffProps) {
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
            ) : step.status === "Signed" && workflowId ? (
              <StepSignature workflowId={workflowId} step={step} />
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
