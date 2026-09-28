/**
 * Form validation rules shared by the auth screens, so the login, set-password
 * and change-password pages cannot drift apart.
 *
 * These checks exist to give immediate feedback, not to gate: the backend stays
 * the source of truth and its messages win. Minimum password length is 8;
 * complexity is deliberately not enforced here because the policy is not
 * documented, and a stricter server rule will surface as a form error.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Deliberately permissive — checks only for the shape the API needs, so a valid
 * but unusual address is not blocked client-side.
 *
 * Exported so the login button's enable/disable state and {@link validateEmail}
 * cannot disagree about what counts as a filled, valid field.
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

/**
 * Validates a new-password / confirm-password pair.
 *
 * @returns errors keyed by field name, or `null` when both are valid so callers
 *   can branch on truthiness.
 */
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
