import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type { PLMCategory } from "../types/categoryTypes";

export async function getCategories(): Promise<PLMCategory[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<PLMCategory[]>>(
    "api/PLMCategory",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data;
}
