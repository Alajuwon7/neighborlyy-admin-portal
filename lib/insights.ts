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

// ─── Help requests ──────────────────────────────────────────────────────────
// help_requests is resident-to-resident (the neighbour help board). PMs read it
// via Miyora 20260930190000. resolved_at is exact for requests completed after
// 2026-09-17; earlier ones were backfilled from updated_at (an over-estimate).

export type HelpRow = {
  request_type: string;
  metadata: { category?: unknown } | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  resolved_at: string | null;
};

// Exactly the app's REQUEST_TYPES labels (HelpRequestScreen.tsx).
const HELP_TYPE_LABELS: Record<string, string> = {
  dog_walking: "Dog Walking",
  groceries: "Groceries",
  moving: "Moving Help",
  custom: "Custom Request",
};

/** Label for the folded tail — not "Other", which a resident can type as a category. */
export const HELP_TAIL_LABEL = "Everything else";

/** Same precedence as the app: a free-text metadata.category, else the type's label. */
export function helpCategory(row: Pick<HelpRow, "request_type" | "metadata">): string {
  const custom = row.metadata?.category;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return Object.prototype.hasOwnProperty.call(HELP_TYPE_LABELS, row.request_type)
    ? HELP_TYPE_LABELS[row.request_type]
    : "Custom Request";
}

export function summarizeHelp(rows: HelpRow[]) {
  const completed = rows.filter((r) => r.status === "completed");
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  // Cancelled requests were withdrawn, not failed — leave them out of the rate.
  const decidable = rows.length - cancelled;
  // A request inserted already-completed gets resolved_at = created_at
  // (a helper-flow artefact, not a 0-second rescue) — leave it out of timing.
  const hours = completed
    .filter((r) => r.resolved_at && r.resolved_at !== r.created_at)
    .map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3600000)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return {
    total: rows.length,
    completed: completed.length,
    cancelled,
    completionRate: decidable > 0 ? Math.round((completed.length / decidable) * 100) : null,
    medianResolveHours:
      hours.length === 0 ? null : hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2,
  };
}

/**
 * Counts per category, largest first. Categories merge case-insensitively
 * (a typed "groceries" joins the Groceries type), keeping the first-seen
 * spelling. Beyond `max` bars the tail folds into HELP_TAIL_LABEL, always last.
 */
export function helpByCategory(rows: HelpRow[], max = 6): { label: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const label = helpCategory(r);
    const key = label.toLowerCase();
    const c = counts.get(key) ?? { label, count: 0 };
    c.count += 1;
    counts.set(key, c);
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= max) return sorted;
  const kept = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((sum, c) => sum + c.count, 0);
  return [...kept, { label: HELP_TAIL_LABEL, count: rest }];
}

/** "3 hours" / "5 days" — age of an open request. */
export function formatAge(fromIso: string, now: Date): string {
  const hours = (now.getTime() - new Date(fromIso).getTime()) / 3600000;
  if (hours < 1) return "Under an hour";
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}
