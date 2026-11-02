import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSignature } from "lucide-react";

import { approvalKeys, getWorkflowForDocument } from "../../service/ApprovalWorkflowService";
import type { ProductDocument } from "../../types/documentTypes";

// The sign-off panel's id, so the prompt can take the PM straight to it.
export const SIGN_OFF_PANEL_ID = "sign-off";

interface SignOffPromptProps {
  document: ProductDocument;
  // Shown instead when there's nothing to set up (e.g. "This PID has been approved.").
  fallback: ReactNode;
}

// At the top of an approved document, for the Product Manager: a prompt to
// set up its sign-off when it has none yet (or the last one was rejected).
// Reads the same cache entry as the sign-off panel, so it adds no request.
function SignOffPrompt({ document, fallback }: SignOffPromptProps) {
  const workflowQuery = useQuery({
    queryKey: approvalKeys.forDocument(document.id),
    queryFn: () => getWorkflowForDocument(document),
  });

  const workflow = workflowQuery.data;
  const needsSetup = workflowQuery.isSuccess && (!workflow || workflow.status === "Rejected");

  if (!needsSetup) {
    return <>{fallback}</>;
  }

  // Scrolls to the panel and puts the cursor on the first approver.
  function goToSetup() {
    const panel = window.document.getElementById(SIGN_OFF_PANEL_ID);
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => panel?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true }), 400);
  }

  const rejected = workflow?.status === "Rejected";

  return (
    <div className="signoff-prompt" role="status">
      <span className="signoff-prompt_icon" aria-hidden="true">
        <FileSignature size={20} />
      </span>

      <div className="signoff-prompt_text">
        <strong>{rejected ? `Sign-off for this ${document.type} was rejected` : `This ${document.type} is approved`}</strong>
        <p>
          {rejected
            ? "Choose the approvers again, in order, and send it for sign-off."
            : "Set up its sign-off: choose who signs it, in order, then send it."}
        </p>
      </div>

      <button type="button" className="button button--primary" onClick={goToSetup}>
        <FileSignature size={17} aria-hidden="true" />
        Set up sign-off
      </button>
    </div>
  );
}

export default SignOffPrompt;
