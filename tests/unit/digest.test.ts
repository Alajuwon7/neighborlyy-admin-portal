import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attachSuggestions,
  canChoose,
  compareWeek,
  isIsoWeekStart,
  metricTitle,
  formatFriendlyDate,
  formatWeekRange,
  isQuiet,
  metricLabel,
  metricNoun,
  nextMondayAfter,
  suggestionTarget,
  visibleMetrics,
  type Digest,
  type Suggestion,
} from "../../lib/digest";

function digest(overrides: Partial<Digest> = {}): Digest {
  return {
    community_code: "TREND1",
    week_start: "2026-09-21",
    week_end: "2026-09-27",
    narrative: null,
    residents_total: 38,
    posts: 0, comments: 0, help_requests: 0, survey_responses: 0, connection_requests: 0,
    event_rsvps: 0, events_held: 0, residents_joined: 0, active_residents: 0,
    ...overrides,
  };
}

test("nextMondayAfter always lands on a Monday strictly after now", () => {
  // Assert the weekday, not just the date — the spec's draft named a Tuesday.
  for (let day = 0; day < 14; day++) {
    const now = new Date(Date.UTC(2026, 8, 20 + day, 15));
    const next = nextMondayAfter(now);
    assert.equal(next.getUTCDay(), 1);
    assert.ok(next.getTime() > now.getTime());
    assert.ok(next.getTime() - now.getTime() <= 7 * 86400000);
  }
  // A Monday rolls to the following Monday.
  assert.equal(nextMondayAfter(new Date(Date.UTC(2026, 8, 28, 9))).toISOString().slice(0, 10), "2026-10-05");
  assert.equal(formatFriendlyDate(nextMondayAfter(new Date(Date.UTC(2026, 8, 30)))), "Monday, 5 October");
});

test("formatWeekRange handles same-month and cross-month weeks", () => {
  assert.equal(formatWeekRange("2026-09-21", "2026-09-27"), "21 – 27 September 2026");
  assert.equal(formatWeekRange("2026-09-28", "2026-10-04"), "28 September – 4 October 2026");
  assert.equal(formatWeekRange("bad", "2026-10-04"), "bad");
});

test("metric copy pluralises and degrades on unknown metrics", () => {
  assert.equal(metricLabel("posts", 1), "1 post");
  assert.equal(metricLabel("event_rsvps", 3), "3 event RSVPs");
  assert.deepEqual(metricNoun("constructor"), ["metric", "metrics"]);
  assert.deepEqual(metricNoun("__proto__"), ["metric", "metrics"]);
});

test("visibleMetrics keeps metrics non-zero in any week, in canonical order", () => {
  const keys = visibleMetrics([digest({ comments: 2 }), digest({ posts: 1, active_residents: 4 })]);
  assert.deepEqual(keys, ["posts", "comments", "active_residents"]);
});

test("isQuiet ignores residents_total and active_residents", () => {
  assert.equal(isQuiet(digest({ active_residents: 5 })), true);
  assert.equal(isQuiet(digest({ posts: 1 })), false);
  assert.equal(isQuiet(digest({ narrative: "Something happened." })), false);
});

test("canChoose: newest week only, terminal statuses frozen", () => {
  assert.equal(canChoose("open", true), true);
  assert.equal(canChoose("not_chosen", true), true);
  assert.equal(canChoose("chosen", true), true);
  assert.equal(canChoose("open", false), false);
  assert.equal(canChoose("expired", true), false);
  assert.equal(canChoose("achieved", true), false);
});

test("attachSuggestions keeps quiet weeks and scopes by community", () => {
  const s = (over: Partial<Suggestion>): Suggestion => ({
    id: "x", community_code: "TREND1", week_start: "2026-09-21", variant: "A", title: "t",
    rationale: "r", metric: "posts", target_direction: "up", baseline_value: 1, status: "open", ...over,
  });
  const out = attachSuggestions(
    [digest(), digest({ week_start: "2026-09-14", week_end: "2026-09-20" }), digest({ community_code: "OTHER" })],
    [s({ id: "b", variant: "B" }), s({ id: "a" }), s({ id: "other", community_code: "OTHER", week_start: "2026-09-14" })],
  );
  assert.deepEqual(out[0].suggestions.map((x) => x.id), ["a", "b"]);
  assert.equal(out[1].suggestions.length, 0); // no suggestions still renders
  assert.equal(out[2].suggestions.length, 0); // OTHER's suggestion was for a different week
});

test("suggestionTarget mirrors the app's target line", () => {
  assert.equal(suggestionTarget({ metric: "posts", target_direction: "up", baseline_value: 3 }), "More posts — 4-week avg 3");
  assert.equal(suggestionTarget({ metric: "odd", target_direction: "down", baseline_value: 0 }), "Fewer metrics — 4-week avg 0");
});

test("isIsoWeekStart accepts only real Mondays in YYYY-MM-DD", () => {
  assert.equal(isIsoWeekStart("2026-09-21"), true);
  assert.equal(isIsoWeekStart("2026-09-22"), false); // Tuesday
  assert.equal(isIsoWeekStart("2026-02-30"), false);
  assert.equal(isIsoWeekStart("2026-9-21"), false);
  assert.equal(isIsoWeekStart("x'; drop"), false);
});

test("compareWeek: previous only when the adjacent week is on file; average over up to 4", () => {
  const cur = digest({ week_start: "2026-09-21", week_end: "2026-09-27", posts: 6 });
  const prior = [
    digest({ week_start: "2026-09-14", week_end: "2026-09-20", posts: 4 }),
    digest({ week_start: "2026-09-07", week_end: "2026-09-13", posts: 2 }),
    digest({ week_start: "2026-08-31", week_end: "2026-09-06", posts: 3 }),
    digest({ week_start: "2026-08-24", week_end: "2026-08-30", posts: 0 }),
    digest({ week_start: "2026-08-17", week_end: "2026-08-23", posts: 99 }), // outside the window
  ];
  const posts = compareWeek(cur, prior).find((m) => m.key === "posts")!;
  assert.deepEqual(posts, { key: "posts", value: 6, previous: 4, average: 2 }); // 2.25 rounds like the Edge Function

  // Gap: the week before is missing -> no "vs last week", average still uses what exists.
  const gapped = compareWeek(cur, prior.slice(1, 4)).find((m) => m.key === "posts")!;
  assert.equal(gapped.previous, null);
  assert.equal(gapped.average, 2); // (2+3+0)/3

  assert.equal(compareWeek(cur, []).find((m) => m.key === "posts")!.average, null);
  assert.equal(metricTitle("help_requests"), "Help requests");
});
