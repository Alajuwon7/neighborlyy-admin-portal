import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ENGAGED_RULE,
  MIN_GROUP_UNITS,
  formatPeriod,
  nextUpdate,
  renewalNotes,
  toRenewalSnapshot,
  type RenewalSnapshotRow,
} from "../../lib/renewal";
import {
  leaseWarnings,
  normalizeUnit,
  toRecordedLeases,
  parseCsv,
  parseLeaseDate,
  parseOutcome,
  parseRentRoll,
  reportMonthStart,
  validateLeaseRows,
} from "../../lib/rent-roll";

// The 3-of-12 grouping, the under-5 floor, the snapshot, locking, rounding,
// size bands and unit matching run in SQL (get_lease_renewal_snapshot, Miyora
// 20261111120100) so per-lease engagement never leaves
// the database. Their edge cases are in supabase/tests/renewal/check.sql
// (run: scripts/test-renewal-sql.sh). This file covers what the portal does
// with the result, and the CSV parser.

const NOW = new Date(Date.UTC(2026, 10, 9, 15)); // 2026-11-09

const row = (over: Partial<RenewalSnapshotRow> = {}): RenewalSnapshotRow => ({
  snapshot_date: "2026-11-01",
  period_from: "2025-11-01",
  period_to: "2026-10-31",
  leases_seen: true,
  in_period: 40,
  repeats: 0,
  pending: 0,
  too_new: 0,
  took_part_rate: 85,
  others_rate: 60,
  not_on_miyora_rate: 55,
  size_band: "30-99",
  ...over,
});

// ─── Rule constants ─────────────────────────────────────────────────────────

test("rule constant is 3 of 12 with 4 weeks minimum; floor is 5 households", () => {
  assert.deepEqual(ENGAGED_RULE, { minWeeks: 3, windowWeeks: 12, minHistoryWeeks: 4 });
  assert.equal(MIN_GROUP_UNITS, 5);
});

// ─── Snapshot on the tile ───────────────────────────────────────────────────

test("all three groups over the floor: three rates and a size band, no counts", () => {
  const s = toRenewalSnapshot(row());
  assert.deepEqual(s.rates, { tookPart: 85, others: 60, notOnMiyora: 55 });
  assert.equal(s.sizeBand, "30–99");
  assert.ok(!("leases" in s) && !("renewed" in s));
});

test("one rate missing hides all three and the band", () => {
  for (const k of ["took_part_rate", "others_rate", "not_on_miyora_rate", "size_band"] as const) {
    const s = toRenewalSnapshot(row({ [k]: null }));
    assert.equal(s.rates, null, k);
    assert.equal(s.sizeBand, null, k);
  }
});

test("unrounded, out-of-range or odd values never reach the tile", () => {
  assert.equal(toRenewalSnapshot(row({ took_part_rate: 83 })).rates, null); // not a multiple of 5
  assert.equal(toRenewalSnapshot(row({ others_rate: 140 })).rates, null);
  assert.equal(toRenewalSnapshot(row({ size_band: "41" })).rates, null); // unknown band
  const s = toRenewalSnapshot(row({ pending: -3, too_new: Number.NaN, snapshot_date: "soon" }));
  assert.equal(s.pending, 0);
  assert.equal(s.tooNew, 0);
  assert.equal(s.snapshotDate, "");
  const empty = toRenewalSnapshot(null);
  assert.equal(empty.rates, null);
  assert.equal(empty.leasesSeen, false);
});

test("period and next update read as months", () => {
  assert.equal(formatPeriod("2025-11-01", "2026-10-31"), "Nov 2025 – Oct 2026");
  assert.equal(formatPeriod("", "2026-10-31"), "");
  assert.equal(nextUpdate("2026-11-01"), "1 Dec");
  assert.equal(nextUpdate("2026-12-01"), "1 Jan");
  assert.equal(nextUpdate(""), "the 1st of next month");
});

test("too-new, pending and repeat leases are noted; no notes when there's nothing to say", () => {
  const notes = renewalNotes(toRenewalSnapshot(row({ too_new: 1, pending: 3, repeats: 2 })));
  assert.deepEqual(notes, [
    "1 lease left out: less than 4 weeks of history before the lease ended",
    "3 still pending",
    "2 more leases for the same unit not counted (one per unit)",
  ]);
  assert.deepEqual(renewalNotes(toRenewalSnapshot(row())), []);
});

