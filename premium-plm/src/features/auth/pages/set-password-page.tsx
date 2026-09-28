import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setPassword } from "@/features/auth/api/auth.api";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { FormField } from "@/features/auth/components/form-field";
import { PasswordField } from "@/features/auth/components/password-field";
import {
  validateEmail,
  validatePasswordPair,
} from "@/features/auth/lib/validation";

interface FieldErrors {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

const NO_ERRORS: FieldErrors = {
  email: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * Opened from the setup link in `create-user`. The token is an opaque digest, so
 * the email must be typed too. It is read once, then stripped from the URL.
 */
export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [token] = useState(() => searchParams.get("token") ?? "");
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");

  const ids = {
    email: useId(),
    newPassword: useId(),
    confirmPassword: useId(),
  };

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!searchParams.has("token")) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("token");

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // No token means the link is malformed or was stripped by a mail client.
  // Rendering the form anyway would only produce a guaranteed failure.
  if (!token) {
    return (
      <AuthLayout>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            This link is no longer valid
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            The setup link is missing its security token. Ask your Premium PLM
            administrator to send a new invitation.
          </p>
        </header>

        <Alert variant="destructive" role="alert">
          <AlertTitle>Setup link invalid</AlertTitle>
          <AlertDescription>
            Links can expire or be used only once. If you have already set a
            password, sign in instead.
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          variant="outline"
          className="mt-6 h-10 w-full"
          onClick={() => navigate("/login", { replace: true })}
        >
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  function validate(): boolean {
    const pairErrors = validatePasswordPair(newPassword, confirmPassword);

    const errors: FieldErrors = {
      email: validateEmail(email),
      newPassword: pairErrors?.newPassword ?? "",
      confirmPassword: pairErrors?.confirmPassword ?? "",
    };

    setFieldErrors(errors);

    return !Object.values(errors).some(Boolean);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await setPassword({
        emailAddress: email.trim(),
        token,
        newPassword,
        confirmPassword,
      });

      navigate("/login", { replace: true, state: { passwordSet: true } });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to set your password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Set your password
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Choose a password for your Premium PLM account, then sign in with it.
        </p>
      </header>

      {formError ? (
        <Alert variant="destructive" role="alert" className="mb-5">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-5">
          <FormField
            id={ids.email}
            label="Email address"
            type="email"
            autoComplete="username"
            placeholder="name@premiumtrustbank.com"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
            inputClassName="h-10"
            required
          />

          <PasswordField
            id={ids.newPassword}
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            error={fieldErrors.newPassword}
            inputClassName="h-10"
            required
          />

          <PasswordField
            id={ids.confirmPassword}
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
            inputClassName="h-10"
            required
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 h-10 w-full"
          >
            {isSubmitting ? "Setting password…" : "Set password"}
          </Button>
        </div>
      </form>

      <p className="mt-6 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
        This link works once. If it has expired, ask your administrator to send
        another invitation.
      </p>
    </AuthLayout>
  );
}
