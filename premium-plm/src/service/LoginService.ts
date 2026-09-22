import { apiClient } from "../apicalls/apiClient";

import type {
    ChangeTemporaryPasswordRequest,
    LoginRequest,
    LoginResponse,
} from "../types/loginTypes";

export function loginUser(
    credentials: LoginRequest,
)/*: Promise<LoginResponse>*/ {
    return apiClient<LoginResponse>("api/PLMAuth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
});
}


export async function changeTemporaryPassword(
  data: ChangeTemporaryPasswordRequest,
) {
  return apiClient("/api/PLMAuth/change-temporary-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}