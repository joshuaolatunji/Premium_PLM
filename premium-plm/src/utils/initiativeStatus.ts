import { INITIATIVE_PRIORITIES } from "../types/initiativeTypes";
import type { ProductInitiative } from "../types/initiativeTypes";

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
