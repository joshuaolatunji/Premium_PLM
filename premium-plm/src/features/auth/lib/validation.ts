/**
 * Shared by the auth screens so they cannot drift. Feedback only — the backend
 * stays the source of truth and its messages win. Min length is 8; complexity
 * is not enforced because the policy is undocumented.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Permissive on purpose — only the shape the API needs. Exported so the login
 * button's disabled state and `validateEmail` cannot disagree.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string, label = "email address"): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return `Enter the ${label}.`;
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }

  return "";
}

export function validateRequired(
  value: string,
  message: string,
): string {
  return value.trim() ? "" : message;
}

export function validateNewPassword(value: string): string {
  if (!value.trim()) {
    return "Enter a new password.";
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return "";
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string {
  if (!confirmation.trim()) {
    return "Confirm your new password.";
  }

  if (password !== confirmation) {
    return "Passwords do not match.";
  }

  return "";
}

/** @returns errors keyed by field, or `null` when both are valid. */
export function validatePasswordPair(
  password: string,
  confirmation: string,
): { newPassword: string; confirmPassword: string } | null {
  const errors = {
    newPassword: validateNewPassword(password),
    confirmPassword: validatePasswordConfirmation(password, confirmation),
  };

  return errors.newPassword || errors.confirmPassword ? errors : null;
}
