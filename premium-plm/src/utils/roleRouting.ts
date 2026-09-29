export type PrimaryRole =
  | "SuperAdmin"
  | "GroupHead"
  | "BusinessDevelopmentOfficer"
  | "ProjectManager"
  | "LeadEngineer"
  | "SoftwareEngineer"
  | "Other";

// Ordered by rank, outranking the approval chain's own hierarchy: Super
// Admin → Group Head → Business Development Officer → Project Manager →
// Lead Engineer → Software Engineer. A user can hold multiple roles at
// once — the first match here wins, so e.g. Group Head + Project Manager
// still lands on the Group Head workspace, preserving existing behaviour
// for the current test account. This single list backs the post-login
// landing route, the `/dashboard` index redirect, and which sidebar nav
// renders, so all three always agree with each other.
//
// "GroupHead" and "ProjectManager" are confirmed live (seen in real JWTs).
// The other four role identity strings are placeholders — nothing
// confirms the backend's real names for Super Admin/BDO/Lead
// Engineer/Software Engineer yet, since no login has ever returned them.
// Correct these the moment a real JWT with one of these roles is seen.
const ROLE_PRIORITY: { role: Exclude<PrimaryRole, "Other">; path: string }[] = [
  { role: "SuperAdmin", path: "/dashboard" },
  { role: "GroupHead", path: "/dashboard" },
  { role: "BusinessDevelopmentOfficer", path: "/dashboard/bdo" },
  { role: "ProjectManager", path: "/dashboard/my-work" },
  { role: "LeadEngineer", path: "/dashboard/lead-engineer" },
  { role: "SoftwareEngineer", path: "/dashboard/developer" },
];

export function resolvePrimaryRole(roles: string[]): PrimaryRole {
  return ROLE_PRIORITY.find((entry) => roles.includes(entry.role))?.role ?? "Other";
}

export function getLandingRouteForRoles(roles: string[]): string {
  // A recognized role lands on its own workspace; anyone else (no
  // recognized role, or a role with no dedicated workspace yet) lands on
  // the Group Head dashboard as the best available fallback.
  return ROLE_PRIORITY.find((entry) => roles.includes(entry.role))?.path ?? "/dashboard";
}
