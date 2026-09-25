import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes"
import type { CreateInitiativeRequest, ProductInitiative } from "../types/initiativeTypes";

export async function getProductInitiatives(): Promise<ProductInitiative[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<ProductInitiative[]>>
  ( "api/product-initiatives", {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data;
}

// The API's Swagger doc lists this endpoint's 200 response with no body
// schema, so its exact shape isn't guaranteed (it may return the created
// record wrapped in ApiResponse, or nothing at all). Callers should not
// rely on a return value here — refetch the initiatives list instead.
export async function createInitiative(
  payload: CreateInitiativeRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductInitiative> | null>(
    "create-initiative",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );
}