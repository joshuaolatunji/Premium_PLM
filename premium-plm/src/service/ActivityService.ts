// Every action anyone takes on a product, for the Group Head's notifications
// and the Audit Trail.
//
// The API has no activity feed or Group Head notifications yet (gaps file
// M21), so each service records its actions here, on this browser, after the
// API call succeeds. Entries are shared by every account signed in on the
// same browser; on another device the Group Head won't see them until the
// backend sends them.
//
// Actions on a record that only knows its own id (e.g. submitting the BDO
// documentation by its discovery id) are linked to their initiative through
// links the services remember when those records are loaded.

import { getCurrentUserId, getStoredUser } from "../apicalls/authStorage";
import { listRows, makeLocalId, readRow, simulateLatency, writeRow } from "../mocks/localStore";
import { capitalize, formatRoleName } from "../utils/text";

const ACTIVITY = "project-activity";
const LINKS = "record-initiatives";
const INITIATIVE_NAMES = "initiative-names";

export type ActivityArea =
  | "Initiative"
  | "BDO documentation"
  | "Documents"
  | "Sign-off"
  | "Tickets"
  | "Tasks";

export type ActivityTone = "info" | "success" | "warning" | "danger";

export interface ProjectActivity {
  id: string;
  at: string;
  initiativeId: string;
  // As it was when the action happened, so it reads well even if the
  // initiative can't be loaded later.
  initiativeName: string | null;
  area: ActivityArea;
  // e.g. "sent the PID to the BDO for review" (follows the actor's name).
  action: string;
  // A ticket or task title, a comment… shown under the action.
  detail: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  tone: ActivityTone;
  // Where the Group Head goes to see it.
  link: string;
}

// ---------------------------------------------------------------------------
// Links from a record to its initiative

export type LinkedRecord = "discovery" | "workflow" | "ticket" | "task" | "document" | "attachment";

export function linkToInitiative(kind: LinkedRecord, recordId: string | null | undefined, initiativeId: string | null | undefined) {
  if (recordId && initiativeId) {
    writeRow(LINKS, `${kind}:${recordId}`, initiativeId);
  }
}

export function initiativeOf(kind: LinkedRecord, recordId: string | null | undefined): string | null {
  return recordId ? readRow<string>(LINKS, `${kind}:${recordId}`) : null;
}

export function rememberInitiativeName(initiativeId: string | null | undefined, name: string | null | undefined) {
  if (initiativeId && name) {
    writeRow(INITIATIVE_NAMES, initiativeId, name);
  }
}

// ---------------------------------------------------------------------------
// Recording and reading

interface RecordActivityInput {
  initiativeId: string | null | undefined;
  area: ActivityArea;
  action: string;
  detail?: string | null;
  tone?: ActivityTone;
  link?: string;
}

// Never throws: a failed record mustn't undo an action that succeeded.
export function recordActivity({ initiativeId, area, action, detail = null, tone = "info", link }: RecordActivityInput) {
  try {
    const user = getStoredUser();
    const id = initiativeId ?? "";

    const entry: ProjectActivity = {
      id: makeLocalId("activity"),
      at: new Date().toISOString(),
      initiativeId: id,
      initiativeName: id ? readRow<string>(INITIATIVE_NAMES, id) : null,
      area,
      action,
      detail: detail?.trim() || null,
      actorId: getCurrentUserId() ?? "",
      actorName: user?.userName ? capitalize(user.userName) : "Someone",
      actorRole: user?.roles[0] ? formatRoleName(user.roles[0]) : "",
      tone,
      link: link ?? (id ? `/dashboard/initiatives/${id}` : "/dashboard"),
    };

    writeRow(ACTIVITY, entry.id, entry);
  } catch {
    // Storage full or blocked — the action itself still happened.
  }
}

// Newest first, optionally for one initiative.
export function listActivity(initiativeId?: string): ProjectActivity[] {
  return listRows<ProjectActivity>(ACTIVITY)
    .filter((entry) => !initiativeId || entry.initiativeId === initiativeId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function getProjectActivity(limit?: number, initiativeId?: string): Promise<ProjectActivity[]> {
  const entries = listActivity(initiativeId);
  return simulateLatency(limit ? entries.slice(0, limit) : entries);
}

// "Ada (Product Manager) sent the PID to the BDO for review"
export function describeActivity(entry: ProjectActivity): string {
  const who = entry.actorRole ? `${entry.actorName} (${entry.actorRole})` : entry.actorName;
  return `${who} ${entry.action}`;
}
