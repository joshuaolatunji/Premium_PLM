import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "search";
  error?: string;
  /**
   * Replaces the default `<Label>`, for label rows needing extra furniture. The
   * caller must render its own `<label htmlFor={id}>`; `label` stays required
   * so a field can never render unlabelled.
   */
  labelContent?: ReactNode;
  /**
   * Id of an external element describing this input, for form-level errors
   * rendered as an `Alert` below the form. Ignored when `error` is set.
   */
  describedBy?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Rendered against the input's right edge, e.g. a show/hide toggle. */
  trailing?: ReactNode;
  /** Apply `pr-*` here to make room for `trailing`. */
  inputClassName?: string;
}

/**
 * Label + input + inline error with `aria-invalid` / `aria-describedby` already
 * wired, shared so those attributes cannot differ between screens.
 */
export function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  labelContent,
  describedBy,
  autoComplete,
  placeholder,
  required,
  disabled,
  trailing,
  inputClassName,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {labelContent ?? (
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
      )}

      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : describedBy}
          className={inputClassName}
        />

        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {trailing}
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
