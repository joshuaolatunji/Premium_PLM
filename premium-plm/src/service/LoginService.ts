import { apiClient } from "../apicalls/apiClient";

import { getToken } from "../apicalls/authStorage";

import type {
    ChangePasswordRequest,
    ChangeTemporaryPasswordRequest,
    LoginRequest,
    LoginResponse,
} from "../types/loginTypes";

export function loginUser(
    credentials: LoginRequest,
): Promise<LoginResponse> {
    return apiClient<LoginResponse>("api/PLMAuth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
});
}


export async function changeTemporaryPassword(
  data: ChangeTemporaryPasswordRequest,
) {
  return apiClient("api/PLMAuth/change-temporary-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Self-service password change for an already-logged-in user (distinct
// from the admin-only autoreset-password and the one-time
// change-temporary-password flows above).
export async function changePassword(data: ChangePasswordRequest) {
  const token = getToken();

  return apiClient("api/PLMAuth/change-Password", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(data),
  });
}