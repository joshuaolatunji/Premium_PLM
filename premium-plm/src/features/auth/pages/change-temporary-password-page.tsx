import { useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/features/auth/components/form-field";
import { PasswordField } from "@/features/auth/components/password-field";
import { changeTemporaryPassword } from "@/features/auth/api/auth.api";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { validateEmail, validatePasswordPair } from "@/features/auth/lib/validation";

interface LocationState {
  email?: string;
}

interface FieldErrors {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const NO_ERRORS: FieldErrors = {
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangeTemporaryPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { email: emailFromLocation = "" } = (location.state ?? {}) as LocationState;

  const ids = {
    email: useId(),
    currentPassword: useId(),
    newPassword: useId(),
    confirmPassword: useId(),
  };

  const [email, setEmail] = useState(emailFromLocation);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const pairErrors = validatePasswordPair(newPassword, confirmPassword);

    const errors: FieldErrors = {
      email: validateEmail(email),
      currentPassword: currentPassword.trim()
        ? ""
        : "Enter your temporary password.",
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
      await changeTemporaryPassword({
        email,
        currentPassword,
        newPassword,
        confirmPassword,
      });

      navigate("/login", {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to change your password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Change your temporary password
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          For security, you need to create a new password before continuing.
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
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
            required
          />

          <PasswordField
            id={ids.currentPassword}
            label="Temporary password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={fieldErrors.currentPassword}
            required
          />

          <PasswordField
            id={ids.newPassword}
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            error={fieldErrors.newPassword}
            required
          />

          <PasswordField
            id={ids.confirmPassword}
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
            required
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 h-10 w-full"
          >
            {isSubmitting ? "Changing password…" : "Change password"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
