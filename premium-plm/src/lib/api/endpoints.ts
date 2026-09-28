/**
 * Every API path in the app. No other file should hold a URL literal. Casing
 * (`change-Password`) and the `&` in `get-user&roles` are transcribed from the
 * docs so these stay greppable against the backend.
 */
export const endpoints = {
  health: "/api/health",

  auth: {
    login: "/api/PLMAuth/login",
    /** Invited-user flow; `create-user` emails a relative `?token=` link. */
    setPassword: "/api/PLMAuth/set-password",
    /** Authenticated: identity comes from the bearer token. */
    changePassword: "/api/PLMAuth/change-Password",
    changeTemporaryPassword: "/api/PLMAuth/change-temporary-password",
    /**
     * SECURITY: no verification code or token, so knowing an email address is
     * enough to set that account's password. Not wired to any UI.
     */
    autoResetPassword: "/api/PLMAuth/autoreset-password",
  },

  admin: {
    createUser: "/api/PLMAdmin/create-user",
    getAllUsers: "/api/PLMAdmin/get_all_users",
    getAllRoles: "/api/PLMAdmin/get_all_roles",
    assignRole: "/api/PLMAdmin/assign_role",
    /** DELETE with a request body. */
    removeUserRole: "/api/PLMAdmin/remove_user_role",
    /** The `&` is part of the route segment, so it stays unencoded. */
    getUserRoles: (userId: string) =>
      `/api/PLMAdmin/${encodeURIComponent(userId)}/get-user&roles`,
  },

  /** Unverified — not in the confirmed API surface. Check before wiring up. */
  initiatives: {
    list: "/api/product-initiatives",
  },
} as const;

export type Endpoints = typeof endpoints;
