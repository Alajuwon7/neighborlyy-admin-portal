/**
 * Rent-roll CSV parsing — pure, shared by the upload preview (browser) and the
 * save action (server re-validates every row before it reaches the database).
 *
 * Only three things are kept from a rent roll: unit, lease end date and the
 * renewal outcome. Tenant names, rents, emails etc. are never read into the
 * result, so they never leave the PM's browser.
 *
 * Column template and accepted values: docs/rent-roll-csv-template.md.
 */

export const LEASE_OUTCOMES = ["renewed", "moved_out", "pending"] as const;
export type LeaseOutcome = (typeof LEASE_OUTCOMES)[number];

export type LeaseRow = {
  /** Normalised with normalizeUnit — the same rule the database uses to match profiles. */
  unit: string;
  /** YYYY-MM-DD (UTC calendar date). */
  lease_end_date: string;
  outcome: LeaseOutcome;
  /** Preview only: the file said month-to-month, saved as renewed. Never sent to the server. */
  monthToMonth?: true;
};

export type RejectedRow = {
  /** 1-based row number in the file, counting the header as row 1 (a quoted field may span lines). */
  row: number;
  error: string;
};

export type RentRollParse =
  | { ok: false; error: string }
  | { ok: true; rows: LeaseRow[]; rejected: RejectedRow[]; columns: { unit: string; leaseEnd: string; outcome: string | null } };

/** Hard cap per upload — well above any single community's rent roll. */
export const MAX_ROWS = 5000;

// ─── Units ──────────────────────────────────────────────────────────────────

/**
 * "Apt 04B" / "Unit #4b" / "4-B" → "4B". Uppercase, drop a leading
 * Apartment/Apt/Unit/Suite/Ste word, drop everything that isn't a letter or
 * digit, drop leading zeros (keeping a lone "0").
 *
 * KEEP IN SYNC with internal.normalize_unit() in supabase/migrations/
 * 036_lease_records.sql — lease_records enforces it and get_lease_renewal_snapshot
 * matches profiles.unit_number with it.
 */
export function normalizeUnit(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^(APARTMENT|APT|UNIT|SUITE|STE)\b\.?\s*/, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+(?=.)/, "");
}

// ─── Dates ──────────────────────────────────────────────────────────────────

