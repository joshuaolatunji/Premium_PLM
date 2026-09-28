import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { FormField, type FormFieldProps } from "@/features/auth/components/form-field";

export type PasswordFieldProps = Omit<FormFieldProps, "type" | "trailing">;

/**
 * A password input with a show/hide toggle.
 *
 * Composes {@link FormField} so the aria wiring stays in one place. Used by
 * every password screen, which is why the toggle logic is not repeated per page.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const toggleId = useId();

  return (
    <FormField
      {...props}
      type={isVisible ? "text" : "password"}
      inputClassName={cn("pr-20", props.inputClassName)}
      trailing={
        <Button
          id={toggleId}
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setIsVisible((current) => !current)}
          aria-pressed={isVisible}
          aria-controls={props.id}
          className="text-muted-foreground"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" />
          ) : (
            <Eye aria-hidden="true" />
          )}

          {isVisible ? "Hide" : "Show"}

          <span className="sr-only">password</span>
        </Button>
      }
    />
  );
}
