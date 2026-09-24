import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes"
import type { CreateInitiativeRequest, ProductInitiative } from "../types/initiativeTypes";

export async function getProductInitiatives(): Promise<ProductInitiative[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<ProductInitiative[]>>
  ( "/api/product-initiatives", {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data;
}



export async function createInitiative (payload: CreateInitiativeRequest): Promise<ProductInitiative> {
      const token = getToken();

      const response = await apiClient<ApiResponse<ProductInitiative>>("create-initiative", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload)
      })


    return response.data;
}