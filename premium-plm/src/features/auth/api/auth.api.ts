import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { unwrap } from "@/lib/api/envelope";
import {
  clearSession,
  saveSession,
} from "@/features/auth/store/session";

import type {
  AutoResetPasswordRequest,
  ChangePasswordRequest,
  ChangeTemporaryPasswordRequest,
  LoginData,
  LoginRequest,
  LoginResponse,
  PasswordMutationResponse,
  SetPasswordRequest,
} from "../types";

/**
 * The only module that knows auth endpoint paths or the shape of the login
 * response. Persisting the session is a side effect of signing in, which keeps
 * every caller from having to remember to do it.
 */
export async function signIn(credentials: LoginRequest): Promise<LoginData> {
  const response = await apiClient.post<LoginResponse>(
    endpoints.auth.login,
    credentials,
    { authenticated: false },
  );

  const data = unwrap<LoginData>(response);

  saveSession(data.token, {
    userName: data.userName,
    email: data.email,
    roles: data.roles,
  });

  return data;
}

/**
 * `POST /api/PLMAuth/set-password` — the invited-user flow reached from the
 * link in the welcome email. Public: the user has no password yet.
 *
 * The token comes from the `?token=` query parameter and is the only proof the
 * caller is the invited user.
 */
export async function setPassword(payload: SetPasswordRequest): Promise<void> {
  await apiClient.post<PasswordMutationResponse>(
    endpoints.auth.setPassword,
    payload,
    { authenticated: false },
  );
}

/**
 * `POST /api/PLMAuth/change-temporary-password` — forces a new password for a
 * user whose current one is temporary. Public, and identified by email plus the
 * temporary password itself.
 */
export async function changeTemporaryPassword(
  payload: ChangeTemporaryPasswordRequest,
): Promise<void> {
  await apiClient.post<PasswordMutationResponse>(
    endpoints.auth.changeTemporaryPassword,
    payload,
    { authenticated: false },
  );
}

/**
 * `POST /api/PLMAuth/change-Password` — ordinary authenticated change.
 *
 * The API answers "Password changed successfully. Please log in again", and the
 * existing token stays valid until it expires, so the session is dropped here
 * rather than leaving a stale one behind.
 */
export async function changePassword(
  payload: ChangePasswordRequest,
): Promise<void> {
  await apiClient.post<PasswordMutationResponse>(
    endpoints.auth.changePassword,
    payload,
  );

  clearSession();
}

/**
 * `POST /api/PLMAuth/autoreset-password` — NOT WIRED TO ANY UI.
 *
 * Deliberately has no caller. The endpoint accepts an email and a new password
 * with no verification code, token, or current password, so exposing it would
 * let anyone reset any account whose address they know. Kept here so the
 * contract is documented and typed; remove it or add backend verification
 * before calling it.
 */
export async function autoResetPassword(
  payload: AutoResetPasswordRequest,
): Promise<void> {
  await apiClient.post<PasswordMutationResponse>(
    endpoints.auth.autoResetPassword,
    payload,
    { authenticated: false },
  );
}
