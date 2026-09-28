import type { ApiEnvelope } from "@/lib/api/envelope";

/**
 * DTOs for the `PLMAdmin` surface.
 *
 * Naming is deliberately not normalised across endpoints, because the API is
 * not: `create-user` takes `emailAddress` while `get_all_users` returns `email`,
 * and the user list calls its role field `role` (singular) where the login
 * response uses `roles`. Each type below mirrors one endpoint exactly.
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
 * `create-user` returns a *relative* setup link, e.g.
 * `/set-password?token=<base64url sha256>`, not a full URL. The backend is
 * expected to prefix the frontend origin before emailing it — that part is not
 * verifiable from here.
 *
 * The token is an opaque digest and carries no email, so the `/set-password`
 * page also has to collect the email address from the user.
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

/**
 * `remove_user_role` (DELETE) takes the identical body as `assign_role`, so it
 * is the same shape. Kept as a distinct name to document the two endpoints.
 */
export type RemoveUserRoleRequest = AssignRoleRequest;

/** `GET {userId}/get-user&roles` returns bare role names, not user objects. */
export type GetUserRolesResponse = ApiEnvelope<string[]>;

/** `assign_role` and `remove_user_role` both return `data: null`. */
export type EmptyDataResponse = ApiEnvelope<null>;
