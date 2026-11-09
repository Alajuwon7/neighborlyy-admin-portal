/**
 * Renewal rate by engagement — pure helpers for the Insights tile.
 *
 * Lease outcomes come from the PM's rent-roll uploads (lease_records, portal
 * migration 036). Per-lease engagement comes from get_lease_engagement (Miyora
 * 20261109120000), which returns, for each lease, whether any resident of that
 * unit could be matched and in how many of the weeks before the lease end they
 * did something countable — the full action list of
 * internal.resident_action_user_ids (posts, comments, likes, RSVPs, bookings,
 * marketplace, help requests, survey answers, Connect requests). App opens do
 * not count. No names or units ever reach this module.
 *
 * "Engaged" here is its own definition, deliberately not called "took part"
 * (Weekly Summary) or "active" (Insights) so the three never get confused.
 */

/**
 * A lease counts as "engaged" when its resident(s) did something countable in
 * at least `minWeeks` of the `windowWeeks` completed ISO weeks (Mon–Sun, UTC)
 * before the week the lease ended. Tune here; windowWeeks is also sent to the
 * database so both sides use the same window.
 */
export const ENGAGED_RULE = { minWeeks: 3, windowWeeks: 12 } as const;

/**
 * Privacy floor: a group with fewer decided leases than this shows "Not enough
 * leases yet" instead of a rate, so a PM can't work back to one household.
 */
export const MIN_GROUP_LEASES = 5;

export type LeaseEngagementRow = {
  lease_id: string;
  lease_end_date: string; // YYYY-MM-DD
  outcome: "renewed" | "moved_out" | "pending";
  /** A current resident profile in this unit joined before the lease ended. */
  matched: boolean;
  /** The community existed for the whole window, so a low count is real, not missing history. */
  history_complete: boolean;
  /** Weeks in the window with at least one countable action; null when unmatched. */
  weeks_took_part: number | null;
};

export type GroupStat = {
  /** Renewed + moved out (pending excluded). */
  leases: number;
  renewed: number;
  /** 0–100, or null when suppressed (fewer than MIN_GROUP_LEASES). */
  rate: number | null;
};

export type RenewalSummary = {
  /** Leases that ended in the range. */
  total: number;
  unmatched: number;
  /** Matched, but the community is too new for a full window — left out. */
  tooNew: number;
  pending: number;
  engaged: GroupStat;
  others: GroupStat;
};

export function isEngaged(weeksTookPart: number, rule: { minWeeks: number } = ENGAGED_RULE): boolean {
  return weeksTookPart >= rule.minWeeks;
}

function group(rows: LeaseEngagementRow[]): GroupStat {
  const renewed = rows.filter((r) => r.outcome === "renewed").length;
  const leases = rows.length;
  return {
    leases,
    renewed,
    rate: leases >= MIN_GROUP_LEASES ? Math.round((renewed / leases) * 100) : null,
  };
}

/**
 * Leases whose end date is in [start, end] (UTC dates; start null = all
 * time). The database already filters by range; this repeats it so the tile
 * never counts a stray row.
 */
export function summarizeRenewals(
  rows: LeaseEngagementRow[],
  start: Date | null,
  end: Date,
): RenewalSummary {
  const from = start ? start.toISOString().slice(0, 10) : null;
  const to = end.toISOString().slice(0, 10);
  const inRange = rows.filter((r) => (from === null || r.lease_end_date >= from) && r.lease_end_date <= to);

  const unmatched = inRange.filter((r) => !r.matched);
  const matched = inRange.filter((r) => r.matched);
  const tooNew = matched.filter((r) => !r.history_complete);
  const usable = matched.filter((r) => r.history_complete);
  const pending = usable.filter((r) => r.outcome === "pending");
  const decided = usable.filter((r) => r.outcome !== "pending");

  return {
    total: inRange.length,
    unmatched: unmatched.length,
    tooNew: tooNew.length,
    pending: pending.length,
    engaged: group(decided.filter((r) => isEngaged(r.weeks_took_part ?? 0))),
    others: group(decided.filter((r) => !isEngaged(r.weeks_took_part ?? 0))),
  };
}

/** Footnotes under the tile, most important first. Empty when nothing to say. */
export function renewalNotes(s: RenewalSummary): string[] {
  const notes: string[] = [];
  if (s.unmatched > 0) notes.push(`${s.unmatched} of ${s.total} leases not matched to a resident`);
  if (s.tooNew > 0) {
    notes.push(
      `${s.tooNew} ${s.tooNew === 1 ? "lease" : "leases"} left out: the community is newer than ${ENGAGED_RULE.windowWeeks} weeks before ${s.tooNew === 1 ? "its" : "their"} end date`,
    );
  }
  if (s.pending > 0) notes.push(`${s.pending} still pending`);
  return notes;
}
