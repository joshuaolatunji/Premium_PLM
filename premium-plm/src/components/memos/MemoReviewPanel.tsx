import { Check, Clock, X } from "lucide-react";

import { reviewerLabel } from "../../service/MemoReviewService";
import type { MemoReview, MemoReviewStepStatus } from "../../types/memoTypes";
import { formatDate } from "../../utils/ticketStatus";

const STEP_TEXT: Record<MemoReviewStepStatus, string> = {
  Waiting: "Not yet sent",
  Pending: "Reviewing now",
  Approved: "Approved",
  Declined: "Asked for changes",
  Rejected: "Rejected",
};

// Reuses the signature cards' look (minus the signature line), so the
// review and the signing read the same way.
const STEP_CLASS: Record<MemoReviewStepStatus, string> = {
  Waiting: "signoff-card--waiting",
  Pending: "signoff-card--pending",
  Approved: "signoff-card--signed",
  Declined: "signoff-card--rejected",
  Rejected: "signoff-card--rejected",
};

interface MemoReviewPanelProps {
  review: MemoReview;
}

// For the memo's author: who it's with in review, in order, and what each
// reviewer decided.
function MemoReviewPanel({ review }: MemoReviewPanelProps) {
  const approved = review.steps.filter((step) => step.status === "Approved").length;
  const current = review.steps.find((step) => step.status === "Pending");
  const declined = review.steps.find((step) => step.status === "Declined");
  const rejected = review.steps.find((step) => step.status === "Rejected");

  const summary =
    review.status === "Approved"
      ? "Every reviewer has approved it."
      : review.status === "Rejected"
        ? `Rejected${rejected ? ` by ${reviewerLabel(rejected)}` : ""}.`
        : declined
          ? `${reviewerLabel(declined)} asked for changes. Edit the memo and send it again.`
          : current
            ? `With ${reviewerLabel(current)}${current.reviewerRole ? ` (${current.reviewerRole})` : ""}: ${approved} of ${review.steps.length} approved.`
            : "In review.";

  const badge =
    review.status === "Approved"
      ? { className: "status-badge status-badge--approved", text: "Reviewed" }
      : review.status === "Rejected"
        ? { className: "status-badge status-badge--bdo-documentation-rejected", text: "Rejected" }
        : review.status === "Declined"
          ? { className: "status-badge status-badge--bdo-documentation-rejected", text: "Changes requested" }
          : { className: "status-badge status-badge--brd-under-review", text: "In review" };

  return (
    <section className="dashboard-panel initiative-detail-panel approval-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Review{review.round > 1 ? ` (round ${review.round})` : ""}</h2>
          <p>{summary}</p>
        </div>

        <span className={badge.className}>{badge.text}</span>
      </div>

      <div className="proposal-section">
        {review.changeNote && (
          <p className="memo-review-note">
            <strong>What changed:</strong> {review.changeNote}
          </p>
        )}

        <ol className="signoff-grid">
          {review.steps.map((step) => (
            <li key={step.id} className={`signoff-card memo-review-card ${STEP_CLASS[step.status]}`}>
              <div className="signoff-card_header">
                <span className="signoff-card_sequence">{step.sequence}</span>
                <span className="signoff-card_status">
                  {step.status === "Approved" && <Check size={14} aria-hidden="true" />}
                  {(step.status === "Declined" || step.status === "Rejected") && <X size={14} aria-hidden="true" />}
                  {step.status === "Pending" && <Clock size={14} aria-hidden="true" />}
                  {STEP_TEXT[step.status]}
                </span>
              </div>

              <div className="signoff-card_person">
                <strong>{reviewerLabel(step)}</strong>
                <span>{step.reviewerRole}</span>
                <span>Date: {step.decidedAt ? formatDate(step.decidedAt) : "—"}</span>
              </div>

              {step.comment && <p className="signoff-card_comment">“{step.comment}”</p>}
            </li>
          ))}
        </ol>

      </div>
    </section>
  );
}

export default MemoReviewPanel;
