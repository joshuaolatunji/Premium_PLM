// The workspace a user gets, from their role. Each is an API role name
// (exactly as get_all_roles returns it), except "Approver": the app's own
// name for everyone whose only job here is signing off documents the
// Product Manager sends them.
export type PrimaryRole =
  | "SuperAdmin"
  | "Executives"
  | "GroupHead"
  | "BusinessDevelopmentOfficer"
  | "ProjectManager"
  | "LeadEngineer"
  | "Developer"
  | "Approver";

// Each user holds exactly one role. This list maps it to that role's
// workspace, and backs the post-login landing route, the `/dashboard` index
// redirect and which sidebar nav renders, so all three always agree.
//
// The API sends roles as a list (the JWT and UserResponseDto.role), but it
// only ever contains one; the first role this list recognises is used.
const ROLE_WORKSPACES: { role: Exclude<PrimaryRole, "Approver">; path: string }[] = [
  { role: "SuperAdmin", path: "/dashboard/admin/users" },
  { role: "Executives", path: "/dashboard/executive" },
  { role: "GroupHead", path: "/dashboard" },
  { role: "BusinessDevelopmentOfficer", path: "/dashboard/bdo" },
  { role: "ProjectManager", path: "/dashboard/my-work" },
  { role: "LeadEngineer", path: "/dashboard/lead-engineer" },
  { role: "Developer", path: "/dashboard/developer" },
];

// The API's other roles — RiskOfficer, SolutionArchitect, QualityTester,
// Auditor, PaymentOfficer, FinanceOfficer, ComplianceOfficer — have
// no workspace of their own. They, and any role added later, get Approvals:
// the documents sent to them for sign-off.
const APPROVER_PATH = "/dashboard/approvals";

// The Product Manager role is "ProjectManager" on the API today. If the
// backend renames it to "ProductManager", both are treated as the same
// role so routing, nav, and access checks keep working either way.
const ROLE_ALIASES: Record<string, string> = {
  ProductManager: "ProjectManager",
};

function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => ROLE_ALIASES[role] ?? role);
}

function workspaceFor(roles: string[]) {
  const normalized = normalizeRoles(roles);
  return ROLE_WORKSPACES.find((entry) => normalized.includes(entry.role)) ?? null;
}

export function resolvePrimaryRole(roles: string[]): PrimaryRole {
  return workspaceFor(roles)?.role ?? "Approver";
}

export function getLandingRouteForRoles(roles: string[]): string {
  return workspaceFor(roles)?.path ?? APPROVER_PATH;
}

// Developers and Lead Engineers are never on a document sign-off workflow:
// developers only do the work, and the Lead Engineer's only approval is of
// that work. Everyone else can be picked by a Product Manager to sign.
const NON_SIGNING_ROLES = ["Developer", "LeadEngineer"];

export function canSignOff(roles: string[]): boolean {
  return !normalizeRoles(roles).some((role) => NON_SIGNING_ROLES.includes(role));
}

// Whether a user's roles include `role`, counting a renamed role (see
// ROLE_ALIASES) as the same role.
export function hasRole(roles: string[], role: string): boolean {
  return normalizeRoles(roles).includes(role);
}
