import { useState } from "react";

export type Decision = "approve" | "reject";

interface DecisionModalProps {
  decision: Decision;
  approveTitle: string;
  rejectTitle: string;
  approveBody: string;
  rejectLabel: string;
  rejectPlaceholder: string;
  isPending: boolean;
  // Surfaced from the caller's mutation (e.g. a failed API call) — distinct
  // from this modal's own "comment is required" validation error below.
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (comment: string) => void;
}

// Shared approve/reject confirmation, used everywhere in the approval
// chain (BRD review, BDO documentation review, and future ticket/work
// reviews): approving never shows a comment box; rejecting always requires
// one before it can be confirmed.
function DecisionModal({
  decision,
  approveTitle,
  rejectTitle,
  approveBody,
  rejectLabel,
  rejectPlaceholder,
  isPending,
  errorMessage,
  onCancel,
  onConfirm,
}: DecisionModalProps) {
  const [comment, setComment] = useState("");
  const [validationError, setValidationError] = useState("");

  function handleConfirm() {
    if (decision === "reject" && !comment.trim()) {
      setValidationError("A comment is required before rejecting.");
      return;
    }

    setValidationError("");
    onConfirm(decision === "reject" ? comment.trim() : "");
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={() => !isPending && onCancel()}
    >
      <div
        className="modal-panel modal-panel--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel_header">
          <h2 id="decision-modal-title">
            {decision === "approve" ? approveTitle : rejectTitle}
          </h2>
        </div>

        <div className="modal-panel_body">
          {decision === "approve" ? (
            <p className="brd-confirm-copy">{approveBody}</p>
          ) : (
            <div className="form-field">
              <label htmlFor="decision-comment">{rejectLabel}</label>

              <textarea
                id="decision-comment"
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={rejectPlaceholder}
              />
            </div>
          )}

          {(validationError || errorMessage) && (
            <p className="form-error" role="alert">
              {validationError || errorMessage}
            </p>
          )}
        </div>

        <div className="modal-panel_footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>

          <button
            type="button"
            className={
              decision === "approve"
                ? "button button--primary"
                : "button button--primary brd-reject-confirm"
            }
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending
              ? "Recording…"
              : decision === "approve"
                ? approveTitle
                : rejectTitle}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DecisionModal;
