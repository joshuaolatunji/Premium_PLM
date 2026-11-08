import { Navigate } from "react-router-dom";

import { getStoredUser } from "../../apicalls/authStorage";
import { SHOW_INITIATIVES } from "../../config/features";
import { getLandingRouteForRoles, resolvePrimaryRole } from "../../utils/roleRouting";
import Dashboard from "./Dashboard";
import MemoDashboard from "./MemoDashboard";

// Same rule as the post-login landing route (see utils/roleRouting.ts):
// the Group Head sees the governance dashboard here; everyone else is
// redirected to their own workspace. While initiatives are hidden, every
// role gets the memo dashboard here.
function DashboardIndex() {
  const user = getStoredUser();
  const roles = user?.roles ?? [];
  const primaryRole = resolvePrimaryRole(roles);

  if (!SHOW_INITIATIVES) {
    return <MemoDashboard />;
  }

  if (primaryRole !== "GroupHead") {
    return <Navigate to={getLandingRouteForRoles(roles)} replace />;
  }

  return <Dashboard />;
}

export default DashboardIndex;
