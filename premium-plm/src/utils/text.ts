// Login only gives us `userName` verbatim as stored on the account (e.g.
// "josh", "SuperAdmin") — this is purely a display nicety, not a claim
// about what the "real" name is.
export function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Role identity strings from the API are PascalCase with no spaces (e.g.
// "BusinessDevelopmentOfficer") — this inserts a space before each
// capital letter for display.
//
// The backend's "ProjectManager" role is now called "Product Manager" in
// the business, so it's shown under that name; the identifier itself is
// unchanged on the API.
export function formatRoleName(role: string): string {
  if (role === "ProjectManager") {
    return "Product Manager";
  }

  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}
