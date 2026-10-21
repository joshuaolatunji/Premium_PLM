import { INITIATIVE_PRIORITIES } from "../types/initiativeTypes";
import type { ProductInitiative } from "../types/initiativeTypes";
import { DOCUMENT_TYPES } from "../types/documentTypes";
import type { InitiativeDocuments } from "../types/documentTypes";

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

// How much of the initiative's timeline has passed, as a whole percentage
// (0–100) from timelineStartedAt to currentDeadline. Null until the
// timeline has started (it starts when the BRD is approved).
export function timelineElapsedPercent(initiative: ProductInitiative): number | null {
  if (!initiative.timelineStartedAt || !initiative.currentDeadline) {
    return null;
  }

  const start = new Date(initiative.timelineStartedAt).getTime();
  const end = new Date(initiative.currentDeadline).getTime();

  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
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
// same pattern but not directly observed). After that, the stage comes from
// the four product documents (PID, FRD, BRD, SWR — see DocumentService.ts).
// A discovery is awaiting the Group Head's decision whether it was submitted
// for the first time ("Submitted") or sent back through resubmit-discovery
// after a rejection ("Resubmitted") — the backend returns the latter after
// a resubmit, so every check for "awaiting decision" goes through here.
export function isAwaitingGroupHeadDecision(status: string | null | undefined): boolean {
  return status === "Submitted" || status === "Resubmitted";
}

// The PID/FRD/BRD/SWR can be worked on in any order, so several can be at
// different points at once. The stage reports the step furthest along the
// review chain that's still waiting on someone: the Group Head first, then
// the BDO, otherwise the PM (drafting, or reworking a returned document).
function anyDocument(documents: InitiativeDocuments | null, status: string): boolean {
  return Boolean(documents) && DOCUMENT_TYPES.some((type) => documents?.[type]?.status === status);
}

function allDocumentsApproved(documents: InitiativeDocuments | null): boolean {
  return Boolean(documents) && DOCUMENT_TYPES.every((type) => documents?.[type]?.status === "Approved");
}

export function currentStageFor(
  bdoSubmissionStatus: string,
  documents: InitiativeDocuments | null,
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

  // All four documents approved moves the initiative into delivery.
  if (allDocumentsApproved(documents)) {
    return "Product Development";
  }

  if (anyDocument(documents, "PendingGroupHeadReview")) {
    return "Documents Under GH Review";
  }

  if (anyDocument(documents, "PendingBDOReview")) {
    return "Documents Awaiting BDO Review";
  }

  return "Product Documentation";
}

// Who the initiative is with right now — takes the same inputs as
// currentStageFor() so the two always agree:
// - BDO: their documentation being drafted or reworked, or a document
//   awaiting their review
// - Group Head (the initiative's creator): an approval pending on them
// - PM: documents being drafted or reworked, and Product Development
export function currentStageOwnerId(
  bdoSubmissionStatus: string,
  documents: InitiativeDocuments | null,
  initiative: Pick<ProductInitiative, "bdoId" | "projectManagerId" | "createdByUserId">,
): string | null {
  switch (currentStageFor(bdoSubmissionStatus, documents)) {
    case "Awaiting GH Documentation Approval":
    case "Documents Under GH Review":
      return initiative.createdByUserId;
    case "BDO Documentation Drafting":
    case "BDO Documentation Rejected":
    case "Documents Awaiting BDO Review":
      return initiative.bdoId;
    default:
      return initiative.projectManagerId;
  }
}

// Slugifies a currentStageFor() value (e.g. "BRD Under Review" →
// "brd-under-review") — the suffix for the matching CSS modifier classes.
function stageSlug(currentStage: string) {
  return currentStage.toLowerCase().replace(/\s+/g, "-");
}

// The pill-style stage badge (.status-badge--*).
export function stageBadgeClass(currentStage: string) {
  // `status-badge--stage` marks it as a stage (vs a status) badge, so tables
  // can give every stage pill the same width.
  return `status-badge status-badge--stage status-badge--${stageSlug(currentStage)}`;
}
