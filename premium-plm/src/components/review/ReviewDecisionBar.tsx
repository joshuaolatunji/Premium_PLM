interface ReviewDecisionBarProps {
  // A short prompt on the left, e.g. "Reviewed everything? …".
  hint: string;
  onReject: () => void;
  onApprove: () => void;
  disabled?: boolean;
}

// Reject / Approve repeated at the end of a review page, so the reviewer
// can decide right after reading to the bottom instead of scrolling back
// up to the header. Opens the same DecisionModal as the header buttons
// (reject still requires a written reason). Not sticky — the header
// already has the same buttons near the top.
function ReviewDecisionBar({ hint, onReject, onApprove, disabled = false }: ReviewDecisionBarProps) {
  return (
    <div className="bdo-action-bar bdo-action-bar--static review-decision-bar">
      <p className="bdo-action-bar_hint">{hint}</p>

      <div className="brd-reviews-actions">
        <button
          type="button"
          className="button button--secondary brd-reject-button"
          onClick={onReject}
          disabled={disabled}
        >
          Reject
        </button>

        <button
          type="button"
          className="button button--primary"
          onClick={onApprove}
          disabled={disabled}
        >
          Approve
        </button>
      </div>
    </div>
  );
}

export default ReviewDecisionBar;
