"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { NotificationRow } from "@/components/dashboard/NotificationRow";
import { getNotificationHref } from "@/lib/notifications";
import type { AdminNotification } from "@/lib/notifications";
import {
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/dashboard/notifications/actions";

interface NotificationDropdownProps {
  communityCodes: string[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  unreadCount: number;
}

export function NotificationDropdown({
  communityCodes,
  communityMap,
  communityNameMap,
  unreadCount,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      const data = await getRecentNotifications(communityCodes, 8);
      setNotifications(data);
      setLoading(false);
    }
  }

  async function handleClickNotification(notification: AdminNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }
    setOpen(false);
    const map = new Map(Object.entries(communityMap));
    const href = getNotificationHref(notification, map);
    router.push(href);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(communityCodes);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={handleOpen}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
        style={{ color: "var(--nly-text-secondary)" }}
        whileHover={{ scale: 1.05, backgroundColor: "var(--nly-surface-hover)" }}
        whileTap={{ scale: 0.95 }}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "No new notifications"}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
            style={{
              backgroundColor: "var(--nly-error)",
              boxShadow: "0 0 8px rgba(239, 68, 68, 0.4)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-12 w-[380px] max-h-[480px] rounded-xl border shadow-lg overflow-hidden z-50"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--nly-border)" }}
            >
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--nly-text-primary)" }}
              >
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: "var(--nly-accent)" }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-[370px] divide-y" style={{ borderColor: "var(--nly-divider)" }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)", width: "70%" }} />
                      <div className="h-2 rounded w-20 nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)" }} />
                    </div>
                  </div>
                ))
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    communityName={communityNameMap[n.community_code]}
                    showCommunity={communityCodes.length > 1}
                    onClick={() => handleClickNotification(n)}
                  />
                ))
              )}
            </div>

            <div
              className="px-4 py-2.5 border-t text-center"
              style={{ borderColor: "var(--nly-border)" }}
            >
              <a
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--nly-accent)" }}
              >
                View all notifications &rarr;
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
