import { INITIATIVE_PRIORITIES } from "../types/initiativeTypes";
import type { ProductInitiative } from "../types/initiativeTypes";
import type { ProductProposal } from "../types/proposalTypes";

export type DerivedStatus = "not-started" | "on-track" | "at-risk" | "overdue";

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  "not-started": "Not started",
  "on-track": "On track",
  "at-risk": "At risk",
  overdue: "Overdue",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// The API's `status` field is an undocumented raw integer (no enum in the
// Swagger spec), so rather than guess at its meaning we derive a status
// purely from the timeline dates the API does document. An initiative
// enters "at risk" once it's in the final 20% of its allotted timeline.
export function deriveStatus(initiative: ProductInitiative): {
  status: DerivedStatus;
  daysLeft: number | null;
} {
  if (!initiative.currentDeadline) {
    return { status: "not-started", daysLeft: null };
  }

  const daysLeft = Math.ceil(
    (new Date(initiative.currentDeadline).getTime() - Date.now()) /
      MS_PER_DAY,
  );

  if (daysLeft < 0) {
    return { status: "overdue", daysLeft };
  }

  if (initiative.timelineStartedAt) {
    const totalDays = Math.max(
      1,
      Math.ceil(
        (new Date(initiative.currentDeadline).getTime() -
          new Date(initiative.timelineStartedAt).getTime()) /
          MS_PER_DAY,
      ),
    );

    if (daysLeft / totalDays <= 0.2) {
      return { status: "at-risk", daysLeft };
    }
    
  }

  return { status: "on-track", daysLeft };
}

export function priorityLabel(priority: number) {
  return (
    INITIATIVE_PRIORITIES.find((entry) => entry.value === priority)?.label ??
    `P${priority}`
  );
}

// Mirrors the color tiers already used by the priority distribution widget
// (.priority-distribution__rank--N / __fill--N in index.css), so a given
// priority reads as the same color everywhere it appears in the app.
export function priorityBadgeClass(priority: number) {
  const tier = INITIATIVE_PRIORITIES.some((entry) => entry.value === priority)
    ? priority
    : 4;

  return `priority-badge priority-badge--${tier}`;
}

// The single source of truth for "where is this initiative in the
// approval chain" — used everywhere a lifecycle stage is shown (the Group
// Head's dashboard, the PM's My Work table, etc.) so the same initiative
// always reads the same stage no matter which page you're on.
// `bdoSubmissionStatus` is the real discovery record's `status` field
// ("Submitted"/"Rejected" confirmed live, "Approved" inferred from the
// same pattern but not directly observed). `proposal.status` is real, but
// only "Draft" and "Approved" are confirmed values (see
// types/proposalTypes.ts) — anything else reads as a generic "under
// review" rather than guessing at an unobserved string.
// A discovery is awaiting the Group Head's decision whether it was submitted
// for the first time ("Submitted") or sent back through resubmit-discovery
// after a rejection ("Resubmitted") — the backend returns the latter after
// a resubmit, so every check for "awaiting decision" goes through here.
export function isAwaitingGroupHeadDecision(status: string | null | undefined): boolean {
  return status === "Submitted" || status === "Resubmitted";
}

// A BRD awaits the Group Head only once it has left the BDO's first-leg
// review. Draft/Approved/Rejected are excluded, and so is any BDO-stage
// status ("PendingBDOReview" is the one confirmed live). The BDO-stage
// match is a pattern because the exact set of BDO-stage strings isn't
// fully documented — widen it if the backend adds another.
export function isBrdAwaitingGroupHeadDecision(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }

  if (status === "Draft" || status === "Approved" || status === "Rejected") {
    return false;
  }

  return !/bdo/i.test(status);
}

export function isBrdAwaitingBdoDecision(status: string | null | undefined): boolean {
  return Boolean(status) && /bdo/i.test(status as string);
}

export function currentStageFor(
  bdoSubmissionStatus: string,
  proposal: ProductProposal | null,
): string {
  if (isAwaitingGroupHeadDecision(bdoSubmissionStatus)) {
    return "Awaiting GH Documentation Approval";
  }

  if (bdoSubmissionStatus === "Rejected") {
    return "BDO Documentation Rejected";
  }

  if (bdoSubmissionStatus !== "Approved") {
    return "BDO Documentation Drafting";
  }

  if (!proposal || proposal.status === "Draft") {
    return "BRD Drafting";
  }

  if (proposal.status === "Approved") {
    return "Approved";
  }

  if (isBrdAwaitingBdoDecision(proposal.status)) {
    return "BRD Awaiting BDO Review";
  }

  return "BRD Under Review";
}

// Slugifies a currentStageFor() value into the matching .status-badge--*
// modifier class already defined in index.css.
export function stageBadgeClass(currentStage: string) {
  const slug = currentStage.toLowerCase().replace(/\s+/g, "-");
  return `status-badge status-badge--${slug}`;
}
