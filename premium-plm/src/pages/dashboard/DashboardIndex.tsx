import { Navigate } from "react-router-dom";

import { getStoredUser } from "../../apicalls/authStorage";
import { getLandingRouteForRoles, resolvePrimaryRole } from "../../utils/roleRouting";
import Dashboard from "./Dashboard";

// Same role-priority rule as the post-login landing route (see
// utils/roleRouting.ts): Group Head sees the governance dashboard here;
// Super Admin is sent to its own admin pages, and anyone else is redirected
// to their own workspace. "Other" (no recognized role) still falls back to
// this dashboard, same as before.
function DashboardIndex() {
  const user = getStoredUser();
  const roles = user?.roles ?? [];
  const primaryRole = resolvePrimaryRole(roles);

  if (primaryRole !== "GroupHead" && primaryRole !== "Other") {
    return <Navigate to={getLandingRouteForRoles(roles)} replace />;
  }

  return <Dashboard />;
}

export default DashboardIndex;
