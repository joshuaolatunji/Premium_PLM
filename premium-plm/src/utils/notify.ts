import { sileo } from "sileo";
import type { ReactNode } from "react";

// Every toast in the app (except the sign-in welcome, which keeps its own
// short timing) goes through here: a solid island in the message's colour,
// white text, a larger bold title over a lighter message, and long enough
// on screen to read. Styles in index.css ("Toasts").

// How long a toast stays up.
export const TOAST_MS = 5000;

// Solid fills, each dark enough for white text (at least 4.5:1).
const FILL = {
  success: "#12805c",
  error: "#c62828",
  warning: "#9a5800",
  info: "#2f5fa7",
} as const;

const STYLES = { title: "sileo-solid", badge: "sileo-solid", description: "sileo-solid" };

interface ToastInput {
  title: string;
  description?: ReactNode;
  // Defaults to TOAST_MS.
  duration?: number;
}

function options(kind: keyof typeof FILL, { title, description, duration = TOAST_MS }: ToastInput) {
  return {
    title,
    description,
    duration,
    fill: FILL[kind],
    styles: STYLES,
    // Sileo folds the message away after 4 s by default; keep it open until
    // just before the toast leaves.
    autopilot: { expand: 150, collapse: Math.max(1000, duration - 700) },
  };
}

export function notifySuccess(input: ToastInput): string {
  return sileo.success(options("success", input));
}

export function notifyWarning(input: ToastInput): string {
  return sileo.warning(options("warning", input));
}

export function notifyInfo(input: ToastInput): string {
  return sileo.info(options("info", input));
}

// An error toast. Returns the same words as one line, for the page's own
// error slot, so the message stays on screen after the toast has gone:
//
//   setErrorMessage(notifyError("Couldn't save the memo", error));
export function notifyError(title: string, detail?: unknown): string {
  const description =
    typeof detail === "string" ? detail : detail instanceof Error && detail.message ? detail.message : "Try again.";

  sileo.error(options("error", { title, description }));

  return `${title}. ${description}`;
}
