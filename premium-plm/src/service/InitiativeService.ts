import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes"
import {
  priorityFromApi,
  priorityToApi,
  type CreateInitiativeRequest,
  type ProductInitiative,
} from "../types/initiativeTypes";

// The API returns priority as an enum name ("Critical", "High", …). The app
// works with the numeric tier, so each initiative is converted on the way in.
type RawProductInitiative = Omit<ProductInitiative, "priority"> & {
  priority: string | number;
};

function normalizeInitiative(raw: RawProductInitiative): ProductInitiative {
  return { ...raw, priority: priorityFromApi(raw.priority) };
}

export async function getProductInitiatives(): Promise<ProductInitiative[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<RawProductInitiative[]>>
  ( "api/product-initiatives", {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data.map(normalizeInitiative);
}

// Initiatives where the current user is the assigned project manager.
export async function getMyAssignedInitiatives(): Promise<ProductInitiative[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<RawProductInitiative[]>>(
    "api/product-initiatives/my-assigned",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response.data.map(normalizeInitiative);
}

// Swagger documents this endpoint's 200 response with no body schema, but
// every other endpoint we've verified live follows the same
// { statusCode, isSuccessful, message, data } envelope, so we read it the
// same way — defensively, since an empty/unexpected body is still possible.
export async function createInitiative(
  payload: CreateInitiativeRequest,
): Promise<ProductInitiative | null> {
  const token = getToken();

  const response = await apiClient<ApiResponse<RawProductInitiative> | null>(
    "create-initiative",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify({ ...payload, priority: priorityToApi(payload.priority) }),
    },
  );

  return response?.data ? normalizeInitiative(response.data) : null;
}

export async function getInitiativeById(
  id: string,
): Promise<ProductInitiative> {
  const token = getToken();

  const response = await apiClient<ApiResponse<RawProductInitiative>>(
    `api/product-initiatives/${id}/get-initiative`,
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return normalizeInitiative(response.data);
}

// The API only supports changing priority through this endpoint (a
// `newPriority` query param, no request body) — there's no endpoint for
// reassigning a project manager, which is why that isn't offered as a bulk
// action in the UI.
export async function updateInitiativePriority(
  initiativeId: string,
  newPriority: number,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<RawProductInitiative> | null>(
    `api/product-initiatives/${initiativeId}/update-initiative?newPriority=${priorityToApi(newPriority)}`,
    {
      method: "PUT",
      token: token ?? undefined,
    },
  );
}
