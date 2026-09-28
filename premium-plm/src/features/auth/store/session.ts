const TOKEN_KEY = "premiumplm_token";
const USER_KEY = "premiumplm_user";

export interface SessionUser {
  userName: string;
  email: string;
  roles: string[];
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.userName === "string" &&
    typeof candidate.email === "string" &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every((role) => typeof role === "string")
  );
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                      */
/* -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

let cachedUser: SessionUser | null | undefined;

/** Read-through cache so `useSyncExternalStore` keeps a stable snapshot. */
function readUser(): SessionUser | null {
  if (cachedUser === undefined) {
    const raw = sessionStorage.getItem(USER_KEY);

    if (!raw) {
      cachedUser = null;
    } else {
      try {
        const parsed: unknown = JSON.parse(raw);

        cachedUser = isSessionUser(parsed) ? parsed : null;
      } catch {
        cachedUser = null;
      }
    }
  }

  return cachedUser;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Reads the stored user, discarding anything that fails validation. Previously
 * this returned whatever `JSON.parse` produced, so a corrupted entry flowed
 * straight into the UI unchecked.
 */
export function getSessionUser(): SessionUser | null {
  return readUser();
}

export function hasSession(): boolean {
  return getToken() !== null;
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                     */
/* -------------------------------------------------------------------------- */

export function saveSession(token: string, user: SessionUser): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));

  cachedUser = user;

  emit();
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);

  cachedUser = null;

  emit();
}

/**
 * Tells the store the underlying storage may have changed without going through
 * `saveSession` / `clearSession` — e.g. a second tab logging out.
 */
export function refreshSession(): void {
  cachedUser = undefined;

  emit();
}

export { subscribe as subscribeToSession };
