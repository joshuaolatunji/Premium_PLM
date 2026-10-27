import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type { AppNotification } from "../types/notificationTypes";

// The backend has removed its notification list / unread / read endpoints
// (only the "resend" ones remain), so every call here would be a 404. While
// this is false the app doesn't call them: the list is empty and the bell
// shows no badge. Set it back to true once the endpoints return.
export const NOTIFICATIONS_API_AVAILABLE = false;

export async function getNotifications(): Promise<AppNotification[]> {
  if (!NOTIFICATIONS_API_AVAILABLE) {
    return [];
  }

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
  if (!NOTIFICATIONS_API_AVAILABLE) {
    return 0;
  }

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
  if (!NOTIFICATIONS_API_AVAILABLE) {
    return;
  }

  const token = getToken();

  await apiClient<ApiResponse<null> | null>("api/notifications/read-all", {
    method: "PUT",
    token: token ?? undefined,
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  if (!NOTIFICATIONS_API_AVAILABLE) {
    return;
  }

  const token = getToken();

  await apiClient<ApiResponse<null> | null>(
    `api/notifications/${notificationId}/read`,
    {
      method: "PUT",
      token: token ?? undefined,
    },
  );
}