function isoFromParts(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD, YYYY/MM/DD, or US M/D/YYYY and M/D/YY (20YY). Day-first dates
 * are not accepted: property-management exports in the US are month-first, and
 * guessing would silently swap day and month.
 */
export function parseLeaseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (m) return isoFromParts(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return isoFromParts(year, +m[1], +m[2]);
  }
  return null;
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

const OUTCOME_WORDS: Record<string, LeaseOutcome> = {
  renewed: "renewed",
  renewal: "renewed",
  renew: "renewed",
  renewalsigned: "renewed",
  signedrenewal: "renewed",
  movedout: "moved_out",
  moveout: "moved_out",
  vacated: "moved_out",
  notrenewed: "moved_out",
  nonrenewal: "moved_out",
  didnotrenew: "moved_out",
  pending: "pending",
  undecided: "pending",
  open: "pending",
};

/**
 * Month-to-month means the resident stayed past the lease end — the retention
 * outcome the renewal tile measures — so it is saved as renewed.
 */
const MONTH_TO_MONTH_WORDS = new Set(["monthtomonth", "mtm", "monthly", "holdover"]);

const outcomeKey = (raw: string | undefined) => (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** True when the outcome cell says month-to-month (saved as renewed). */
export function isMonthToMonth(raw: string | undefined): boolean {
  return MONTH_TO_MONTH_WORDS.has(outcomeKey(raw));
}

/** Blank → pending (the roll often leaves future decisions empty); month-to-month → renewed; unknown → null. */
export function parseOutcome(raw: string | undefined): LeaseOutcome | null {
  const key = outcomeKey(raw);
  if (key === "") return "pending";
  if (MONTH_TO_MONTH_WORDS.has(key)) return "renewed";
  return Object.prototype.hasOwnProperty.call(OUTCOME_WORDS, key) ? OUTCOME_WORDS[key] : null;
}

// ─── CSV ────────────────────────────────────────────────────────────────────

/** RFC 4180-ish: quoted fields, "" escapes, commas/newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

// Header spellings seen across property-management exports. First match wins,
// so more specific names come first.
const UNIT_HEADERS = ["unit", "unitnumber", "unitno", "unitid", "apt", "aptnumber", "apartment", "bldgunit", "space"];
const LEASE_END_HEADERS = [
  "leaseenddate", "leaseend", "leaseexpirationdate", "leaseexpiration", "leaseexpires",
  "leaseto", "expirationdate", "enddate",
];
// Only used when no lease-end column exists (some move-out reports).
const FALLBACK_END_HEADERS = ["moveoutdate", "moveout"];
// Not plain "Status"/"Lease Status": in most exports that's occupancy
// (Current / Notice / Vacant), not the renewal decision.
const OUTCOME_HEADERS = ["outcome", "renewaloutcome", "renewalstatus", "renewal"];

function findColumn(headers: string[], names: string[]): number {
  const keys = headers.map(headerKey);
  for (const name of names) {
    const i = keys.indexOf(name);
    if (i !== -1) return i;
  }
  return -1;
}

// A date this far out is almost certainly a typo (e.g. 2062 for 2026).
const MIN_YEAR = 2000;
const MAX_YEARS_AHEAD = 5;

export function parseRentRoll(text: string, now: Date = new Date()): RentRollParse {
  const isBlank = (r: string[]) => r.every((c) => c.trim() === "");
  const table = parseCsv(text);
  const headerIdx = table.findIndex((r) => !isBlank(r));
  if (headerIdx === -1) return { ok: false, error: "The file is empty." };

  const headers = table[headerIdx];
  const unitCol = findColumn(headers, UNIT_HEADERS);
  let endCol = findColumn(headers, LEASE_END_HEADERS);
  if (endCol === -1) endCol = findColumn(headers, FALLBACK_END_HEADERS);
  const outcomeCol = findColumn(headers, OUTCOME_HEADERS);
  if (unitCol === -1 || endCol === -1) {
    const missing = [unitCol === -1 ? "a unit column" : null, endCol === -1 ? "a lease end date column" : null]
      .filter(Boolean)
      .join(" and ");
    return { ok: false, error: `Couldn't find ${missing} in the first row. See the template for accepted column names.` };
  }

  // Keep each record's position in the file so errors point at the right row.
  const body = table
    .map((cells, i) => ({ cells, row: i + 1 }))
    .slice(headerIdx + 1)
    .filter((r) => !isBlank(r.cells));
  if (body.length > MAX_ROWS) {
    return { ok: false, error: `This file has ${body.length} rows; the limit is ${MAX_ROWS}. Split it and upload each part.` };
  }

  const maxYear = now.getUTCFullYear() + MAX_YEARS_AHEAD;
  const rows: LeaseRow[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Map<string, number>();

  for (const { cells, row } of body) {
    const reject = (error: string) => rejected.push({ row, error });
    const unit = normalizeUnit(cells[unitCol] ?? "");
    if (!unit) { reject("Unit is missing"); continue; }

    const rawEnd = (cells[endCol] ?? "").trim();
    if (!rawEnd) { reject("Lease end date is missing"); continue; }
    const end = parseLeaseDate(rawEnd);
    if (!end) { reject(`"${rawEnd}" isn't a date (use YYYY-MM-DD or MM/DD/YYYY)`); continue; }
    const year = +end.slice(0, 4);
    if (year < MIN_YEAR || year > maxYear) { reject(`Lease end year ${year} looks wrong`); continue; }

    const rawOutcome = outcomeCol === -1 ? "" : (cells[outcomeCol] ?? "");
    const outcome = parseOutcome(rawOutcome);
    if (!outcome) {
      reject(`Outcome "${rawOutcome.trim()}" isn't recognised (use renewed, moved out, month-to-month or pending)`);
      continue;
    }

    const key = `${unit}|${end}`;
    const first = seen.get(key);
    if (first !== undefined) { reject(`Same unit and lease end as row ${first}`); continue; }
    seen.set(key, row);
    rows.push(isMonthToMonth(rawOutcome) ? { unit, lease_end_date: end, outcome, monthToMonth: true } : { unit, lease_end_date: end, outcome });
  }

  return {
    ok: true,
    rows,
    rejected,
    columns: {
      unit: headers[unitCol].trim(),
      leaseEnd: headers[endCol].trim(),
      outcome: outcomeCol === -1 ? null : headers[outcomeCol].trim(),
    },
  };
}

/**
 * Server-side guard for rows coming back from the browser: same rules as
 * parseRentRoll, applied to already-parsed rows. Returns null when any row is
 * malformed — the action then refuses the whole upload.
 */
export function validateLeaseRows(input: unknown, now: Date = new Date()): LeaseRow[] | null {
  if (!Array.isArray(input) || input.length > MAX_ROWS) return null;
  const maxYear = now.getUTCFullYear() + MAX_YEARS_AHEAD;
  const seen = new Set<string>();
  const out: LeaseRow[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") return null;
    const { unit, lease_end_date, outcome } = r as Record<string, unknown>;
    if (typeof unit !== "string" || typeof lease_end_date !== "string" || typeof outcome !== "string") return null;
    const u = normalizeUnit(unit);
    if (!u || u !== unit) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lease_end_date) || parseLeaseDate(lease_end_date) !== lease_end_date) return null;
    const year = +lease_end_date.slice(0, 4);
    if (year < MIN_YEAR || year > maxYear) return null;
    if (!(LEASE_OUTCOMES as readonly string[]).includes(outcome)) return null;
    const key = `${u}|${lease_end_date}`;
    if (seen.has(key)) return null;
    seen.add(key);
    out.push({ unit: u, lease_end_date, outcome: outcome as LeaseOutcome });
  }
  return out;
}

