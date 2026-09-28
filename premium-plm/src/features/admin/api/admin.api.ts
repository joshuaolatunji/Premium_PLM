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
 * The only module that knows the `PLMAdmin` surface. All authenticated. No admin
 * UI yet, so nothing imports these — they are typed and ready for that screen.
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

/** Resolves to bare role names, unlike `getAllUsers` which embeds them. */
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

/** Returns the setup link to email the user. Roles are assigned separately. */
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
