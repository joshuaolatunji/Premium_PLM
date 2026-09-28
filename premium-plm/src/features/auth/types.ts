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
 * Invited-user flow. `emailAddress` is required even though the setup link
 * carries only a token — the token is an opaque SHA-256 digest and the backend
 * has no way to recover the address from it.
 */
export interface SetPasswordRequest {
  emailAddress: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Authenticated self-service change. No email: identity comes from the bearer
 * token. The API responds "Please log in again", so callers must drop the
 * session.
 */
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
 * SECURITY: this endpoint takes no verification code, token, or current
 * password — only an email and the new credentials. Anyone who knows a
 * colleague's address could set their password. Exposed here for contract
 * completeness and deliberately not called from any UI; the "Forgot
 * password?" button on the login page stays inert until the backend adds
 * email verification.
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
