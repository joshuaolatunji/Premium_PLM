import type { ReactNode } from "react";

interface ReadOnlyFieldProps {
  label: string;
  // Text, or something richer such as a status badge.
  value: ReactNode;
}

// A filled-in form field, read-only: a bold label over its value in a box.
// The look for every completed form (documents, the BDO documentation,
// tickets, tasks). The box grows with its text, so nothing is cut off.
function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  const isEmpty = value === null || value === undefined || value === "";

  return (
    <div className="brd-readonly-field">
      <span className="brd-readonly-field_label">{label}</span>
      <div className="brd-readonly-field_value">{isEmpty ? "—" : value}</div>
    </div>
  );
}

export default ReadOnlyField;
