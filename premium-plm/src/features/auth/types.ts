import type { ApiEnvelope } from "@/lib/api/envelope";

export interface LoginRequest {
  emailAddress: string;
  password: string;
}

export interface LoginData {
  token: string;
  expiresAt: string;
  userName: string;
  email: string;
  roles: string[];
}

export type LoginResponse = ApiEnvelope<LoginData>;

/**
 * `emailAddress` is required even though the setup link carries only a token —
 * the token is an opaque digest the backend cannot reverse into an address.
 */
export interface SetPasswordRequest {
  emailAddress: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** No email: identity comes from the bearer token. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangeTemporaryPasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * SECURITY: no verification code, token, or current password — knowing an email
 * address is enough to set that account's password. Typed for completeness and
 * never called; "Forgot password?" stays inert until the backend verifies.
 */
export interface AutoResetPasswordRequest {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

/** Every password mutation returns `data: null`. */
export type PasswordMutationResponse = ApiEnvelope<null>;

/** @deprecated Prefer {@link PasswordMutationResponse}. */
export type ChangeTemporaryPasswordResponse = PasswordMutationResponse;
