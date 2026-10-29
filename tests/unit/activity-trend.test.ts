import { test } from "node:test";
import assert from "node:assert/strict";
import { lastWeeks } from "../../lib/insights";
import {
  activityHeadline,
  mergeActivityWeeks,
  trackingNote,
  trackingStartedOn,
  trimLeadingGaps,
  weeksSince,
  type ActivityWeek,
  type WeeklyActiveRow,
} from "../../lib/activity-trend";

const WEEKS = lastWeeks(new Date(Date.UTC(2026, 9, 29, 15)), 4); // ends with in-progress week 2026-10-26
const W = WEEKS[WEEKS.length - 1].start.toISOString().slice(0, 10); // 2026-10-26

const merge = (
  took: number | undefined,
  rows: WeeklyActiveRow[],
  residents = 43,
  markers: Parameters<typeof mergeActivityWeeks>[4] = [],
) => {
  const map = new Map<string, number>();
  if (took !== undefined) map.set(W, took);
  return mergeActivityWeeks(WEEKS, map, rows, residents, markers);
};
const last = (a: ActivityWeek[]) => a[a.length - 1];

test("quiet is active minus tookPart", () => {
  const w = last(merge(11, [{ week_start: W, active: 30, tracked: true }]));
  assert.equal(w.tookPart, 11);
  assert.equal(w.quiet, 19);
  assert.equal(w.active, 30);
});

test("active never below tookPart", () => {
  const w = last(merge(14, [{ week_start: W, active: 12, tracked: true }]));
  assert.equal(w.active, 14);
  assert.equal(w.quiet, 0);
});

test("untracked weeks have null quiet", () => {
  const w = last(merge(9, [{ week_start: W, active: 9, tracked: false }]));
  assert.equal(w.quiet, null);
  assert.equal(w.active, 9);
  assert.equal(w.tracked, false);
});

test("untracked week: active is took part only, not the raw count", () => {
  const w = last(merge(4, [{ week_start: W, active: 20, tracked: false }]));
  assert.equal(w.tookPart, 4);
  assert.equal(w.active, 4);
  assert.equal(w.quiet, null);
  const none = last(merge(undefined, [{ week_start: W, active: 20, tracked: false }]));
  assert.equal(none.active, null);
});

test("pct is clamped to 100", () => {
  const w = last(merge(60, [{ week_start: W, active: 80, tracked: true }], 43));
  assert.equal(w.pctActive, 100);
  assert.equal(w.pctTookPart, 100);
});

test("weeksSince drops weeks before creation, keeps the week containing it", () => {
  // WEEKS: 2026-10-05, 10-12, 10-19, 10-26
  const starts = (ws: typeof WEEKS) => ws.map((x) => x.start.toISOString().slice(0, 10));
  assert.deepEqual(starts(weeksSince(WEEKS, "2026-10-21T09:00:00Z")), ["2026-10-19", "2026-10-26"]);
  // created exactly at a week boundary: the previous week ended on/before it
  assert.deepEqual(starts(weeksSince(WEEKS, "2026-10-19T00:00:00Z")), ["2026-10-19", "2026-10-26"]);
  assert.equal(weeksSince(WEEKS, null), WEEKS);
  assert.equal(weeksSince(WEEKS, "not a date"), WEEKS);
});

test("missing digest", () => {
  const w = last(merge(undefined, [{ week_start: W, active: 7, tracked: true }]));
  assert.equal(w.tookPart, null);
  assert.equal(w.quiet, 7);
  assert.equal(w.active, 7);
});

test("pct uses residents and rounds", () => {
  const w = last(merge(11, [{ week_start: W, active: 30, tracked: true }], 43));
  assert.equal(w.pctActive, 70);
  assert.equal(w.pctTookPart, 26);
});

test("pct is null when no residents", () => {
  const w = last(merge(11, [{ week_start: W, active: 30, tracked: true }], 0));
  assert.equal(w.pctActive, null);
  assert.equal(w.pctTookPart, null);
});

test("markers bucket by UTC week", () => {
  const out = merge(1, [], 43, [
    { kind: "event", title: "BBQ", at: "2026-10-26T03:30:00Z" },
    { kind: "event", title: "Yoga", at: "2026-10-28T10:00:00Z" },
    { kind: "alert", title: "Water off", at: "2026-10-27T10:00:00Z" },
    { kind: "event", title: "Old", at: "2020-01-01T00:00:00Z" },
  ]);
  const prev = out[out.length - 2];
  assert.equal(prev.weekStart, "2026-10-19");
  assert.equal(prev.markers.length, 0);
  const w = last(out);
  assert.equal(w.weekStart, "2026-10-26");
  assert.equal(w.markers.length, 3);
  assert.ok(w.markers.some((m) => m.kind === "alert" && m.title === "Water off"));
  assert.equal(out.reduce((n, x) => n + x.markers.length, 0), 3);
});

test("headline", () => {
  const base = { weekStart: W, label: "26 Oct", markers: [] };
  const tracked: ActivityWeek = { ...base, active: 30, tookPart: 11, quiet: 19, tracked: true, pctActive: 70, pctTookPart: 26 };
  assert.equal(activityHeadline(tracked, 43), "30 residents active last week · 70% of 43 · 11 took part");
  const untracked: ActivityWeek = { ...base, active: 11, tookPart: 11, quiet: null, tracked: false, pctActive: null, pctTookPart: 26 };
  assert.equal(activityHeadline(untracked, 43), "11 residents took part last week");
  assert.equal(activityHeadline(undefined, 43), null);
});

test("trackingNote", () => {
  assert.equal(
    trackingNote("2026-10-29"),
    "App-open tracking started 29 Oct 2026; earlier weeks show taking part only.",
  );
  assert.equal(trackingNote(null), null);
});

test("trackingStartedOn", () => {
  const ts = "2026-10-29";
  assert.equal(
    trackingStartedOn([
      { week_start: "2026-10-19", active: 5, tracked: false, tracking_started: ts },
      { week_start: "2026-10-26", active: 9, tracked: true, tracking_started: ts },
    ]),
    ts,
  );
  assert.equal(trackingStartedOn([{ week_start: W, active: 9, tracked: true, tracking_started: ts }]), null);
  assert.equal(trackingStartedOn([]), null);
});

test("trimLeadingGaps drops leading untracked no-digest weeks, keeps later gaps", () => {
  const w = (tookPart: number | null, tracked: boolean, active: number | null): ActivityWeek => ({
    weekStart: "2026-01-05", label: "5 Jan", tookPart, quiet: null, active, tracked,
    pctActive: null, pctTookPart: null, markers: [],
  });
  const gap = w(null, false, 0);
  // (a) leading untracked, no digest: trimmed
  assert.equal(trimLeadingGaps([gap, gap, w(3, false, 3)]).length, 1);
  // (b) tracked week with no digest: kept
  assert.equal(trimLeadingGaps([gap, w(null, true, 2), w(3, true, 4)]).length, 2);
  // (c) mid-range gap kept
  assert.equal(trimLeadingGaps([w(3, false, 3), gap, w(2, true, 2)]).length, 3);
  assert.deepEqual(trimLeadingGaps([gap, gap]), []);
});
