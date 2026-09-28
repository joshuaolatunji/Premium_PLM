/**
 * Compile-time aid only. The backend can add a role at any time, so wire DTOs
 * stay `string` and are narrowed with `isKnownRole` — typing them as `RoleName`
 * would make the type lie the moment that happens.
 */
export const KNOWN_ROLES = [
  "SuperAdmin",
  "ProjectManager",
  "ComplianceOfficer",
  "RiskOfficer",
  "FinanceOfficer",
  "GroupHead",
  "BusinessDevelopmentOfficer",
  "SolutionArchitect",
  "PaymentOfficer",
  "Auditor",
  "Executives",
] as const;

export type RoleName = (typeof KNOWN_ROLES)[number];

/** Narrows a role string from the wire to a role this build knows about. */
export function isKnownRole(value: string): value is RoleName {
  return (KNOWN_ROLES as readonly string[]).includes(value);
}

/** True when the user holds at least one of the given roles. */
export function hasRole(roles: readonly string[], required: string): boolean {
  return roles.includes(required);
}

/** True when the user holds every one of the given roles. */
export function hasEveryRole(
  roles: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((role) => roles.includes(role));
}

/** True when the user holds at least one of the given roles. */
export function hasAnyRole(
  roles: readonly string[],
  candidates: readonly string[],
): boolean {
  return candidates.some((role) => roles.includes(role));
}
