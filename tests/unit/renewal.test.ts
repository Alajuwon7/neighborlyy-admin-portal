import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ENGAGED_RULE,
  MIN_GROUP_UNITS,
  rangePhrase,
  renewalNotes,
  toRenewalSummary,
  type RenewalSummaryRow,
} from "../../lib/renewal";
import {
  normalizeUnit,
  parseCsv,
  parseLeaseDate,
  parseOutcome,
  parseRentRoll,
  reportMonthStart,
  validateLeaseRows,
} from "../../lib/rent-roll";

// The 3-of-12 grouping, the under-5 floor, the date range and unit matching
// run in SQL (get_lease_renewal_summary) so per-lease engagement never leaves
// the database. Their edge cases are in supabase/tests/renewal/check.sql
// (run: scripts/test-renewal-sql.sh). This file covers what the portal does
// with the result, and the CSV parser.

const NOW = new Date(Date.UTC(2026, 10, 9, 15)); // 2026-11-09

const row = (over: Partial<RenewalSummaryRow> = {}): RenewalSummaryRow => ({
  total: 90,
  unmatched: 0,
  too_new: 0,
  pending: 0,
  engaged_rate: 83,
  others_rate: 57,
  engaged_leases: 41,
  engaged_renewed: 34,
  others_leases: 37,
  others_renewed: 21,
  ...over,
});

// ─── Rule constants ─────────────────────────────────────────────────────────

test("rule constant is 3 of 12, inside the window band the database accepts", () => {
  assert.deepEqual(ENGAGED_RULE, { minWeeks: 3, windowWeeks: 12 });
  assert.ok(ENGAGED_RULE.windowWeeks >= 8 && ENGAGED_RULE.windowWeeks <= 26);
  assert.ok(ENGAGED_RULE.minWeeks >= 1 && ENGAGED_RULE.minWeeks <= ENGAGED_RULE.windowWeeks);
  assert.equal(MIN_GROUP_UNITS, 5);
});

// ─── Suppression on the tile ────────────────────────────────────────────────

test("both groups over the floor: rates and counts shown", () => {
  const s = toRenewalSummary(row());
  assert.deepEqual(s.engaged, { rate: 83, leases: 41, renewed: 34 });
  assert.deepEqual(s.others, { rate: 57, leases: 37, renewed: 21 });
});

test("one group under the floor: its rate is blank and NEITHER group shows counts", () => {
  // Counts withheld even if a value slips through, or the small group's size
  // follows by subtraction from the totals.
  const s = toRenewalSummary(row({ engaged_rate: null, engaged_leases: 4, engaged_renewed: 4 }));
  assert.deepEqual(s.engaged, { rate: null, leases: null, renewed: null });
  assert.deepEqual(s.others, { rate: 57, leases: null, renewed: null });
});

test("both under the floor: nothing but blanks", () => {
  const s = toRenewalSummary(row({ engaged_rate: null, others_rate: null }));
  assert.equal(s.engaged.rate, null);
  assert.equal(s.others.rate, null);
  assert.equal(s.others.leases, null);
});

test("odd values from the database never reach the tile", () => {
  const s = toRenewalSummary(row({ engaged_rate: 140, total: -3, unmatched: Number.NaN }));
  assert.equal(s.engaged.rate, null);
  assert.equal(s.engaged.leases, null);
  assert.equal(s.total, 0);
  assert.equal(s.unmatched, 0);
  assert.deepEqual(toRenewalSummary(null).engaged, { rate: null, leases: null, renewed: null });
});

// ─── Unmatched / too new / pending notes ────────────────────────────────────

test("unmatched leases are noted against the total", () => {
  const notes = renewalNotes(toRenewalSummary(row({ total: 140, unmatched: 12 })));
  assert.equal(notes[0], "12 of 140 leases not matched to a resident");
});

test("too-new and pending leases are noted; no notes when there's nothing to say", () => {
  const notes = renewalNotes(toRenewalSummary(row({ too_new: 1, pending: 3 })));
  assert.deepEqual(notes, [
    "1 lease left out: less than 12 weeks of history before the lease ended",
    "3 still pending",
  ]);
  assert.deepEqual(renewalNotes(toRenewalSummary(row())), []);
});

test("range phrase reads naturally for all time", () => {
  assert.equal(rangePhrase("90 days"), "in the last 90 days");
  assert.equal(rangePhrase("all time"), "at any time");
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
  ]);
  assert.deepEqual(
    r.rejected.map((x) => x.row),
    [8, 9, 10, 11, 12],
  );
  assert.match(r.rejected[0].error, /Unit is missing/);
  assert.match(r.rejected[1].error, /isn't a date/);
  assert.match(r.rejected[2].error, /Month-to-month/);
  assert.match(r.rejected[3].error, /Same unit and lease end as row 2/);
  assert.match(r.rejected[4].error, /2062/);
  // Names never make it into the result.
  assert.doesNotMatch(JSON.stringify(r), /Example|Casey/);
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
