import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatWait,
  lastWeeks,
  medianWaitHours,
  monthlyDecisions,
  parseRange,
  rangeStart,
  summarizeDecisions,
  type DecisionRow,
} from "../../lib/insights";

const NOW = new Date(Date.UTC(2026, 8, 30, 15, 0)); // Wed 30 Sep 2026

const row = (decision: DecisionRow["decision"], decided: string, applied: string | null = null): DecisionRow => ({
  decision,
  decided_at: decided,
  applied_at: applied,
});

test("parseRange defaults to 30d and rejects junk", () => {
  assert.equal(parseRange(undefined), "30d");
  assert.equal(parseRange("90d"), "90d");
  assert.equal(parseRange(["all", "30d"]), "all");
  assert.equal(parseRange("7y"), "30d");
});

test("rangeStart", () => {
  assert.equal(rangeStart("all", NOW), null);
  assert.equal(rangeStart("30d", NOW)?.toISOString(), "2026-08-31T15:00:00.000Z");
});

test("summarizeDecisions: rate is null when nothing was decided", () => {
  assert.deepEqual(summarizeDecisions([]), { approved: 0, rejected: 0, total: 0, approvalRate: null });
  const s = summarizeDecisions([
    row("approved", "2026-09-01T00:00:00Z"),
    row("approved", "2026-09-02T00:00:00Z"),
    row("rejected", "2026-09-03T00:00:00Z"),
  ]);
  assert.deepEqual(s, { approved: 2, rejected: 1, total: 3, approvalRate: 67 });
});

test("medianWaitHours ignores unknown applied_at and uses the median", () => {
  const rows = [
    row("approved", "2026-09-01T10:00:00Z", "2026-09-01T08:00:00Z"), // 2h
    row("approved", "2026-09-05T08:00:00Z", "2026-09-01T08:00:00Z"), // 96h
    row("rejected", "2026-09-01T09:00:00Z", "2026-09-01T08:00:00Z"), // 1h
    row("approved", "2026-09-01T09:00:00Z", null), // unknown
  ];
  assert.deepEqual(medianWaitHours(rows), { hours: 2, sample: 3 });
  assert.equal(medianWaitHours([row("approved", "2026-09-01T00:00:00Z")]), null);
});

test("formatWait", () => {
  assert.equal(formatWait(0.4), "Under an hour");
  assert.equal(formatWait(1), "1 hour");
  assert.equal(formatWait(30), "30 hours");
  assert.equal(formatWait(60), "2.5 days");
  assert.equal(formatWait(24 * 12.4), "12 days");
});

test("lastWeeks: Monday-aligned, oldest first, current week partial", () => {
  const weeks = lastWeeks(NOW, 12);
  assert.equal(weeks.length, 12);
  for (const w of weeks) assert.equal(w.start.getUTCDay(), 1);
  assert.equal(weeks[11].start.toISOString().slice(0, 10), "2026-09-28");
  assert.equal(weeks[11].partial, true);
  assert.equal(weeks[11].end.getTime(), NOW.getTime());
  assert.equal(weeks[10].end.toISOString().slice(0, 10), "2026-09-28");
  assert.equal(weeks[0].start.toISOString().slice(0, 10), "2026-07-13");
});

test("monthlyDecisions buckets by UTC month and drops out-of-window rows", () => {
  const m = monthlyDecisions(
    [
      row("approved", "2026-09-15T00:00:00Z"),
      row("rejected", "2026-09-20T00:00:00Z"),
      row("approved", "2026-01-02T00:00:00Z"),
      row("approved", "2025-09-30T23:00:00Z"), // outside 12 months
    ],
    NOW,
    12,
  );
  assert.equal(m.length, 12);
  assert.equal(m[0].key, "2025-10");
  assert.equal(m[0].label, "Oct 25");
  assert.deepEqual(m[11], { key: "2026-09", label: "Sep", approved: 1, rejected: 1 });
  assert.equal(m.find((b) => b.key === "2026-01")?.label, "Jan 26");
  assert.equal(m.find((b) => b.key === "2026-01")?.approved, 1);
});

import { formatAge, helpByCategory, helpCategory, summarizeHelp, type HelpRow } from "../../lib/insights";

const help = (over: Partial<HelpRow>): HelpRow => ({
  request_type: "groceries",
  metadata: null,
  status: "open",
  created_at: "2026-09-20T10:00:00Z",
  resolved_at: null,
  ...over,
});

test("helpCategory: metadata.category wins, then the type label, unknown -> Other", () => {
  assert.equal(helpCategory(help({ metadata: { category: " Tech support " } })), "Tech support");
  assert.equal(helpCategory(help({ request_type: "dog_walking" })), "Dog Walking");
  assert.equal(helpCategory(help({ request_type: "custom" })), "Custom Request");
  assert.equal(helpCategory(help({ request_type: "constructor" })), "Custom Request");
  assert.equal(helpCategory(help({ metadata: { category: 42 } })), "Groceries");
});

test("summarizeHelp excludes cancelled from the rate and uses median resolve time", () => {
  const s = summarizeHelp([
    help({ status: "completed", resolved_at: "2026-09-20T12:00:00Z" }), // 2h
    help({ status: "completed", resolved_at: "2026-09-21T10:00:00Z" }), // 24h
    help({ status: "completed", resolved_at: "2026-09-20T16:00:00Z" }), // 6h
    help({ status: "open" }),
    help({ status: "cancelled" }),
    help({ status: "completed", resolved_at: "2026-09-20T10:00:00Z" }), // created already-completed: no timing
  ]);
  assert.deepEqual(s, { total: 6, completed: 4, cancelled: 1, completionRate: 80, medianResolveHours: 6 });
  assert.equal(summarizeHelp([help({ status: "cancelled" })]).completionRate, null);
});

test("helpByCategory merges case-insensitively and folds the tail last", () => {
  const rows = [
    ...Array(3).fill(help({ request_type: "groceries" })),
    help({ metadata: { category: "groceries" } }), // joins Groceries
    help({ request_type: "moving" }),
    help({ metadata: { category: "A" } }),
    help({ metadata: { category: "B" } }),
    help({ metadata: { category: "Other" } }), // a resident's own "Other" stays its own bar
  ];
  assert.deepEqual(helpByCategory(rows, 3), [
    { label: "Groceries", count: 4 },
    { label: "A", count: 1 },
    { label: "Everything else", count: 3 }, // B, Moving Help, Other
  ]);
  assert.deepEqual(helpByCategory([help({}), help({ request_type: "moving" })]), [
    { label: "Groceries", count: 1 },
    { label: "Moving Help", count: 1 },
  ]);
});

test("formatAge", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  assert.equal(formatAge("2026-09-25T09:30:00Z", now), "Under an hour");
  assert.equal(formatAge("2026-09-24T10:00:00Z", now), "24 hours");
  assert.equal(formatAge("2026-09-20T10:00:00Z", now), "5 days");
});
