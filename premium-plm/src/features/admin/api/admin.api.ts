import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { unwrap } from "@/lib/api/envelope";

import type {
  AdminUser,
  AssignRoleRequest,
  CreateUserData,
  CreateUserRequest,
  CreateUserResponse,
  EmptyDataResponse,
  GetAllRolesResponse,
  GetAllUsersResponse,
  GetUserRolesResponse,
  RemoveUserRoleRequest,
  RoleOption,
} from "../types";

/**
 * The only module that knows the `PLMAdmin` surface. Every call here is
 * authenticated — these endpoints are not reachable before sign-in, so the
 * client uses the authenticated GET and the default-authenticated mutations.
 *
 * There is no admin UI yet, so nothing imports these. They are typed against the
 * documented contract and ready for the Users screen.
 */

/** `GET /api/PLMAdmin/get_all_users` */
export async function getAllUsers(
  options?: { signal?: AbortSignal },
): Promise<AdminUser[]> {
  const response = await apiClient.getAuthenticated<GetAllUsersResponse>(
    endpoints.admin.getAllUsers,
    options,
  );

  return unwrap<AdminUser[]>(response);
}

/** `GET /api/PLMAdmin/get_all_roles` */
export async function getAllRoles(
  options?: { signal?: AbortSignal },
): Promise<RoleOption[]> {
  const response = await apiClient.getAuthenticated<GetAllRolesResponse>(
    endpoints.admin.getAllRoles,
    options,
  );

  return unwrap<RoleOption[]>(response);
}

/**
 * `GET /api/PLMAdmin/{userId}/get-user&roles`
 *
 * Resolves to bare role names (`["ProjectManager", ...]`), unlike
 * `getAllUsers` which embeds roles on the user record.
 */
export async function getUserRoles(
  userId: string,
  options?: { signal?: AbortSignal },
): Promise<string[]> {
  const response = await apiClient.getAuthenticated<GetUserRolesResponse>(
    endpoints.admin.getUserRoles(userId),
    options,
  );

  return unwrap<string[]>(response);
}

/**
 * `POST /api/PLMAdmin/create-user`
 *
 * Returns the relative setup link to email to the new user. No role is
 * assigned here — that is a separate `assignRole` call.
 */
export async function createUser(
  payload: CreateUserRequest,
): Promise<CreateUserData> {
  const response = await apiClient.post<CreateUserResponse>(
    endpoints.admin.createUser,
    payload,
  );

  return unwrap<CreateUserData>(response);
}

/** `PUT /api/PLMAdmin/assign_role` */
export async function assignRole(payload: AssignRoleRequest): Promise<void> {
  await apiClient.put<EmptyDataResponse>(endpoints.admin.assignRole, payload);
}

/** `DELETE /api/PLMAdmin/remove_user_role` — sent as a request body. */
export async function removeUserRole(
  payload: RemoveUserRoleRequest,
): Promise<void> {
  await apiClient.delete<EmptyDataResponse>(
    endpoints.admin.removeUserRole,
    payload,
  );
}