/** "2026-03" → "2026-03-01"; null when not a real YYYY-MM. */
export function reportMonthStart(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return isoFromParts(+m[1], +m[2], 1);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-03-01" → "March 2026" (UTC). */
export function formatReportMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// ─── Already-recorded leases (upload preview warnings) ──────────────────────

/** A lease the database already holds (get_recorded_leases), outcome locked once final. */
export type RecordedLease = { unit: string; lease_end_date: string; outcome: LeaseOutcome };

/** A row that saves fine but may not count on the tile, and why. */
export type LeaseWarning = { unit: string; lease_end_date: string; message: string };

/** get_recorded_leases' jsonb → rows; anything malformed is dropped. */
export function toRecordedLeases(input: unknown): RecordedLease[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const { unit, lease_end_date, outcome } = r as Record<string, unknown>;
    if (typeof unit !== "string" || typeof lease_end_date !== "string" || typeof outcome !== "string") return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lease_end_date) || !(LEASE_OUTCOMES as readonly string[]).includes(outcome)) return [];
    return [{ unit, lease_end_date, outcome: outcome as LeaseOutcome }];
  });
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => `${+iso.slice(8, 10)} ${SHORT_MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const OUTCOME_WORD: Record<LeaseOutcome, string> = { renewed: "renewed", moved_out: "moved out", pending: "pending" };

/** a + 12 months, clamped like Postgres (29 Feb → 28 Feb). */
function plusYear(iso: string): string {
  const y = +iso.slice(0, 4) + 1, m = +iso.slice(5, 7), d = +iso.slice(8, 10);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${iso.slice(5, 7)}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
/** Strictly less than 12 months apart, so both can fall in one 12-month period. */
function within12Months(a: string, b: string): boolean {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return lo !== hi && hi < plusYear(lo);
}

/**
 * Rows that will save but not count, mirroring get_lease_renewal_snapshot:
 *  - one lease per unit per 12-month period, and the one recorded FIRST wins
 *    (already-recorded leases beat this file; inside the file, the earlier
 *    end date wins);
 *  - a final outcome, once recorded, is locked.
 */
export function leaseWarnings(rows: LeaseRow[], recorded: RecordedLease[]): LeaseWarning[] {
  const byUnit = new Map<string, RecordedLease[]>();
  for (const r of recorded) byUnit.set(r.unit, [...(byUnit.get(r.unit) ?? []), r]);
  const exact = new Map(recorded.map((r) => [`${r.unit}|${r.lease_end_date}`, r]));

  const warnings: LeaseWarning[] = [];
  const fresh: LeaseRow[] = []; // leases this file adds
  for (const row of rows) {
    const known = exact.get(`${row.unit}|${row.lease_end_date}`);
    if (!known) { fresh.push(row); continue; }
    if (known.outcome !== "pending" && known.outcome !== row.outcome) {
      warnings.push({
        unit: row.unit,
        lease_end_date: row.lease_end_date,
        message: `Unit ${row.unit}'s lease ending ${shortDate(row.lease_end_date)} is already recorded as ${OUTCOME_WORD[known.outcome]}. Recorded outcomes can't be changed here; contact Miyora support to correct one.`,
      });
    }
  }

  const sorted = [...fresh].sort((a, b) => a.lease_end_date.localeCompare(b.lease_end_date));
  for (const [i, row] of sorted.entries()) {
    const prior =
      (byUnit.get(row.unit) ?? []).find((r) => within12Months(r.lease_end_date, row.lease_end_date)) ??
      sorted.slice(0, i).find((r) => r.unit === row.unit && within12Months(r.lease_end_date, row.lease_end_date));
    if (prior) {
      warnings.push({
        unit: row.unit,
        lease_end_date: row.lease_end_date,
        message: `Unit ${row.unit} already has a lease ending ${shortDate(prior.lease_end_date)}, within 12 months of this one. Only the first is used while both are in the 12-month period.`,
      });
    }
  }
  return warnings;
}
