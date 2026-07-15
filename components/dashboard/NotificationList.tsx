"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { NotificationRow } from "@/components/dashboard/NotificationRow";
import { getNotificationHref } from "@/lib/notifications";
import type { AdminNotification } from "@/lib/notifications";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/dashboard/notifications/actions";

const EMPTY_MESSAGES: Record<string, string> = {
  all: "No notifications yet. Activity will appear here as residents use the app.",
  pending_resident: "No resident notifications right now.",
  event_rsvp: "No RSVP notifications right now.",
  facility_reservation: "No reservation notifications right now.",
  help_request: "No help request notifications right now.",
};

interface NotificationListProps {
  notifications: AdminNotification[];
  total: number;
  communityCodes: string[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  filter: string | null;
}

export function NotificationList({
  notifications: initialNotifications,
  total,
  communityCodes,
  communityMap,
  communityNameMap,
  filter,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const hasMore = notifications.length < total;

  const emptyMessage =
    EMPTY_MESSAGES[filter ?? "all"] ?? EMPTY_MESSAGES.all;

  async function handleClick(notification: AdminNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }
    const map = new Map(Object.entries(communityMap));
    const href = getNotificationHref(notification, map);
    router.push(href);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(communityCodes);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    const { notifications: more } = await getNotifications(
      communityCodes,
      filter,
      notifications.length,
      20,
    );
    setNotifications((prev) => [...prev, ...more]);
    setLoadingMore(false);
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {notifications.some((n) => !n.is_read) && (
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "var(--nly-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {total} notification{total !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--nly-accent)" }}
          >
            <CheckCheck size={13} />
            Mark all as read
          </button>
        </div>
      )}

      <div
        className="divide-y max-h-[32rem] overflow-y-auto"
        style={{ borderColor: "var(--nly-divider)" }}
      >
        {notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
              {emptyMessage}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              communityName={communityNameMap[n.community_code]}
              showCommunity={communityCodes.length > 1}
              onClick={() => handleClick(n)}
            />
          ))
        )}
      </div>

      {hasMore && (
        <div
          className="px-4 py-3 border-t text-center"
          style={{ borderColor: "var(--nly-border)" }}
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--nly-accent)" }}
          >
            {loadingMore ? "Loading..." : `Load more (${total - notifications.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
