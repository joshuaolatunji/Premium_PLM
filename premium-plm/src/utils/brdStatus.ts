// "Draft" is the only BRD status string we've confirmed live besides
// "Approved" (per user-confirmed behavior after a Group Head approval) —
// anything else (submitted, under review, rejected — exact names unknown)
// stays neutral rather than guessing a color for a string we've never seen.
export function brdStatusBadgeClass(status: string): string {
  if (status === "Approved") {
    return "status-badge status-badge--approved";
  }

  return "status-badge status-badge--not-started";
}
