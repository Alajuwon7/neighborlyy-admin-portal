"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, UserPlus, CalendarCheck, ClipboardList, HelpCircle, type LucideProps } from "lucide-react";
import type { AdminNotification, NotificationType } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notifications";

const ICON_MAP: Record<NotificationType, React.ComponentType<LucideProps>> = {
  pending_resident: UserPlus,
  event_rsvp: CalendarCheck,
  facility_reservation: ClipboardList,
  help_request: HelpCircle,
};

// Fallbacks for unknown/future notification types (e.g. types added in DB
// before the TS union is updated). Prevents render crashes on
// `meta.color` / `<Icon />` when the lookup misses.
const FALLBACK_META = {
  label: "Notification",
  icon: "Bell",
  color: "var(--nly-text-secondary)",
} as const;
const FALLBACK_ICON = Bell;

interface NotificationRowProps {
  notification: AdminNotification;
  communityName?: string;
  showCommunity?: boolean;
  onClick?: () => void;
}

export function NotificationRow({
  notification,
  communityName,
  showCommunity = false,
  onClick,
}: NotificationRowProps) {
  // Cast through `as NotificationType` because the DB CHECK constraint may
  // permit values not yet in the TS union; the `??` handles that runtime case.
  const meta = NOTIFICATION_META[notification.type as NotificationType] ?? FALLBACK_META;
  const Icon = ICON_MAP[notification.type as NotificationType] ?? FALLBACK_ICON;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--nly-surface-hover)] group"
      style={{
        backgroundColor: notification.is_read ? "transparent" : "rgba(120, 166, 200, 0.04)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
      >
        <Icon size={15} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{
            color: "var(--nly-text-primary)",
            fontWeight: notification.is_read ? 400 : 500,
          }}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            {notification.body}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--nly-text-placeholder)" }}>
          {showCommunity && communityName && (
            <span className="mr-1.5">{communityName} &middot;</span>
          )}
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {!notification.is_read && (
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-2"
          style={{
            backgroundColor: "var(--nly-accent)",
            boxShadow: "0 0 6px rgba(120, 166, 200, 0.4)",
          }}
        />
      )}
    </button>
  );
}
