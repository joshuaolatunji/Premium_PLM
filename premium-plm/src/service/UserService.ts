import { apiClient, ApiError } from "../apicalls/apiClient";
import { getCurrentUserId, getStoredUser, getToken } from "../apicalls/authStorage";
import { resolvePrimaryRole } from "../utils/roleRouting";

import type { ApiResponse } from "../types/apiTypes";
import type { PLMUser } from "../types/userTypes";

// get_all_users is open to the admin and, since 2026-10-27, the Product
// Manager. The BDO is refused (403), so it's never asked; for any other role
// that turns out to be refused, the answer is remembered for the rest of the
// session so it isn't asked again. Pages that only need names then fall back
// to generic ones ("the Product Manager", "Unassigned"…).
const ROLES_WITHOUT_USER_LIST = ["BusinessDevelopmentOfficer"];

// "v2" drops refusals remembered before the PM was given access, so a PM
// whose tab saw the old 403 isn't kept on an empty list.
function forbiddenKey() {
  return `plm-users-forbidden:v2:${getCurrentUserId() ?? "anonymous"}`;
}

function isKnownForbidden(): boolean {
  if (ROLES_WITHOUT_USER_LIST.includes(resolvePrimaryRole(getStoredUser()?.roles ?? []))) {
    return true;
  }

  try {
    return sessionStorage.getItem(forbiddenKey()) === "1";
  } catch {
    return false;
  }
}

function rememberForbidden() {
  try {
    sessionStorage.setItem(forbiddenKey(), "1");
  } catch {
    // Not remembered — the next page may ask once more.
  }
}

// True once the API has refused this user the user list (an empty list from
// getAllUsers then means "not allowed", not "no users").
export function isUserListForbidden(): boolean {
  return isKnownForbidden();
}

export async function getAllUsers(): Promise<PLMUser[]> {
  if (isKnownForbidden()) {
    return [];
  }

  const token = getToken();

  try {
    const response = await apiClient<ApiResponse<PLMUser[]>>(
      "api/PLMAdmin/get_all_users",
      {
        method: "GET",
        token: token ?? undefined,
      },
    );

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      rememberForbidden();
      return [];
    }

    throw error;
  }
}
