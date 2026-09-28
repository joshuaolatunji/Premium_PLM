import { useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { FormField } from "@/features/auth/components/form-field";
import { PasswordField } from "@/features/auth/components/password-field";
import { useApiHealth } from "@/lib/hooks/useApiHealth";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { EMAIL_PATTERN } from "@/features/auth/lib/validation";

interface LocationState {
  from?: string;
  /** Set by `/set-password` on success. */
  passwordSet?: boolean;
  /** Set by `/change-temporary-password` on success. */
  passwordChanged?: boolean;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { from, passwordSet, passwordChanged } = (location.state ??
    {}) as LocationState;

  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");

  const { status: apiStatus } = useApiHealth();

  const { isSubmitting, errorMessage, submit } = useLogin(() => {
    navigate(from ?? "/", { replace: true });
  });

  /*
   * The form sets `noValidate`, so the browser will not block an empty submit.
   * The button is gated here instead: the email must be well-formed and the
   * password must be non-empty, matching the server's own requirements so a
   * pointless round-trip never leaves the page.
   */
  const isEmailValid = EMAIL_PATTERN.test(emailAddress.trim());
  const isPasswordPresent = password.length > 0;
  const canSubmit = isEmailValid && isPasswordPresent && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await submit({ emailAddress: emailAddress.trim(), password });
  }

  const successMessage = passwordSet
    ? "Your password has been set. Sign in with it now."
    : passwordChanged
      ? "Your password has been changed. Sign in with your new password."
      : null;

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Sign in to Premium PLM
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Use your Premium Trust Bank network credentials.
        </p>
      </header>

      {successMessage ? (
        <Alert
          role="status"
          className="mb-5 border-success/25 bg-success-soft text-success-text"
        >
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

          {/*
            Only a genuine transport failure warrants the "cannot reach"
            message. A 4xx/5xx probe still means the API is responding, so
            those are reported as degraded and left out of the banner.
          */}
          {apiStatus === "unreachable" ? (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>
                We cannot reach the Premium PLM service. It may still be
                starting up — please wait a moment and try again.
              </AlertDescription>
            </Alert>
          ) : null}

          {apiStatus === "degraded" ? (
            <Alert className="mb-5">
              <AlertDescription>
                The Premium PLM service responded unexpectedly. You can still
                try to sign in, but report it if sign-in fails.
              </AlertDescription>
            </Alert>
          ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-5">
          <FormField
            id={emailId}
            label="Email address"
            type="email"
            autoComplete="username"
            placeholder="name@premiumtrustbank.com"
            value={emailAddress}
            onChange={setEmailAddress}
            describedBy={errorMessage ? errorId : undefined}
            required
          />

          <PasswordField
            id={passwordId}
            label="Password"
            describedBy={errorMessage ? errorId : undefined}
            autoComplete="current-password"
            placeholder="••••••••••"
            value={password}
            onChange={setPassword}
            labelContent={
              <div className="flex items-center justify-between">
                <label
                  htmlFor={passwordId}
                  className="text-xs font-medium leading-none"
                >
                  Password
                </label>

                {/*
                  Intentionally inert. `PLMAuth/autoreset-password` accepts an
                  email plus a new password with no verification code or token,
                  so wiring this up as-is would let anyone reset any account
                  whose address they know. Revisit once the backend verifies
                  the requester owns the mailbox.
                */}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  disabled
                  className="h-auto p-0 text-xs text-muted-foreground"
                >
                  Forgot password?
                </Button>
              </div>
            }
            required
          />

          {errorMessage ? (
            <Alert variant="destructive" id={errorId} role="alert">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="mt-3 h-10 w-full"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>

      <p className="mt-6 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
        Access is granted by role. If your role or department has changed,
        contact the Premium PLM administrator.
      </p>
    </AuthLayout>
  );
}
