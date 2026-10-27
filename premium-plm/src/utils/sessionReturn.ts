import { getStoredUser } from "../apicalls/authStorage";

// When a session expires, the page the user was on is remembered so that
// signing back in returns them there instead of to their dashboard. Kept in
// sessionStorage (this tab only) and tied to the signed-in email, so a
// different person signing in on the same tab starts on their own dashboard.
// Must be called BEFORE clearAuthSession(), while the user is still known.

const RETURN_KEY = "plm-return-to";

interface ReturnTo {
  path: string;
  email: string;
}

export function rememberReturnPath() {
  const email = getStoredUser()?.email;
  const path = `${window.location.pathname}${window.location.search}`;

  if (!email || !path.startsWith("/dashboard")) {
    return;
  }

  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, email } satisfies ReturnTo));
  } catch {
    // Not remembered — they'll land on their dashboard instead.
  }
}

function readReturnTo(): ReturnTo | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    return raw ? (JSON.parse(raw) as ReturnTo) : null;
  } catch {
    return null;
  }
}

// True when the user was just signed out by an expired session — the login
// page uses it to explain why they're there.
export function wasSignedOutByExpiry(): boolean {
  return readReturnTo() !== null;
}

// The page to go back to after signing in as `email` (used once, then
// forgotten), or null to use the normal landing page.
export function takeReturnPath(email: string): string | null {
  const saved = readReturnTo();

  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clean up.
  }

  if (!saved || saved.email.toLowerCase() !== email.toLowerCase()) {
    return null;
  }

  return saved.path;
}
