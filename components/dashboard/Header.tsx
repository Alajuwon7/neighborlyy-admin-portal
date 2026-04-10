"use client";

import { useState, useCallback, useMemo } from "react";
import { Bell } from "lucide-react";
import { motion } from "motion/react";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import type { AdminNotification } from "@/lib/notifications";

function getLocalGreeting(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 5) return "Happy Friday";
  if (dayOfWeek === 0) return "Relaxing Sunday";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface HeaderProps {
  title: string;
  firstName?: string;
  subtitle?: string;
  trialDaysLeft?: number | null;
  activeResidents?: number | null;
  notificationCount?: number;
  communityCodes?: string[];
  communityMap?: Record<string, string>;
  communityNameMap?: Record<string, string>;
}

export function Header({
  title,
  firstName,
  subtitle,
  trialDaysLeft,
  activeResidents,
  notificationCount = 0,
  communityCodes = [],
  communityMap = {},
  communityNameMap = {},
}: HeaderProps) {
  const greeting = useMemo(() => firstName ? getLocalGreeting() : null, [firstName]);
  const displayTitle = greeting && firstName ? `${greeting}, ${firstName} 👋` : title;

  const [latestNotification, setLatestNotification] = useState<AdminNotification | null>(null);

  const handleNewNotification = useCallback((notification: AdminNotification) => {
    setLatestNotification(notification);
  }, []);

  const { unreadCount, decrementCount, resetCount } = useRealtimeNotifications({
    communityCodes,
    initialCount: notificationCount,
    onNewNotification: handleNewNotification,
  });

  return (
    <header
      className="relative h-16 flex items-center justify-between px-6 border-b shrink-0 overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
        boxShadow: "var(--nly-shadow-sm)",
      }}
    >
      {/* Subtle gradient accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, var(--nly-brand) 30%, var(--nly-accent) 70%, transparent 100%)",
          opacity: 0.3,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <h1 className="text-lg font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {displayTitle}
        </h1>
        {subtitle && (
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {subtitle}
          </p>
        )}
      </motion.div>

      <div className="flex items-center gap-3">
        {/* Active residents indicator */}
        {activeResidents != null && activeResidents > 0 && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              color: "var(--nly-success)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: "var(--nly-success)",
                boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)",
                animation: "nly-glow-pulse 3s ease-in-out infinite",
              }}
            />
            {activeResidents} active today
          </div>
        )}

        {/* Trial badge */}
        {trialDaysLeft !== null && trialDaysLeft !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor:
                trialDaysLeft <= 3
                  ? "rgba(239, 68, 68, 0.12)"
                  : trialDaysLeft <= 7
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(16, 185, 129, 0.12)",
              color:
                trialDaysLeft <= 3
                  ? "var(--nly-error)"
                  : trialDaysLeft <= 7
                  ? "var(--nly-warning)"
                  : "var(--nly-success)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-current"
              style={{
                animation: trialDaysLeft <= 3 ? "nly-glow-pulse 2s ease-in-out infinite" : undefined,
              }}
            />
            {trialDaysLeft > 0 ? `${trialDaysLeft}d trial` : "Trial ended"}
          </motion.div>
        )}

        {/* Notifications */}
        {communityCodes.length > 0 ? (
          <NotificationDropdown
            communityCodes={communityCodes}
            communityMap={communityMap}
            communityNameMap={communityNameMap}
            unreadCount={unreadCount}
            latestNotification={latestNotification}
            onNotificationRead={decrementCount}
            onAllRead={resetCount}
          />
        ) : (
          <motion.button
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ color: "var(--nly-text-secondary)" }}
            whileHover={{ scale: 1.05, backgroundColor: "var(--nly-surface-hover)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell size={18} />
          </motion.button>
        )}
      </div>
    </header>
  );
}
