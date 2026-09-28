/**
 * Every API path in the app lives here. No other file should contain a URL
 * string literal.
 *
 * Paths are transcribed exactly as the API documents them, including the
 * capital `P` in `change-Password` and the literal `&` in `get-user&roles`.
 * ASP.NET routing is case-insensitive so the casing would work either way, but
 * keeping the documented form makes these greppable against the backend.
 */
export const endpoints = {
  health: "/api/health",

  auth: {
    login: "/api/PLMAuth/login",
    /**
     * Invited-user flow. `create-user` hands out a relative setup link
     * (`/set-password?token=...`) which the backend emails; the token is a
     * SHA-256 digest and carries no identity, so the page also collects
     * `emailAddress`.
     */
    setPassword: "/api/PLMAuth/set-password",
    /** Authenticated: identity comes from the bearer token, no email needed. */
    changePassword: "/api/PLMAuth/change-Password",
    changeTemporaryPassword: "/api/PLMAuth/change-temporary-password",
    /**
     * SECURITY: accepts `{ email, newPassword, confirmPassword }` with no
     * verification code or token, so anyone who knows a colleague's email
     * address could set that account's password. Present for contract
     * completeness only — deliberately not wired to any UI.
     */
    autoResetPassword: "/api/PLMAuth/autoreset-password",
  },

  admin: {
    createUser: "/api/PLMAdmin/create-user",
    getAllUsers: "/api/PLMAdmin/get_all_users",
    getAllRoles: "/api/PLMAdmin/get_all_roles",
    assignRole: "/api/PLMAdmin/assign_role",
    /** DELETE with a request body — the client supports both. */
    removeUserRole: "/api/PLMAdmin/remove_user_role",
    /**
     * The `&` is part of the route segment, not a query separator, so it is
     * left unencoded.
     */
    getUserRoles: (userId: string) =>
      `/api/PLMAdmin/${encodeURIComponent(userId)}/get-user&roles`,
  },

  /**
   * Not part of the verified API surface — carried over from the original
   * codebase and still referenced only from the dashboard repository notes.
   * Confirm against the backend before wiring anything to it.
   */
  initiatives: {
    list: "/api/product-initiatives",
  },
} as const;

export type Endpoints = typeof endpoints;
