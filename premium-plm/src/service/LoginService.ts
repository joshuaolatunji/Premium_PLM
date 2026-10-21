import { apiClient } from "../apicalls/apiClient";

import { getToken } from "../apicalls/authStorage";

import type {
    ChangePasswordRequest,
    ChangeTemporaryPasswordRequest,
    LoginRequest,
    LoginResponse,
} from "../types/loginTypes";

// The login endpoint now requires an `ipAddress` query param (it 400s
// without one). The browser can't reliably know its own public IP, and the
// backend is expected to capture the real one itself eventually — until
// then, every login sends this fixed placeholder for testing.
const LOGIN_IP_ADDRESS = "127.0.0.1";

export function loginUser(
    credentials: LoginRequest,
): Promise<LoginResponse> {
    const query = new URLSearchParams({ ipAddress: LOGIN_IP_ADDRESS });

    return apiClient<LoginResponse>(`api/PLMAuth/login?${query}`, {
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