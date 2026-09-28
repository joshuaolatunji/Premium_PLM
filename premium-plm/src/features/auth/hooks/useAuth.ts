import { useCallback, useSyncExternalStore } from "react";

import {
  clearSession,
  getSessionUser,
  getToken,
  subscribeToSession,
  type SessionUser,
} from "@/features/auth/store/session";

export interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** Primary role for display, or a neutral placeholder. */
  role: string;
  signOut: () => void;
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Single entry point for reading the current session.
 *
 * Backed by the store's subscription rather than React context: the session
 * lives in `sessionStorage`, is read imperatively by the API client, and needs
 * to be observable from route guards — none of which benefit from a provider.
 */
export function useAuth(): AuthState {
  const user = useSyncExternalStore(
    subscribeToSession,
    getSessionUser,
    getServerSnapshot,
  );

  const isAuthenticated = useSyncExternalStore(
    subscribeToSession,
    () => getToken() !== null,
    () => false,
  );

  const signOut = useCallback(() => {
    clearSession();
  }, []);

  return {
    user,
    isAuthenticated,
    role: user?.roles?.[0] ?? "—",
    signOut,
  };
}
