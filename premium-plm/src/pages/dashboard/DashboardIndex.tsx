import { Navigate } from "react-router-dom";

import { getStoredUser } from "../../apicalls/authStorage";
import { getLandingRouteForRoles, resolvePrimaryRole } from "../../utils/roleRouting";
import Dashboard from "./Dashboard";

// Same role-priority rule as the post-login landing route (see
// utils/roleRouting.ts): Group Head and Super Admin both land on "/dashboard"
// and see the same governance dashboard here; anyone whose primary role is
// something else is redirected to their own workspace instead. "Other" (no
// recognized role) still falls back to this dashboard, same as before.
function DashboardIndex() {
  const user = getStoredUser();
  const roles = user?.roles ?? [];
  const primaryRole = resolvePrimaryRole(roles);

  if (
    primaryRole !== "GroupHead" &&
    primaryRole !== "SuperAdmin" &&
    primaryRole !== "Other"
  ) {
    return <Navigate to={getLandingRouteForRoles(roles)} replace />;
  }

  return <Dashboard />;
}

export default DashboardIndex;
