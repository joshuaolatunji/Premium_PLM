import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type { AppNotification } from "../types/notificationTypes";

export async function getNotifications(): Promise<AppNotification[]> {
  const token = getToken();

  const response = await apiClient<ApiResponse<AppNotification[]> | null>(
    "api/notifications",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  return response?.data ?? [];
}

// The unread-count response shape is unverified — defends against either a
// bare number or a `{ count }` object under `data`, since we don't know
// which this endpoint actually returns.
export async function getUnreadCount(): Promise<number> {
  const token = getToken();

  const response = await apiClient<ApiResponse<{ count: number } | number> | null>(
    "api/notifications/unread-count",
    {
      method: "GET",
      token: token ?? undefined,
    },
  );

  const data = response?.data;

  if (typeof data === "number") {
    return data;
  }

  if (data && typeof data === "object" && "count" in data) {
    return Number(data.count) || 0;
  }

  return 0;
}

export async function markAllAsRead(): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<null> | null>("api/notifications/read-all", {
    method: "PUT",
    token: token ?? undefined,
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<null> | null>(
    `api/notifications/${notificationId}/read`,
    {
      method: "PUT",
      token: token ?? undefined,
    },
  );
}
