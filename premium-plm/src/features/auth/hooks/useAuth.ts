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
 * Session read via the store rather than context: the API client reads the token
 * imperatively and route guards need to observe it, so a provider would add
 * nothing.
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
