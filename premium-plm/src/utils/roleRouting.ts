export type PrimaryRole =
  | "SuperAdmin"
  | "GroupHead"
  | "BusinessDevelopmentOfficer"
  | "ProjectManager"
  | "LeadEngineer"
  | "SoftwareEngineer"
  | "Other";

// Ordered by rank, outranking the approval chain's own hierarchy: Super
// Admin → Group Head → Business Development Officer → Product Manager →
// Lead Engineer → Software Engineer. A user can hold multiple roles at
// once — the first match here wins, so e.g. Group Head + Product Manager
// still lands on the Group Head workspace, preserving existing behaviour
// for the current test account. This single list backs the post-login
// landing route, the `/dashboard` index redirect, and which sidebar nav
// renders, so all three always agree with each other.
//
// "GroupHead", "ProjectManager", and "BusinessDevelopmentOfficer" are
// confirmed live (seen in real JWTs). "SuperAdmin", "LeadEngineer", and
// "SoftwareEngineer" are still placeholders — correct them the moment a
// real JWT with one of those roles is seen.
const ROLE_PRIORITY: { role: Exclude<PrimaryRole, "Other">; path: string }[] = [
  { role: "SuperAdmin", path: "/dashboard/admin/users" },
  { role: "GroupHead", path: "/dashboard" },
  { role: "BusinessDevelopmentOfficer", path: "/dashboard/bdo" },
  { role: "ProjectManager", path: "/dashboard/my-work" },
  { role: "LeadEngineer", path: "/dashboard/lead-engineer" },
  { role: "SoftwareEngineer", path: "/dashboard/developer" },
];

// The Product Manager role is "ProjectManager" on the API today. If the
// backend renames it to "ProductManager", both are treated as the same
// role so routing, nav, and access checks keep working either way.
const ROLE_ALIASES: Record<string, string> = {
  ProductManager: "ProjectManager",
};

function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => ROLE_ALIASES[role] ?? role);
}

export function resolvePrimaryRole(roles: string[]): PrimaryRole {
  const normalized = normalizeRoles(roles);
  return ROLE_PRIORITY.find((entry) => normalized.includes(entry.role))?.role ?? "Other";
}

export function getLandingRouteForRoles(roles: string[]): string {
  // A recognized role lands on its own workspace; anyone else (no
  // recognized role, or a role with no dedicated workspace yet) lands on
  // the Group Head dashboard as the best available fallback.
  const normalized = normalizeRoles(roles);
  return ROLE_PRIORITY.find((entry) => normalized.includes(entry.role))?.path ?? "/dashboard";
}

// Whether a user's roles include `role`, counting a renamed role (see
// ROLE_ALIASES) as the same role.
export function hasRole(roles: string[], role: string): boolean {
  return normalizeRoles(roles).includes(role);
}
