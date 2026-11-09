import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ENGAGED_RULE,
  MIN_GROUP_LEASES,
  isEngaged,
  renewalNotes,
  summarizeRenewals,
  type LeaseEngagementRow,
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

const NOW = new Date(Date.UTC(2026, 10, 9, 15)); // 2026-11-09
const START = new Date(Date.UTC(2026, 7, 11)); // 2026-08-11 (90 days back)

let n = 0;
const lease = (over: Partial<LeaseEngagementRow> = {}): LeaseEngagementRow => ({
  lease_id: `l${++n}`,
  lease_end_date: "2026-10-01",
  outcome: "renewed",
  matched: true,
  history_complete: true,
  weeks_took_part: 5,
  ...over,
});
const many = (count: number, over: Partial<LeaseEngagementRow>) => Array.from({ length: count }, () => lease(over));

// ─── The 3-of-12 rule ───────────────────────────────────────────────────────

test("rule constant is 3 of 12", () => {
  assert.deepEqual(ENGAGED_RULE, { minWeeks: 3, windowWeeks: 12 });
});

test("engaged at exactly minWeeks, not one below; the window max counts", () => {
  assert.equal(isEngaged(2), false);
  assert.equal(isEngaged(3), true);
  assert.equal(isEngaged(12), true);
  assert.equal(isEngaged(0), false);
});

test("leases split into engaged / others at the 3-week edge", () => {
  const s = summarizeRenewals(
    [
      ...many(5, { weeks_took_part: 3, outcome: "renewed" }),
      ...many(5, { weeks_took_part: 2, outcome: "moved_out" }),
    ],
    START,
    NOW,
  );
  assert.deepEqual(s.engaged, { leases: 5, renewed: 5, rate: 100 });
  assert.deepEqual(s.others, { leases: 5, renewed: 0, rate: 0 });
});

test("rates round to whole percents", () => {
  const s = summarizeRenewals(
    [...many(2, { outcome: "renewed" }), ...many(1, { outcome: "moved_out" }), ...many(3, { outcome: "renewed" })],
    START,
    NOW,
  );
  assert.equal(s.engaged.rate, 83); // 5 of 6
});

// ─── Under-5 suppression ────────────────────────────────────────────────────

test("a group under MIN_GROUP_LEASES has no rate; at the floor it does", () => {
  assert.equal(MIN_GROUP_LEASES, 5);
  const s = summarizeRenewals(
    [...many(4, { weeks_took_part: 6 }), ...many(5, { weeks_took_part: 0, outcome: "moved_out" })],
    START,
    NOW,
  );
  assert.equal(s.engaged.rate, null);
  assert.equal(s.engaged.leases, 4);
  assert.equal(s.others.rate, 0);
});

test("pending leases don't count toward the floor or the rate", () => {
  const s = summarizeRenewals(
    [...many(4, { outcome: "renewed" }), ...many(3, { outcome: "pending" })],
    START,
    NOW,
  );
  assert.equal(s.engaged.leases, 4);
  assert.equal(s.engaged.rate, null);
  assert.equal(s.pending, 3);
});

// ─── Range ──────────────────────────────────────────────────────────────────

test("leases outside the range are ignored; both ends are inclusive", () => {
  const s = summarizeRenewals(
    [
      lease({ lease_end_date: "2026-08-10" }), // day before start
      lease({ lease_end_date: "2026-08-11" }), // start
      lease({ lease_end_date: "2026-11-09" }), // today
      lease({ lease_end_date: "2026-11-10" }), // future
    ],
    START,
    NOW,
  );
  assert.equal(s.total, 2);
});

test("all time (null start) keeps every past lease", () => {
  const s = summarizeRenewals([lease({ lease_end_date: "2019-01-31" }), lease({ lease_end_date: "2027-01-31" })], null, NOW);
  assert.equal(s.total, 1);
});

// ─── Unmatched and too-new leases ───────────────────────────────────────────

test("unmatched leases are counted, kept out of both groups, and noted", () => {
  const s = summarizeRenewals(
    [...many(12, { matched: false, weeks_took_part: null }), ...many(128, { weeks_took_part: 4 })],
    START,
    NOW,
  );
  assert.equal(s.total, 140);
  assert.equal(s.unmatched, 12);
  assert.equal(s.engaged.leases, 128);
  assert.equal(s.others.leases, 0);
  assert.equal(renewalNotes(s)[0], "12 of 140 leases not matched to a resident");
});

test("matched leases without full history are left out and noted", () => {
  const s = summarizeRenewals(
    [lease({ history_complete: false, weeks_took_part: null }), ...many(5, {})],
    START,
    NOW,
  );
  assert.equal(s.tooNew, 1);
  assert.equal(s.engaged.leases, 5);
  assert.match(renewalNotes(s).join(" "), /1 lease left out/);
});

test("no notes when everything matched and decided", () => {
  assert.deepEqual(renewalNotes(summarizeRenewals(many(5, {}), START, NOW)), []);
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
