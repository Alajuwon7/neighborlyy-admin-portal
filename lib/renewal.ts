/**
 * Renewal rates — the Insights tile's rules and display helpers.
 *
 * Lease outcomes come from the PM's rent-roll uploads (lease_records, portal
 * migration 036), copied by a trigger into a locked ledger. The tile reads
 * get_lease_renewal_snapshot (Miyora 20261111120100), a MONTHLY snapshot: only
 * leases recorded before the 1st of this month count, the first final outcome
 * of each lease is locked, and each unit counts once per 12-month period. It
 * returns three rounded rates and a size band, never exact group counts: a PM
 * who could watch exact numbers move could learn one household's group.
 *
 * Three groups, compared side by side (a comparison, not a cause):
 *  - took part: a resident in the unit took part (posted, commented, asked for
 *    help, RSVPed, answered a survey or used Connect) in enough weeks before
 *    the lease ended — the same actions as the Weekly Summary;
 *  - didn't take part: a resident is on Miyora but didn't, enough;
 *  - not on Miyora: no resident account matches the unit (also vacant units,
 *    unit-number mismatches, deleted accounts).
 */

/**
 * "Took part" rule, fixed in SQL (v_min_weeks / v_window / v_min_history in
 * get_lease_renewal_snapshot) — keep in sync. PRORATED: judged on the weeks
 * since the resident joined, up to `windowWeeks`, needing `minWeeks` per
 * `windowWeeks` of those (3 of 12 = a quarter, rounded up, at least 1). Under
 * `minHistoryWeeks` weeks the lease is "too new" and left out.
 */
export const ENGAGED_RULE = { minWeeks: 3, windowWeeks: 12, minHistoryWeeks: 4 } as const;

/**
 * Privacy floor: every group needs at least this many households (one lease
 * per unit, so leases = households) or all three rates are hidden.
 * Enforced in SQL (v_floor) — keep in sync.
 */
export const MIN_GROUP_UNITS = 5;

/** Sample-size bands the database returns (wide on purpose). */
const SIZE_BANDS: Record<string, string> = { "15-29": "15–29", "30-99": "30–99", "100+": "100+" };

/** One row from get_lease_renewal_snapshot. */
export type RenewalSnapshotRow = {
  snapshot_date: string; // YYYY-MM-DD, the 1st of this month
  period_from: string;
  period_to: string;
  leases_seen: boolean;
  in_period: number;
  repeats: number;
  pending: number;
  too_new: number;
  took_part_rate: number | null;
  others_rate: number | null;
  not_on_miyora_rate: number | null;
  size_band: string | null;
};

export type RenewalRates = { tookPart: number; others: number; notOnMiyora: number };

export type RenewalSnapshot = {
  snapshotDate: string;
  periodFrom: string;
  periodTo: string;
  /** Any lease recorded before this month's snapshot. */
  leasesSeen: boolean;
  inPeriod: number;
  repeats: number;
  pending: number;
  tooNew: number;
  /** All three or none: null when any group is under the floor. */
  rates: RenewalRates | null;
  /** "15–29" etc., present exactly when rates are. */
  sizeBand: string | null;
};

const count = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
/** 0–100 in steps of 5, as the database rounds; anything else is dropped. */
const rate = (n: unknown): number | null =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100 && n % 5 === 0 ? n : null;
const isoDate = (s: unknown): string => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

/** Shape the database row for the tile; defensive about nulls and odd values. */
export function toRenewalSnapshot(row: Partial<RenewalSnapshotRow> | null | undefined): RenewalSnapshot {
  const r = row ?? {};
  const t = rate(r.took_part_rate), o = rate(r.others_rate), u = rate(r.not_on_miyora_rate);
  const band = typeof r.size_band === "string" ? (SIZE_BANDS[r.size_band] ?? null) : null;
  // All or nothing: one group's rate alone (or a rate without its band) never shows.
  const shown = t !== null && o !== null && u !== null && band !== null;
  return {
    snapshotDate: isoDate(r.snapshot_date),
    periodFrom: isoDate(r.period_from),
    periodTo: isoDate(r.period_to),
    leasesSeen: r.leases_seen === true,
    inPeriod: count(r.in_period),
    repeats: count(r.repeats),
    pending: count(r.pending),
    tooNew: count(r.too_new),
    rates: shown ? { tookPart: t, others: o, notOnMiyora: u } : null,
    sizeBand: shown ? band : null,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "Nov 2025 – Oct 2026"; "" when the dates are missing. */
export function formatPeriod(from: string, to: string): string {
  return from && to ? `${monthYear(from)} – ${monthYear(to)}` : "";
}

/** The next monthly update after a snapshot dated YYYY-MM-01: "1 Dec". */
export function nextUpdate(snapshotDate: string): string {
  if (!snapshotDate) return "the 1st of next month";
  const m = Number(snapshotDate.slice(5, 7)) % 12; // 0-based index of the next month
  return `1 ${MONTHS[m]}`;
}

/** Footnotes under the tile, most important first. Empty when nothing to say. */
export function renewalNotes(s: RenewalSnapshot): string[] {
  const notes: string[] = [];
  if (s.tooNew > 0) {
    notes.push(
      `${s.tooNew} ${s.tooNew === 1 ? "lease" : "leases"} left out: less than ${ENGAGED_RULE.minHistoryWeeks} weeks of history before the lease ended`,
    );
  }
  if (s.pending > 0) notes.push(`${s.pending} still pending`);
  if (s.repeats > 0) {
    notes.push(`${s.repeats} more ${s.repeats === 1 ? "lease" : "leases"} for the same unit not counted (one per unit)`);
  }
  return notes;
}
