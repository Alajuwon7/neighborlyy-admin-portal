export const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "var(--nly-alert-urgent)" },
  { value: "high", label: "High", color: "var(--nly-alert-high)" },
  { value: "medium", label: "Medium", color: "var(--nly-alert-medium)" },
  { value: "low", label: "Low", color: "var(--nly-alert-low)" },
] as const;

export const ALERT_DURATIONS = [
  { value: "3h", label: "3 hours", ms: 3 * 3600000 },
  { value: "6h", label: "6 hours", ms: 6 * 3600000 },
  { value: "12h", label: "12 hours", ms: 12 * 3600000 },
  { value: "1d", label: "1 day", ms: 86400000 },
  { value: "2d", label: "2 days", ms: 2 * 86400000 },
  { value: "3d", label: "3 days", ms: 3 * 86400000 },
  { value: "1w", label: "1 week", ms: 7 * 86400000 },
] as const;

export type AlertTimestamps = {
  is_pinned: boolean;
  pin_expires_at: string | null;
  valid_until: string | null;
};

/**
 * Resolve a duration selection to the alert's pin + expiry columns.
 * "off"/"" => standing alert (no pin, no expiry). A known duration ties
 * pin_expires_at and valid_until to the same UTC instant (now + duration),
 * which both drives the countdown and removes the alert for residents on time.
 * Unknown values are treated as "off".
 */
export function durationToTimestamps(
  value: string,
  now: number = Date.now()
): AlertTimestamps {
  const match = ALERT_DURATIONS.find((d) => d.value === value);
  if (!match) {
    return { is_pinned: false, pin_expires_at: null, valid_until: null };
  }
  const at = new Date(now + match.ms).toISOString();
  return { is_pinned: true, pin_expires_at: at, valid_until: at };
}

export type AlertStateInput = {
  is_pinned?: boolean | null;
  pin_expires_at?: string | null;
  valid_until?: string | null;
};

/**
 * Effective alert state, derived from timestamps (not the stored is_pinned flag,
 * which can go stale once pin_expires_at passes). msLeft is the time remaining
 * until the pin/expiry, or null for a standing alert.
 */
export function getAlertState(
  alert: AlertStateInput,
  now: number = Date.now()
): { isPinned: boolean; isExpired: boolean; msLeft: number | null } {
  const expiryTs = alert.valid_until ? new Date(alert.valid_until).getTime() : null;
  const pinTs = alert.pin_expires_at
    ? new Date(alert.pin_expires_at).getTime()
    : null;

  const isExpired = expiryTs !== null && expiryTs <= now;
  const isPinned = !isExpired && pinTs !== null && pinTs > now;
  const refTs = pinTs ?? expiryTs;
  const msLeft = refTs === null ? null : Math.max(0, refTs - now);

  return { isPinned, isExpired, msLeft };
}

/** Human-readable remaining time, e.g. "2d 3h left", "12m left", "<1m left". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "<1m left";
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
