import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../../service/NotificationService";
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
            className="button button--secondary"
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
                onClick={() =>
                  !notification.isRead && markOneMutation.mutate(notification.id)
                }
                disabled={notification.isRead || markOneMutation.isPending}
              >
                <span className="notifications-item_dot" aria-hidden="true" />

                <span className="notifications-item_body">
                  <span className="notifications-item_message">
                    {notification.message}
                  </span>

                  <span className="notifications-item_time">
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
