"use client";

import { useEffect, useState } from "react";
import { getAlertState, formatCountdown, PRIORITIES } from "@/lib/alerts";
import { AlertRowActions } from "@/components/community/AlertRowActions";

interface Alert {
  id: string;
  title: string;
  message: string;
  priority: string;
  is_pinned: boolean | null;
  pin_expires_at: string | null;
  valid_until: string | null;
  created_at: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: "var(--nly-alert-urgent)", bg: "rgba(239, 68, 68, 0.1)", label: "Urgent" },
  high: { color: "var(--nly-alert-high)", bg: "rgba(249, 115, 22, 0.1)", label: "High" },
  medium: { color: "var(--nly-alert-medium)", bg: "rgba(245, 158, 11, 0.1)", label: "Medium" },
  low: { color: "var(--nly-alert-low)", bg: "rgba(6, 182, 212, 0.1)", label: "Low" },
};

const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p.value, PRIORITIES.length - i])
);

function Row({
  alert,
  expired,
  now,
  communityId,
}: {
  alert: Alert;
  expired?: boolean;
  now: number;
  communityId: string;
}) {
  const cfg = PRIORITY_CONFIG[alert.priority] ?? PRIORITY_CONFIG.low;
  const state = getAlertState(alert, now);
  return (
    <div
      className="px-5 py-4 flex items-start justify-between gap-3"
      style={{ borderColor: "var(--nly-divider)", opacity: expired ? 0.55 : 1 }}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
            {alert.title}
          </h4>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
          {state.isPinned && state.msLeft !== null && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "rgba(47, 196, 211, 0.12)", color: "var(--nly-brand)" }}
            >
              📌 Pinned · {formatCountdown(state.msLeft)}
            </span>
          )}
        </div>
        <p className="text-xs line-clamp-2" style={{ color: "var(--nly-text-secondary)" }}>
          {alert.message}
        </p>
      </div>
      <AlertRowActions alert={alert} communityId={communityId} />
    </div>
  );
}

function Section({
  label,
  items,
  expired,
  now,
  communityId,
}: {
  label: string;
  items: Alert[];
  expired?: boolean;
  now: number;
  communityId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="rounded-2xl border divide-y overflow-hidden"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <div
        className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--nly-text-tertiary)", borderColor: "var(--nly-divider)" }}
      >
        {label}
      </div>
      {items.map((a) => (
        <Row key={a.id} alert={a} expired={expired} now={now} communityId={communityId} />
      ))}
    </div>
  );
}

export function AlertsList({
  alerts,
  communityId,
}: {
  alerts: Alert[];
  communityId: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const pinned: Alert[] = [];
  const active: Alert[] = [];
  const past: Alert[] = [];

  for (const a of alerts) {
    const state = getAlertState(a, now);
    if (state.isExpired) past.push(a);
    else if (state.isPinned) pinned.push(a);
    else active.push(a);
  }

  pinned.sort(
    (a, b) =>
      new Date(a.pin_expires_at ?? 0).getTime() -
      new Date(b.pin_expires_at ?? 0).getTime()
  );
  active.sort(
    (a, b) =>
      (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.valid_until ?? b.created_at).getTime() -
      new Date(a.valid_until ?? a.created_at).getTime()
  );

  if (alerts.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          No alerts have been sent yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section label="Pinned" items={pinned} now={now} communityId={communityId} />
      <Section label="Active" items={active} now={now} communityId={communityId} />
      <Section label="Past alerts" items={past} expired now={now} communityId={communityId} />
    </div>
  );
}
