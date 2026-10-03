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
export function currentStageFor(
  bdoSubmissionStatus: string,
  proposal: ProductProposal | null,
): string {
  if (bdoSubmissionStatus === "Submitted") {
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

  return "BRD Under Review";
}

// Slugifies a currentStageFor() value into the matching .status-badge--*
// modifier class already defined in index.css.
export function stageBadgeClass(currentStage: string) {
  const slug = currentStage.toLowerCase().replace(/\s+/g, "-");
  return `status-badge status-badge--${slug}`;
}
