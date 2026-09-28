import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import {
  PublicOnlyRoute,
  RequireAuth,
} from "@/components/guards/auth-guards";
import { RouteError } from "@/components/common/route-error";
import { RouteFallback } from "@/components/common/route-fallback";

const LoginPage = lazy(() => import("@/features/auth/pages/login-page"));
const SetPasswordPage = lazy(
  () => import("@/features/auth/pages/set-password-page"),
);
const ChangeTemporaryPasswordPage = lazy(
  () => import("@/features/auth/pages/change-temporary-password-page"),
);
const DashboardPage = lazy(
  () => import("@/features/dashboard/pages/dashboard-page"),
);
const NotFoundPage = lazy(() => import("@/pages/not-found-page"));

/** Shared wrapper so every lazily-loaded route gets a spinner and a boundary. */
function LazyRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <LazyRoute />,
    errorElement: <RouteError />,
    children: [
      {
        path: "/login",
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        /*
         * Reached from the setup link in a new-user invitation email, so it
         * must survive a cold load of `/set-password?token=...` — which in turn
         * means the host needs an SPA rewrite to index.html. See the README
         * deployment checklist.
         *
         * `PublicOnlyRoute` applies here too: a signed-in user has no business
         * setting a first password.
         */
        path: "/set-password",
        element: (
          <PublicOnlyRoute>
            <SetPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: "/change-temporary-password",
        element: (
          <PublicOnlyRoute>
            <ChangeTemporaryPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
