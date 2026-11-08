// Helpers for choosing approvers (a document's or a memo's sign-off) and a
// memo's reviewers.

import type { ApproverInput } from "../types/approvalTypes";

export const EMPTY_APPROVER: ApproverInput = { userId: "", name: "", role: "" };

export type PersonNoun = "approver" | "reviewer";

// 1 → "1st approver", 2 → "2nd approver"… ("1st reviewer" for reviewers).
export function approverLevel(position: number, noun: PersonNoun = "approver"): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] ?? "th");

  return `${position}${suffix} ${noun}`;
}

// What's wrong with the chosen people, or null if they can be sent.
export function approverRowsError(rows: ApproverInput[], noun: PersonNoun = "approver"): string | null {
  if (rows.filter((row) => row.userId.trim()).length === 0) {
    return `Add at least one ${noun}.`;
  }

  if (rows.some((row) => !row.userId)) {
    return `Choose a person for every ${noun === "approver" ? "approval" : "review"} level, or remove the empty ones.`;
  }

  if (new Set(rows.map((row) => row.userId.trim())).size !== rows.length) {
    return "Each person can only appear once.";
  }

  return null;
}
