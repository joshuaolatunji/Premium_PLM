// The Notification endpoints (GET /api/notifications, GET .../unread-count,
// PUT .../read-all, PUT .../{id}/read) are real and live, but — like several
// other endpoints in this API — Swagger documents no response schema. This
// shape is a best-effort guess at the minimum any notification system needs
// (id, message, read state, timestamp) and should be corrected against a
// real response the first chance we get.
export interface AppNotification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
