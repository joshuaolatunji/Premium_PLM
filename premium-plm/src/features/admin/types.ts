import type { ApiEnvelope } from "@/lib/api/envelope";

/**
 * Not normalised on purpose — the API is not: `create-user` takes
 * `emailAddress`, `get_all_users` returns `email` and `role`, login returns
 * `roles`. Each type mirrors one endpoint exactly.
 */

/** As returned by `get_all_users`. Note `email` and singular `role`. */
export interface AdminUser {
  userId: string;
  userName: string;
  email: string;
  role: string[];
  emailConfirmed: boolean;
  isLockedOut: boolean;
}

/** `create-user` request. Uses `emailAddress`, not `email`. */
export interface CreateUserRequest {
  username: string;
  emailAddress: string;
  firstName: string;
  lastName: string;
}

/**
 * Returns a *relative* setup link, not a full URL, so the backend must prefix
 * the frontend origin before emailing it. The token carries no email, which is
 * why `/set-password` also asks for the address.
 */
export interface CreateUserData {
  setupLink: string;
}

export type CreateUserResponse = ApiEnvelope<CreateUserData>;

/** As returned by `get_all_roles`. */
export interface RoleOption {
  roleId: string;
  roleName: string;
}

export type GetAllRolesResponse = ApiEnvelope<RoleOption[]>;

export type GetAllUsersResponse = ApiEnvelope<AdminUser[]>;

/** `assign_role` (PUT) request. */
export interface AssignRoleRequest {
  userId: string;
  roleId: string;
}

/** `remove_user_role` (DELETE) takes the identical body as `assign_role`. */
export type RemoveUserRoleRequest = AssignRoleRequest;

/** `GET {userId}/get-user&roles` returns bare role names, not user objects. */
export type GetUserRolesResponse = ApiEnvelope<string[]>;

/** `assign_role` and `remove_user_role` both return `data: null`. */
export type EmptyDataResponse = ApiEnvelope<null>;
