import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type {
  AdminResetPasswordRequest,
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

export async function getAllRoles(): Promise<PLMRole[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<PLMRole[]>>(
    "api/PLMAdmin/get_all_roles",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data;
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

// The Super Admin's "reset an account" action — sets the user's password
// directly (PLMAuth/autoreset-password). There's no separate "reset
// profile" endpoint beyond this.
export async function resetUserPassword(
  payload: AdminResetPasswordRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<unknown>("api/PLMAuth/autoreset-password", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}
