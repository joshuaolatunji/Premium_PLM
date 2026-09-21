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