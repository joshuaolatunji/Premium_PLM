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

// Decodes the stored JWT's payload (the middle, base64url-encoded segment).
// Returns null if there's no token or it can't be decoded.
function readTokenClaims(): Record<string, unknown> | null {
    const token = getToken();

    if (!token) {
        return null;
    }

    try {
        const payload = token.split(".")[1];
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const claims: unknown = JSON.parse(atob(padded));

        return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function getCurrentUserId(): string | null {
    const userId = readTokenClaims()?.[NAME_IDENTIFIER_CLAIM];

    return typeof userId === "string" ? userId : null;
}

// When the session's token expires, as a millisecond timestamp. Read from
// the JWT's standard `exp` claim (seconds since epoch) — present on every
// token this API issues, and the same instant as the login response's
// `expiresAt`. Null if there's no readable token.
export function getSessionExpiry(): number | null {
    const exp = readTokenClaims()?.exp;

    return typeof exp === "number" ? exp * 1000 : null;
}

// True only while there's a token that hasn't expired yet. Checked on the
// client so an expired session sends the user to login right away, rather
// than depending on the server answering with a 401 (which never arrives
// if the request itself fails, e.g. the API is briefly unreachable).
export function hasValidSession(): boolean {
    const expiry = getSessionExpiry();

    return expiry !== null && expiry > Date.now();
}