"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";

export interface ActivityItem {
  id: string;
  type:
    | "resident_joined"
    | "event_created"
    | "alert_sent"
    | "help_request"
    | "reservation";
  message: string;
  community_name?: string;
  created_at: string;
  actionHref?: string;
  actionLabel?: string;
}

const ACTIVITY_ICONS: Record<ActivityItem["type"], { icon: string; color: string }> = {
  resident_joined: { icon: "\uD83D\uDC64", color: "var(--nly-success)" },
  event_created: { icon: "\uD83D\uDCC5", color: "var(--nly-accent)" },
  alert_sent: { icon: "\uD83D\uDEA8", color: "var(--nly-warning)" },
  help_request: { icon: "\uD83D\uDE4B", color: "var(--nly-info)" },
  reservation: { icon: "\uD83D\uDCCB", color: "var(--nly-brand)" },
};

function groupByTime(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const today: ActivityItem[] = [];
  const yesterday: ActivityItem[] = [];
  const thisWeek: ActivityItem[] = [];
  const older: ActivityItem[] = [];

  for (const item of items) {
    const date = new Date(item.created_at);
    if (isToday(date)) today.push(item);
    else if (isYesterday(date)) yesterday.push(item);
    else if (isThisWeek(date)) thisWeek.push(item);
    else older.push(item);
  }

  const groups: { label: string; items: ActivityItem[] }[] = [];
  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
  if (thisWeek.length > 0) groups.push({ label: "This Week", items: thisWeek });
  if (older.length > 0) groups.push({ label: "Earlier", items: older });
  return groups;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  communityCodes?: string[];
}

export function ActivityFeed({ items, loading, communityCodes }: ActivityFeedProps) {
  const router = useRouter();
  const codesKey = (communityCodes ?? []).join(",");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!codesKey) return;
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 800);
    };
    const channel = supabase.channel("dashboard-activity");
    // These are exactly the tables the server builds recentActivity from
    // (profiles / pending_users / events / alerts in dashboard/page.tsx).
    for (const table of ["profiles", "pending_users", "events", "alerts"]) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [codesKey, router]);

  return (
    <div
      className="nly-card-hover rounded-2xl border"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--nly-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          Recent Activity
        </h3>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: "var(--nly-success)",
              boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)",
              animation: "nly-glow-pulse 3s ease-in-out infinite",
            }}
          />
          Live
        </span>
      </div>

      <div
        className="divide-y max-h-96 overflow-y-auto"
        style={{ borderColor: "var(--nly-divider)" }}
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg nly-shimmer"
                style={{ backgroundColor: "var(--nly-surface-hover)" }}
              />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3 rounded nly-shimmer"
                  style={{
                    backgroundColor: "var(--nly-surface-hover)",
                    width: `${60 + i * 8}%`,
                  }}
                />
                <div
                  className="h-2 rounded w-24 nly-shimmer"
                  style={{ backgroundColor: "var(--nly-surface-hover)" }}
                />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
              No activity yet. Activity will appear here as residents use the app.
            </p>
          </div>
        ) : (
          groupByTime(items).map((group) => (
            <div key={group.label}>
              <div
                className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{
                  color: "var(--nly-text-tertiary)",
                  backgroundColor: "rgba(233, 238, 244, 0.03)",
                }}
              >
                {group.label}
              </div>
              {group.items.map((item, i) => {
                const meta = ACTIVITY_ICONS[item.type];
                return (
                  <motion.div
                    key={item.id}
                    className="px-5 py-3 flex items-start gap-3 transition-colors duration-200 hover:bg-[var(--nly-surface-hover)] group"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: i * 0.06,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: `${meta.color}15` }}
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm leading-snug"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        {item.message}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                        {item.community_name && (
                          <span className="mr-2">{item.community_name} &middot;</span>
                        )}
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {item.actionHref && (
                      <a
                        href={item.actionHref}
                        className="text-xs font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--nly-accent)" }}
                      >
                        {item.actionLabel ?? "View"} →
                      </a>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
