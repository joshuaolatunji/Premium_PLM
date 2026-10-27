// Login only gives us `userName` verbatim as stored on the account (e.g.
// "josh", "SuperAdmin") — this is purely a display nicety, not a claim
// about what the "real" name is.
export function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

// A person's full name: "First Last" when the API sends them (gaps file
// M22), otherwise the user name split on . _ - and spaces and title-cased
// ("satar.bello" → "Satar Bello").
export function formatPersonName(user: {
  userName: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const source = fromParts || user.userName || "";

  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => capitalize(part.toLowerCase()))
    .join(" ");
}

// Role identity strings from the API are PascalCase with no spaces (e.g.
// "BusinessDevelopmentOfficer") — this inserts a space before each
// capital letter for display.
//
// The backend's "ProjectManager" role is now called "Product Manager" in
// the business, so it's shown under that name; the identifier itself is
// unchanged on the API. Likewise the API's "Executives" role is the
// Executive Director.
export function formatRoleName(role: string): string {
  if (role === "ProjectManager") {
    return "Product Manager";
  }

  if (role === "Executives") {
    return "Executive Director";
  }

  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// The reverse of formatRoleName: "Risk Officer" → "RiskOfficer",
// "Executive Director" → "Executives". The API expects its own role names.
export function toApiRoleName(role: string): string {
  if (role === "Product Manager") {
    return "ProjectManager";
  }

  if (role === "Executive Director") {
    return "Executives";
  }

  return role.replace(/\s+/g, "");
}
