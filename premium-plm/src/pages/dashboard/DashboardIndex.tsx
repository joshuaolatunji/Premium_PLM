import { Navigate } from "react-router-dom";

import { getStoredUser } from "../../apicalls/authStorage";
import { getLandingRouteForRoles, resolvePrimaryRole } from "../../utils/roleRouting";
import Dashboard from "./Dashboard";

// Same rule as the post-login landing route (see utils/roleRouting.ts):
// the Group Head sees the governance dashboard here; everyone else is
// redirected to their own workspace.
function DashboardIndex() {
  const user = getStoredUser();
  const roles = user?.roles ?? [];
  const primaryRole = resolvePrimaryRole(roles);

  if (primaryRole !== "GroupHead") {
    return <Navigate to={getLandingRouteForRoles(roles)} replace />;
  }

  return <Dashboard />;
}

export default DashboardIndex;
