import { apiClient, ApiError } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type {
  CreateDiscoveryRequest,
  ProductDiscovery,
  UpdateDiscoveryRequest,
} from "../types/discoveryTypes";

// Returns null when the initiative has no discovery document yet, rather
// than throwing — a 404 here is an expected, normal state (not started),
// not an error. Same pattern as getProposalByInitiativeId.
export async function getDiscoveryByInitiativeId(
  initiativeId: string,
): Promise<ProductDiscovery | null> {
  const token = getToken();

  try {
    const response = await apiClient<ApiResponse<ProductDiscovery> | null>(
      `api/product-discovery/${initiativeId}`,
      {
        method: "GET",
        token: token ?? undefined,
      },
    );

    return response?.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createDiscovery(
  payload: CreateDiscoveryRequest,
): Promise<ProductDiscovery | null> {
  const token = getToken();

  const response = await apiClient<ApiResponse<ProductDiscovery> | null>(
    "api/product-discovery/create-discovery",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );

  return response?.data ?? null;
}

export async function updateDiscovery(
  initiativeId: string,
  payload: UpdateDiscoveryRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductDiscovery> | null>(
    `api/product-discovery/${initiativeId}/update-discovery`,
    {
      method: "PUT",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );
}
