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