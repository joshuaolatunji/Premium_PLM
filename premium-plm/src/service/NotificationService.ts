import { apiClient } from "../apicalls/apiClient";
import { getCurrentUserId, getStoredUser, getToken } from "../apicalls/authStorage";
import { resolvePrimaryRole } from "../utils/roleRouting";
import { describeActivity, listActivity } from "./ActivityService";

import type { ApiResponse } from "../types/apiTypes";
import type { AppNotification } from "../types/notificationTypes";

// The backend has removed its notification list / unread / read endpoints
// (only the "resend" ones remain), so every call here would be a 404. While
// this is false the app doesn't call them: the list is empty and the bell
// shows no badge. Set it back to true once the endpoints return.
export const NOTIFICATIONS_API_AVAILABLE = false;

// ---------------------------------------------------------------------------
// The Group Head's notifications, until the API sends them (gaps file M21):
// every action anyone else takes on a product, from the activity log.
// What they've read is remembered per Group Head on this browser.

interface ReadState {
  // Everything up to this time counts as read ("Mark all as read").
  readAllAt: string;
  ids: string[];
}

function isGroupHead() {
  return resolvePrimaryRole(getStoredUser()?.roles ?? []) === "GroupHead";
}

function readStateKey() {
  return `plm-activity-read:${getCurrentUserId() ?? "anonymous"}`;
}

function loadReadState(): ReadState {
  try {
    const raw = localStorage.getItem(readStateKey());
    return raw ? (JSON.parse(raw) as ReadState) : { readAllAt: "", ids: [] };
  } catch {
    return { readAllAt: "", ids: [] };
  }
}

function saveReadState(state: ReadState) {
  try {
    localStorage.setItem(readStateKey(), JSON.stringify(state));
  } catch {
    // Not remembered — they'll show as unread again.
  }
}

function activityNotifications(): AppNotification[] {
  const myId = getCurrentUserId();
  const state = loadReadState();

  return listActivity().map((entry) => ({
    id: entry.id,
    message: describeActivity(entry),
    // Their own actions never count as new.
    isRead: entry.actorId === myId || entry.at <= state.readAllAt || state.ids.includes(entry.id),
    createdAt: entry.at,
    detail: entry.detail,
    initiativeName: entry.initiativeName,
    area: entry.area,
    tone: entry.tone,
    link: entry.link,
  }));
}

export async function getNotifications(): Promise<AppNotification[]> {
  if (!NOTIFICATIONS_API_AVAILABLE) {
    return isGroupHead() ? activityNotifications() : [];
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
    return isGroupHead() ? activityNotifications().filter((item) => !item.isRead).length : 0;
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
    saveReadState({ readAllAt: new Date().toISOString(), ids: [] });
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
    const state = loadReadState();
    saveReadState({ ...state, ids: [...state.ids, notificationId] });
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