test("tile copy is a comparison and never claims Miyora causes renewals", () => {
  // Comments stripped: only what can render is checked.
  const src = readFileSync(path.join(__dirname, "../../components/insights/RenewalTile.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /Renewal rates for residents who took part, residents who didn&apos;t, and households not on Miyora\./);
  assert.doesNotMatch(src, /\b(caus|driv|boost|increas|improv|lift)\w*/i);
});

// ─── Upload preview: repeats and locked outcomes ────────────────────────────

test("a second lease for the same unit within 12 months is flagged, not dropped", () => {
  const recorded = toRecordedLeases([{ unit: "204", lease_end_date: "2026-03-31", outcome: "moved_out" }]);
  const w = leaseWarnings(
    [
      { unit: "204", lease_end_date: "2026-10-15", outcome: "renewed" },
      { unit: "205", lease_end_date: "2026-10-15", outcome: "renewed" },
    ],
    recorded,
  );
  assert.deepEqual(w, [
    {
      unit: "204",
      lease_end_date: "2026-10-15",
      message:
        "Unit 204 already has a lease ending 31 Mar 2026, within 12 months of this one. Only the first is used while both are in the 12-month period.",
    },
  ]);
});

test("inside one file the earlier end date wins; 12 months apart or more is fine", () => {
  const w = leaseWarnings(
    [
      { unit: "7", lease_end_date: "2026-09-30", outcome: "renewed" },
      { unit: "7", lease_end_date: "2026-01-31", outcome: "moved_out" },
      { unit: "8", lease_end_date: "2025-10-15", outcome: "moved_out" },
      { unit: "8", lease_end_date: "2026-10-15", outcome: "renewed" }, // exactly 12 months
    ],
    [],
  );
  assert.equal(w.length, 1);
  assert.equal(w[0].lease_end_date, "2026-09-30");
  assert.match(w[0].message, /ending 31 Jan 2026/);
});

test("changing a recorded final outcome is flagged; resolving a pending one is not", () => {
  const recorded = toRecordedLeases([
    { unit: "201", lease_end_date: "2026-10-15", outcome: "renewed" },
    { unit: "205", lease_end_date: "2026-10-15", outcome: "pending" },
  ]);
  const w = leaseWarnings(
    [
      { unit: "201", lease_end_date: "2026-10-15", outcome: "moved_out" },
      { unit: "205", lease_end_date: "2026-10-15", outcome: "moved_out" },
    ],
    recorded,
  );
  assert.equal(w.length, 1);
  assert.match(w[0].message, /^Unit 201's lease ending 15 Oct 2026 is already recorded as renewed\./);
  // Re-uploading the same outcome is quiet.
  assert.deepEqual(leaseWarnings([{ unit: "201", lease_end_date: "2026-10-15", outcome: "renewed" }], recorded), []);
});

test("recorded leases from the database are read defensively", () => {
  assert.deepEqual(toRecordedLeases(null), []);
  assert.deepEqual(
    toRecordedLeases([{ unit: "1", lease_end_date: "2026-01-01", outcome: "renewed" }, { unit: 2 }, "x", { unit: "3", lease_end_date: "2026-01-01", outcome: "gone" }]),
    [{ unit: "1", lease_end_date: "2026-01-01", outcome: "renewed" }],
  );
});

// ─── CSV parser ─────────────────────────────────────────────────────────────

test("sample rent roll: valid rows read, bad rows rejected with row numbers", () => {
  const text = readFileSync(path.join(__dirname, "../../docs/samples/rent-roll-sample.csv"), "utf8");
  const r = parseRentRoll(text, NOW);
  assert.ok(r.ok);
  assert.deepEqual(r.columns, { unit: "Unit #", leaseEnd: "Lease Expiration", outcome: "Renewal Status" });
  assert.deepEqual(r.rows, [
    { unit: "101", lease_end_date: "2026-03-31", outcome: "renewed" },
    { unit: "102", lease_end_date: "2026-03-31", outcome: "moved_out" },
    { unit: "103", lease_end_date: "2026-04-30", outcome: "renewed" },
    { unit: "104", lease_end_date: "2026-04-30", outcome: "pending" },
    { unit: "105B", lease_end_date: "2026-05-31", outcome: "moved_out" },
    { unit: "106", lease_end_date: "2026-05-31", outcome: "pending" },
    { unit: "108", lease_end_date: "2026-05-31", outcome: "renewed", monthToMonth: true },
  ]);
  assert.deepEqual(
    r.rejected.map((x) => x.row),
    [8, 9, 11, 12, 13],
  );
  assert.match(r.rejected[0].error, /Unit is missing/);
  assert.match(r.rejected[1].error, /isn't a date/);
  assert.match(r.rejected[2].error, /Same unit and lease end as row 2/);
  assert.match(r.rejected[3].error, /2062/);
  assert.match(r.rejected[4].error, /Notice/);
  // Names never make it into the result.
  assert.doesNotMatch(JSON.stringify(r), /Example|Casey|Stayed On|Odd Outcome/);
});

test("missing required columns is a file-level error", () => {
  const r = parseRentRoll("Resident,Lease End\nJo,2026-01-31\n", NOW);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /unit column/);
  assert.equal(parseRentRoll("", NOW).ok, false);
});

test("plain Status is not read as the outcome; move-out date is a fallback end column", () => {
  const r = parseRentRoll("Unit,Move-out Date,Status\n1,2026-02-28,Current\n", NOW);
  assert.ok(r.ok);
  assert.equal(r.columns.outcome, null);
  assert.deepEqual(r.rows, [{ unit: "1", lease_end_date: "2026-02-28", outcome: "pending" }]);
});

test("row numbers survive blank lines and quoted newlines", () => {
  const r = parseRentRoll('Unit,Lease End\n\n"1\n",2026-01-31\n2,nope\n', NOW);
  assert.ok(r.ok);
  assert.deepEqual(r.rejected, [{ row: 4, error: '"nope" isn\'t a date (use YYYY-MM-DD or MM/DD/YYYY)' }]);
});

test("csv: quotes, escaped quotes, CRLF and BOM", () => {
  assert.deepEqual(parseCsv('﻿a,"b,""c"""\r\n1,2'), [["a", 'b,"c"'], ["1", "2"]]);
});

test("unit normalisation", () => {
  assert.equal(normalizeUnit(" Apt 0101 "), "101");
  assert.equal(normalizeUnit("Unit #4b"), "4B");
  assert.equal(normalizeUnit("4-B"), "4B");
  assert.equal(normalizeUnit("Apartment 12"), "12");
  assert.equal(normalizeUnit("000"), "0");
  assert.equal(normalizeUnit("#"), "");
  // The prefix must be a whole word, and the result is stable when re-applied
  // (the database CHECK requires unit = normalize_unit(unit)).
  assert.equal(normalizeUnit("Stewart 1"), "STEWART1");
  assert.equal(normalizeUnit("APT4B"), "APT4B");
  for (const raw of ["Apt Ste 4", "0APT1", "Apt Apt 4", "Unit-07", "Suite.3"]) {
    const once = normalizeUnit(raw);
    assert.equal(normalizeUnit(once), once, raw);
  }
});

test("dates: ISO, US month-first, 2-digit years; impossible dates rejected", () => {
  assert.equal(parseLeaseDate("2026-03-31"), "2026-03-31");
  assert.equal(parseLeaseDate("2026/3/1"), "2026-03-01");
  assert.equal(parseLeaseDate("3/31/2026"), "2026-03-31");
  assert.equal(parseLeaseDate("03/31/26"), "2026-03-31");
  assert.equal(parseLeaseDate("2026-03-31T00:00:00"), "2026-03-31");
  assert.equal(parseLeaseDate("2/30/2026"), null);
  assert.equal(parseLeaseDate("31/05/2026"), null);
  assert.equal(parseLeaseDate("March 31"), null);
});

test("outcomes: synonyms, blank = pending, unknown = null", () => {
  assert.equal(parseOutcome("Renewal Signed"), "renewed");
  assert.equal(parseOutcome("NON-RENEWAL"), "moved_out");
  assert.equal(parseOutcome("  "), "pending");
  assert.equal(parseOutcome("Notice"), null);
  assert.equal(parseOutcome("constructor"), null);
});

test("month-to-month is saved as renewed, flagged for the preview only", () => {
  for (const v of ["Month-to-month", "MTM", "month to month", "Holdover"]) assert.equal(parseOutcome(v), "renewed", v);
  const r = parseRentRoll("Unit,Lease End,Renewal Outcome\n101,2026-03-31,Month-to-month\n102,2026-03-31,Renewed\n", NOW);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.rejected, []);
  assert.deepEqual(r.rows, [
    { unit: "101", lease_end_date: "2026-03-31", outcome: "renewed", monthToMonth: true },
    { unit: "102", lease_end_date: "2026-03-31", outcome: "renewed" },
  ]);
  // The server rebuilds rows from unit / date / outcome only, so the flag is never stored.
  assert.deepEqual(validateLeaseRows(r.rows, NOW), [
    { unit: "101", lease_end_date: "2026-03-31", outcome: "renewed" },
    { unit: "102", lease_end_date: "2026-03-31", outcome: "renewed" },
  ]);
});

test("ISO and US month-first dates are both read", () => {
  assert.equal(parseLeaseDate("2026-11-10"), "2026-11-10");
  assert.equal(parseLeaseDate("11/10/2026"), "2026-11-10");
});

test("server re-validation rejects anything the parser wouldn't produce", () => {
  const good = [{ unit: "4B", lease_end_date: "2026-03-31", outcome: "renewed" }];
  assert.deepEqual(validateLeaseRows(good, NOW), good);
  assert.equal(validateLeaseRows([{ ...good[0], unit: "apt 4b" }], NOW), null);
  assert.equal(validateLeaseRows([{ ...good[0], lease_end_date: "2026-02-30" }], NOW), null);
  assert.equal(validateLeaseRows([{ ...good[0], outcome: "maybe" }], NOW), null);
  assert.equal(validateLeaseRows([good[0], good[0]], NOW), null);
  assert.equal(validateLeaseRows("nope", NOW), null);
});

test("report month must be a real YYYY-MM", () => {
  assert.equal(reportMonthStart("2026-11"), "2026-11-01");
  assert.equal(reportMonthStart("2026-13"), null);
  assert.equal(reportMonthStart("2026-1"), null);
});
