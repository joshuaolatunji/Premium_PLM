import type { PLMUser } from "../types/userTypes";
import { hasRole } from "./roleRouting";

// Whether an account is active (not deactivated by the Super Admin).
// Prefers the real `isActive` flag; falls back to the lockout flag only if
// a response ever omits it.
export function isUserActive(user: PLMUser): boolean {
  return typeof user.isActive === "boolean" ? user.isActive : !user.isLockedOut;
}

// The users who can be picked for a role in a dropdown: holders of that
// role whose account is still active — a deactivated user can't be newly
// assigned to anything. (Names on existing records are looked up from the
// full user list, so someone already assigned still shows by name.)
export function activeUsersWithRole(users: PLMUser[] | undefined, role: string): PLMUser[] {
  return (users ?? []).filter((user) => hasRole(user.role, role) && isUserActive(user));
}
