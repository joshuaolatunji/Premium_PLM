import { Navigate } from "react-router-dom";

import { getStoredUser } from "../../apicalls/authStorage";
import { canSignOff, getLandingRouteForRoles } from "../../utils/roleRouting";

// Keeps the Approvals pages to people who can be on a sign-off workflow;
// Developers and Lead Engineers are sent back to their own workspace.
function SignOffOnly({ children }: { children: React.ReactNode }) {
  const roles = getStoredUser()?.roles ?? [];

  if (!canSignOff(roles)) {
    return <Navigate to={getLandingRouteForRoles(roles)} replace />;
  }

  return children;
}

export default SignOffOnly;
