// Parts of the app that switch on in phases. Each flag is read from the
// environment (.env), so a phase can be on in development and still off in
// production with no code change. Anything not set to "true" is off.
//
// Initiatives return in four phases, each needing the one before it:
//   1. VITE_SHOW_INITIATIVE_CORE  initiatives list, create, detail,
//                                 priorities, the PM's My Work
//   2. VITE_SHOW_DOCUMENTS        PID / FRD / BRD / SWR, BDO and Group Head
//                                 reviews, approvals and sign-offs
//   3. VITE_SHOW_ENGINEERING      Lead Engineer tickets, Developer tasks
//   4. VITE_SHOW_OVERSIGHT        the Executive view, categories, audit trail
// While a phase is off, its addresses send people to the memo dashboard.
//
// Memos:
//   VITE_SHOW_MEMO_ATTACHMENTS  the Attachments step and lists. The backend
//                               accepts them now (gap M37, fixed 2026-11-09).
//   VITE_MEMOS_LIVE             removes the "Preview" badge. Leave off until
//                               gaps M33, M26, M39 and M35 are fixed.

function isOn(value: unknown): boolean {
  return value === "true";
}

export const SHOW_INITIATIVE_CORE = isOn(import.meta.env.VITE_SHOW_INITIATIVE_CORE);
export const SHOW_DOCUMENTS = SHOW_INITIATIVE_CORE && isOn(import.meta.env.VITE_SHOW_DOCUMENTS);
export const SHOW_ENGINEERING = SHOW_DOCUMENTS && isOn(import.meta.env.VITE_SHOW_ENGINEERING);
export const SHOW_OVERSIGHT = SHOW_INITIATIVE_CORE && isOn(import.meta.env.VITE_SHOW_OVERSIGHT);

// Any initiative work at all. The shared sidebar, dashboard and search still
// switch on this until phase 1 rebuilds them.
export const SHOW_INITIATIVES = SHOW_INITIATIVE_CORE;

export const SHOW_MEMO_ATTACHMENTS = isOn(import.meta.env.VITE_SHOW_MEMO_ATTACHMENTS);
export const MEMOS_PREVIEW = !isOn(import.meta.env.VITE_MEMOS_LIVE);

// Where everyone lands while initiatives are hidden: the memo dashboard.
export const FOCUS_HOME = "/dashboard";
