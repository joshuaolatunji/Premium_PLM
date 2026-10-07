import { useState, type InputHTMLAttributes } from "react";

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
}

// Keeps the text being typed separate from the stored number, so clearing
// the field leaves it empty instead of snapping back to "0" and prefixing
// the next digit.
function NumberInput({ value, onValueChange, onFocus, onBlur, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="number"
      value={draft ?? String(value)}
      onFocus={(event) => {
        setDraft(String(value));
        event.target.select();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);

        if (event.target.value !== "") {
          onValueChange(Number(event.target.value));
        }
      }}
    />
  );
}

export default NumberInput;
