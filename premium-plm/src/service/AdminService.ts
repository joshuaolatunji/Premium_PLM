import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type {
  AssignRoleRequest,
  CreateUserRequest,
  PLMRole,
  RemoveRoleRequest,
} from "../types/adminTypes";

// Response has no documented content schema (just "OK") — same pattern as
// updateProposal/reviewProposal, treated as a void action.
export async function createUser(payload: CreateUserRequest): Promise<void> {
  const token = getToken();

  await apiClient<unknown>("api/PLMAdmin/create-user", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

// Roles the API lists but that should never be given to anyone. "NewUser"
// is meaningless: a role is always chosen when the account is created.
const UNASSIGNABLE_ROLES = ["NewUser"];

export async function getAllRoles(): Promise<PLMRole[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<PLMRole[]>>(
    "api/PLMAdmin/get_all_roles",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data.filter((role) => !UNASSIGNABLE_ROLES.includes(role.roleName ?? ""));
}

export async function assignRole(payload: AssignRoleRequest): Promise<void> {
  const token = getToken();

  await apiClient<unknown>("api/PLMAdmin/assign_role", {
    method: "PUT",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

export async function removeUserRole(payload: RemoveRoleRequest): Promise<void> {
  const token = getToken();

  await apiClient<unknown>("api/PLMAdmin/remove_user_role", {
    method: "DELETE",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

export async function activateUser(userId: string): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/PLMAdmin/users/${userId}/activate-user`, {
    method: "PUT",
    token: token ?? undefined,
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/PLMAdmin/users/${userId}/deactivate-user`, {
    method: "PUT",
    token: token ?? undefined,
  });
}
