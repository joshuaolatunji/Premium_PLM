import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ProductInitiativesResponse } from "../types/initiativeTypes";

export async function getProductInitiatives() {
  const token = getToken();

  return apiClient<ProductInitiativesResponse>(
    "/api/product-initiatives",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );
}