import { Check, Clock, X } from "lucide-react";

import type { MemoReview, MemoReviewStepStatus } from "../../types/memoTypes";
import { formatDate } from "../../utils/ticketStatus";

const STEP_TEXT: Record<MemoReviewStepStatus, string> = {
  Waiting: "Not yet sent",
  Pending: "Reviewing now",
  Approved: "Approved",
  Declined: "Declined",
};

// Reuses the signature cards' look (minus the signature line), so the
// review and the signing read the same way.
const STEP_CLASS: Record<MemoReviewStepStatus, string> = {
  Waiting: "signoff-card--waiting",
  Pending: "signoff-card--pending",
  Approved: "signoff-card--signed",
  Declined: "signoff-card--rejected",
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

  const summary =
    review.status === "Approved"
      ? "Every reviewer has approved it."
      : declined
        ? `Declined by ${declined.reviewerName}. Edit the memo and send it again.`
        : current
          ? `With ${current.reviewerName}${current.reviewerRole ? ` (${current.reviewerRole})` : ""}: ${approved} of ${review.steps.length} approved.`
          : "In review.";

  const badge =
    review.status === "Approved"
      ? { className: "status-badge status-badge--approved", text: "Reviewed" }
      : review.status === "Declined"
        ? { className: "status-badge status-badge--bdo-documentation-rejected", text: "Declined" }
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
                  {step.status === "Declined" && <X size={14} aria-hidden="true" />}
                  {step.status === "Pending" && <Clock size={14} aria-hidden="true" />}
                  {STEP_TEXT[step.status]}
                </span>
              </div>

              <div className="signoff-card_person">
                <strong title={step.reviewerName}>{step.reviewerName}</strong>
                <span title={step.reviewerRole}>{step.reviewerRole}</span>
                <span>Date: {step.decidedAt ? formatDate(step.decidedAt) : "—"}</span>
              </div>

              {step.comment && <p className="signoff-card_comment">“{step.comment}”</p>}
            </li>
          ))}
        </ol>

        <p className="mock-data-notice">
          The review is kept in this browser until the backend adds it (gaps file M34), so reviewers see the memo only
          when signed in on this browser.
        </p>
      </div>
    </section>
  );
}

export default MemoReviewPanel;
