import { apiClient } from "../../services/apiClient";
import type {
    LoginRequest,
    LoginResponse,
} from "./types";

export function loginUser(
    credentials: LoginRequest,
): Promise<LoginResponse> {
    return apiClient<LoginResponse>("/api/PLMAuth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
});
}

export interface ChangeTemporaryPasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function changeTemporaryPassword(
  data: ChangeTemporaryPasswordRequest,
) {
  return apiClient("/api/PLMAuth/change-temporary-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}