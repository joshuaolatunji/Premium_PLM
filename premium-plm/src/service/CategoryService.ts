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

export interface CreateCategoryRequest {
  name: string;
  description: string;
}

export async function createCategory(
  payload: CreateCategoryRequest,
): Promise<PLMCategory | null> {
  const token = getToken();

  const response = await apiClient<ApiResponse<PLMCategory> | null>(
    "api/PLMCategory/insert",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );

  return response?.data ?? null;
}

export interface UpdateCategoryRequest {
  name: string;
  description: string;
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/PLMCategory/${id}/update`, {
    method: "PUT",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

export async function deactivateCategory(id: string): Promise<void> {
  const token = getToken();

  await apiClient<unknown>(`api/PLMCategory/${id}/deactivate`, {
    method: "DELETE",
    token: token ?? undefined,
  });
}
