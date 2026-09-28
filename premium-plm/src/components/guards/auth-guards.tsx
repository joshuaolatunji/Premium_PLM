import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Gate for authenticated routes. Redirects to `/login` and remembers where the
 * user was headed, so login can return them there.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/**
 * Inverse guard: keeps a signed-in user off `/login`.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
