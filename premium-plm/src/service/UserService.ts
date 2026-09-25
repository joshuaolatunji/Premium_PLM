import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type { PLMUser } from "../types/userTypes";

export async function getAllUsers(): Promise<PLMUser[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<PLMUser[]>>(
    "api/PLMAdmin/get_all_users",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data;
}
