const DASH_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** e.g. "Monday, 8 September 2026" */
export function formatLongDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", DASH_FORMAT).format(date);
}

/** Up to two uppercase initials from a display name. */
export function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "U";
}

/** Renders a signed day count, e.g. "3d overdue" / "9d". */
export function formatDaysLeft(days: number | null): string | null {
  if (days === null) {
    return null;
  }

  return days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`;
}

/** Pluralises a count against a noun: `pluralise(1, "day")` -> "1 day". */
export function pluralise(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
