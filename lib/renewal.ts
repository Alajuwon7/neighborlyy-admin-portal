/**
 * Renewal rate by engagement — the Insights tile's rules and display helpers.
 *
 * Lease outcomes come from the PM's rent-roll uploads (lease_records, portal
 * migration 036). The grouping is done in the database by
 * get_lease_renewal_summary (Miyora 20261109120000), which returns group
 * totals only: per-lease engagement never leaves the database, because a PM
 * could join it back to a unit. Small-group suppression is enforced there too;
 * this module re-checks it so a stray value can't slip onto the tile.
 *
 * "Engaged" means TOOK PART — the same six actions as the Weekly Summary and
 * the "Took part" slice of the weekly activity chart — so the word means one
 * thing on the Insights page. Likes, bookings and listings are "quietly
 * active" there, and don't make a lease engaged.
 */

/**
 * A lease counts as "engaged" when its resident(s) took part (posted,
 * commented, asked for help, RSVPed, answered a survey or used Connect) in
 * enough of the completed ISO weeks (Mon–Sun, UTC) before the week the lease
 * ended. PRORATED: a lease is judged on the weeks the resident was actually
 * there, up to `windowWeeks`, and needs `minWeeks` per `windowWeeks` of those
 * (3 of 12 = a quarter, rounded up, at least 1). Leases with fewer than
 * `minHistoryWeeks` weeks are "too new" and left out.
 *
 * minWeeks / windowWeeks are sent to the database on every read (it accepts a
 * window of 8–26 weeks); minHistoryWeeks is fixed in SQL (v_min_history in
 * get_lease_renewal_summary, Miyora 20261110120000) — keep in sync.
 */
export const ENGAGED_RULE = { minWeeks: 3, windowWeeks: 12, minHistoryWeeks: 4 } as const;

/**
 * The tile always covers leases that ended in the last 12 months, whatever
 * the page's range filter: a 45-unit property has ~11 leases ending in 90
 * days, never enough for two groups of 5 units.
 */
export const RENEWAL_PERIOD_LABEL = "last 12 months";

/** Inclusive [from, to] calendar dates (YYYY-MM-DD, UTC) for the tile's 12 months. */
export function renewalPeriod(now: Date): { from: string; to: string } {
  // Same calendar day a year earlier (29 Feb -> 28 Feb), then the day after it.
  const y = now.getUTCFullYear() - 1, m = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const from = new Date(Date.UTC(y, m, Math.min(now.getUTCDate(), lastDay) + 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

/**
 * Privacy floor: a group needs leases from at least this many distinct units
 * before its rate shows; below it the tile says "Not enough leases yet".
 * Enforced in SQL (v_floor in get_lease_renewal_summary) — keep in sync.
 */
export const MIN_GROUP_UNITS = 5;

/** One row from get_lease_renewal_summary. */
export type RenewalSummaryRow = {
  total: number;
  unmatched: number;
  too_new: number;
  pending: number;
  engaged_rate: number | null;
  others_rate: number | null;
  engaged_leases: number | null;
  engaged_renewed: number | null;
  others_leases: number | null;
  others_renewed: number | null;
};

export type GroupStat = {
  /** 0–100, or null when the group is under the floor. */
  rate: number | null;
  /** Shown only when BOTH groups clear the floor (else derivable by subtraction). */
  leases: number | null;
  renewed: number | null;
};

export type RenewalSummary = {
  total: number;
  unmatched: number;
  tooNew: number;
  pending: number;
  engaged: GroupStat;
  others: GroupStat;
};

const count = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
const rate = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;

/** Shape the database row for the tile; defensive about nulls and odd values. */
export function toRenewalSummary(row: Partial<RenewalSummaryRow> | null | undefined): RenewalSummary {
  const r = row ?? {};
  const engagedRate = rate(r.engaged_rate);
  const othersRate = rate(r.others_rate);
  // Counts only when both rates are shown — never one group's size on its own.
  const showCounts = engagedRate !== null && othersRate !== null;
  const group = (rt: number | null, leases: unknown, renewed: unknown): GroupStat => ({
    rate: rt,
    leases: showCounts && typeof leases === "number" ? count(leases) : null,
    renewed: showCounts && typeof renewed === "number" ? count(renewed) : null,
  });
  return {
    total: count(r.total),
    unmatched: count(r.unmatched),
    tooNew: count(r.too_new),
    pending: count(r.pending),
    engaged: group(engagedRate, r.engaged_leases, r.engaged_renewed),
    others: group(othersRate, r.others_leases, r.others_renewed),
  };
}

/** Footnotes under the tile, most important first. Empty when nothing to say. */
export function renewalNotes(s: RenewalSummary): string[] {
  const notes: string[] = [];
  if (s.unmatched > 0) notes.push(`${s.unmatched} of ${s.total} leases not matched to a resident`);
  if (s.tooNew > 0) {
    notes.push(
      `${s.tooNew} ${s.tooNew === 1 ? "lease" : "leases"} left out: less than ${ENGAGED_RULE.minHistoryWeeks} weeks of history before the lease ended`,
    );
  }
  if (s.pending > 0) notes.push(`${s.pending} still pending`);
  return notes;
}
