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

/** Public: reached from the invitation link, before the user has a password. */
export async function setPassword(payload: SetPasswordRequest): Promise<void> {
  await apiClient.post<PasswordMutationResponse>(
    endpoints.auth.setPassword,
    payload,
    { authenticated: false },
  );
}

/** Public: identified by email plus the temporary password itself. */
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
 * The API answers "please log in again" and the old token stays valid until it
 * expires, so the session is dropped rather than left stale.
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
 * `autoreset-password` — NOT WIRED TO ANY UI. It accepts an email and a new
 * password with no verification code, token, or current password, so calling it
 * would let anyone reset any account whose address they know.
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
