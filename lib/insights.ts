/**
 * Resident Insights — pure helpers for the community Insights tab.
 *
 * Sources (all shared with the mobile repo, PM read access via
 * internal.auth_user_manages_community):
 *   - user_application_decisions: append-only ledger of every approve/reject,
 *     backfilled with full history. applied_at (Miyora 20260930210000) is when
 *     the application arrived; NULL = unknown and excluded from wait stats.
 *   - get_active_resident_count(code, start, end): the broad "active" measure —
 *     app opens, posts, comments, likes, RSVPs, bookings, marketplace, help
 *     requests. Deliberately NOT the digest's narrower active_residents, which
 *     the portal labels "took part" instead.
 *
 * Never compute approval rate from profiles vs pending_users — unrelated
 * populations (that formula produced 333% on mobile).
 */

export const RANGES = [
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "12mo", label: "12 months", days: 365 },
  { value: "all", label: "All time", days: null },
] as const;
export type RangeValue = (typeof RANGES)[number]["value"];

export function parseRange(value: string | string[] | undefined): RangeValue {
  const v = Array.isArray(value) ? value[0] : value;
  return RANGES.some((r) => r.value === v) ? (v as RangeValue) : "30d";
}

/** Start of the range, or null for all time. */
export function rangeStart(range: RangeValue, now: Date): Date | null {
  const days = RANGES.find((r) => r.value === range)?.days ?? null;
  return days === null ? null : new Date(now.getTime() - days * 86400000);
}

export type DecisionRow = {
  decision: "approved" | "rejected";
  decided_at: string;
  applied_at: string | null;
};

export function summarizeDecisions(rows: DecisionRow[]) {
  const approved = rows.filter((r) => r.decision === "approved").length;
  const rejected = rows.length - approved;
  return {
    approved,
    rejected,
    total: rows.length,
    /** 0–100, or null when nothing was decided (no rate, not 0%). */
    approvalRate: rows.length > 0 ? Math.round((approved / rows.length) * 100) : null,
  };
}

/**
 * Median hours from application to decision, over rows whose applied_at is
 * known. Median, not mean: one applicant left waiting a month would drag a
 * mean far from the typical experience.
 */
export function medianWaitHours(rows: DecisionRow[]): { hours: number; sample: number } | null {
  const waits = rows
    .filter((r) => r.applied_at)
    .map((r) => (new Date(r.decided_at).getTime() - new Date(r.applied_at!).getTime()) / 3600000)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  if (waits.length === 0) return null;
  const mid = Math.floor(waits.length / 2);
  const hours = waits.length % 2 ? waits[mid] : (waits[mid - 1] + waits[mid]) / 2;
  return { hours, sample: waits.length };
}

/** "Under an hour" / "5 hours" / "2.5 days" / "12 days" */
export function formatWait(hours: number): string {
  if (hours < 1) return "Under an hour";
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const days = hours / 24;
  return `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)} days`;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WeekWindow = { start: Date; end: Date; label: string; partial: boolean };

/**
 * The last `n` ISO weeks (Monday 00:00 UTC to the next Monday), oldest first,
 * ending with the current in-progress week (partial: true, end = now).
 */
export function lastWeeks(now: Date, n: number): WeekWindow[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const weeks: WeekWindow[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setUTCDate(monday.getUTCDate() - 7 * i);
    const nextMonday = new Date(start);
    nextMonday.setUTCDate(start.getUTCDate() + 7);
    const partial = i === 0;
    weeks.push({
      start,
      end: partial ? now : nextMonday,
      label: `${start.getUTCDate()} ${MONTH_SHORT[start.getUTCMonth()]}`,
      partial,
    });
  }
  return weeks;
}

export type MonthBucket = { key: string; label: string; approved: number; rejected: number };

/** Approved/rejected counts for the last `n` calendar months (UTC), oldest first. */
export function monthlyDecisions(rows: DecisionRow[], now: Date, n: number): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.getUTCMonth() === 0 || i === n - 1
      ? `${MONTH_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
      : MONTH_SHORT[d.getUTCMonth()];
    buckets.push({ key, label, approved: 0, rejected: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of rows) {
    const b = byKey.get(r.decided_at.slice(0, 7));
    if (b) b[r.decision] += 1;
  }
  return buckets;
}
