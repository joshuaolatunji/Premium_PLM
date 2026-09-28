import { useCallback, useState } from "react";

import { signIn } from "@/features/auth/api/auth.api";

export interface LoginCredentials {
  emailAddress: string;
  password: string;
}

export interface LoginState {
  isSubmitting: boolean;
  errorMessage: string;
  /** Resolves `true` when the session was established. */
  submit: (credentials: LoginCredentials) => Promise<boolean>;
  reset: () => void;
}

/**
 * Owns the login request lifecycle so `LoginPage` stays a rendering concern.
 */
export function useLogin(onSuccess: () => void): LoginState {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submit = useCallback(
    async (credentials: LoginCredentials) => {
      setErrorMessage("");
      setIsSubmitting(true);

      try {
        await signIn(credentials);

        onSuccess();

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to sign in. Please try again.",
        );

        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess],
  );

  const reset = useCallback(() => setErrorMessage(""), []);

  return { isSubmitting, errorMessage, submit, reset };
}
