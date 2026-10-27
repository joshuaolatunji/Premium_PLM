import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  NOTIFICATIONS_API_AVAILABLE,
} from "../../service/NotificationService";
import type { AppNotification } from "../../types/notificationTypes";
import { ApiError } from "../../apicalls/apiClient";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: getUnreadCount,
  });

  function invalidateNotifications() {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      setErrorMessage("");
      invalidateNotifications();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to mark all notifications as read.",
      );
    },
  });

  const markOneMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      setErrorMessage("");
      invalidateNotifications();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to mark this notification as read.",
      );
    },
  });

  const notifications = notificationsQuery.data ?? [];
  // The Group Head's project activity, recorded on this browser (gaps file M21).
  const isActivityFeed = !NOTIFICATIONS_API_AVAILABLE && notifications.some((item) => item.area);

  function open(notification: AppNotification) {
    if (!notification.isRead) {
      markOneMutation.mutate(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
    }
  }
  const unreadCount = unreadCountQuery.data ?? 0;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Notifications</p>

          <h1 className="dashboard-title">Notifications</h1>

          <p className="dashboard-subtitle">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
              : "You're all caught up."}
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--dark"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unreadCount === 0}
          >
            {markAllMutation.isPending ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </header>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {isActivityFeed && (
        <p className="mock-data-notice">
          You're notified of every action taken on your products. These are recorded on this browser until the
          backend sends them (gaps file M21), so actions taken on other devices don't appear yet.
        </p>
      )}

      <section className="dashboard-panel">
        <div className="notifications-list">
          {notificationsQuery.isLoading && (
            <p className="initiatives-empty">Loading notifications…</p>
          )}

          {notificationsQuery.isError && (
            <p className="initiatives-empty initiatives-empty--error">
              Couldn't load notifications. Try refreshing the page.
            </p>
          )}

          {!notificationsQuery.isLoading &&
            !notificationsQuery.isError &&
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={
                  notification.isRead
                    ? "notifications-item"
                    : "notifications-item notifications-item--unread"
                }
                onClick={() => open(notification)}
                disabled={(notification.isRead && !notification.link) || markOneMutation.isPending}
              >
                <span className="notifications-item_dot" aria-hidden="true" />

                <span className="notifications-item_body">
                  <span className="notifications-item_message">
                    {notification.message}
                  </span>

                  {(notification.initiativeName || notification.detail) && (
                    <span className="notifications-item_detail">
                      {[notification.initiativeName, notification.detail].filter(Boolean).join(" · ")}
                    </span>
                  )}

                  <span className="notifications-item_time">
                    {notification.area && <span className="activity-area">{notification.area}</span>}
                    {formatDate(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))}

          {!notificationsQuery.isLoading &&
            !notificationsQuery.isError &&
            notifications.length === 0 && (
              <p className="initiatives-empty">No notifications yet.</p>
            )}
        </div>
      </section>
    </div>
  );
}

export default Notifications;
