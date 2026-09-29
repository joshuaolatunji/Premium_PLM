const TOKEN_KEY = "premiumplm_token";
const USER_KEY = "premiumplm_user";

export interface StoredUser {
    userName: string;
    email: string;
    roles: string[];
}

export function saveAuthSession(
    token: string,
    user: StoredUser,
) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
   return sessionStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): StoredUser | null {
    const user = sessionStorage.getItem(USER_KEY);

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
}

export function clearAuthSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
}

// The login response doesn't include the user's own id (only userName,
// email, roles), but the JWT payload does — as a WS-Identity claim URI, per
// real tokens we've decoded from this API. Used wherever a mock feature
// needs to know "who am I" by id (e.g. "initiatives assigned to me as
// BDO") rather than by email/username.
const NAME_IDENTIFIER_CLAIM =
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

export function getCurrentUserId(): string | null {
    const token = getToken();

    if (!token) {
        return null;
    }

    try {
        const payload = token.split(".")[1];
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const claims = JSON.parse(atob(padded));

        return typeof claims[NAME_IDENTIFIER_CLAIM] === "string"
            ? claims[NAME_IDENTIFIER_CLAIM]
            : null;
    } catch {
        return null;
    }
}