import { test } from "node:test";
import assert from "node:assert/strict";
import { reportWeeks, resolveReportPeriod } from "../../lib/report-period";
import { pdfText } from "../../lib/insights-pdf";

const NOW = new Date(Date.UTC(2026, 10, 25, 15)); // Wed 25 Nov 2026
const q = (s: string) => new URLSearchParams(s);

test("presets end now and start N days back", () => {
  for (const days of [30, 60, 90, 120]) {
    const r = resolveReportPeriod(q(`range=${days}`), NOW);
    assert.ok("period" in r);
    assert.equal(r.period.end.getTime(), NOW.getTime());
    assert.equal((NOW.getTime() - r.period.start.getTime()) / 86_400_000, days);
    assert.equal(r.period.kind, `Last ${days} days`);
  }
});

test("unknown preset is rejected", () => {
  assert.ok("error" in resolveReportPeriod(q("range=45"), NOW));
});

test("custom range includes the end day and caps at now", () => {
  const r = resolveReportPeriod(q("range=custom&from=2026-09-01&to=2026-09-30"), NOW);
  assert.ok("period" in r);
  assert.equal(r.period.end.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(r.period.toDay, "2026-09-30");

  const today = resolveReportPeriod(q("range=custom&from=2026-11-01&to=2026-11-25"), NOW);
  assert.ok("period" in today);
  assert.equal(today.period.end.getTime(), NOW.getTime());
});

test("custom days are local days in the PM's time zone", () => {
  const ny = resolveReportPeriod(q("range=custom&from=2026-09-01&to=2026-09-30"), NOW, "America/New_York");
  assert.ok("period" in ny);
  assert.equal(ny.period.start.toISOString(), "2026-09-01T04:00:00.000Z"); // EDT midnight
  assert.equal(ny.period.end.toISOString(), "2026-10-01T04:00:00.000Z");
  assert.equal(ny.period.label, "1 Sep 2026 – 30 Sep 2026");

  // Across the DST change (1 Nov 2026): end is EST midnight.
  const dst = resolveReportPeriod(q("range=custom&from=2026-10-30&to=2026-11-02"), NOW, "America/New_York");
  assert.ok("period" in dst);
  assert.equal(dst.period.end.toISOString(), "2026-11-03T05:00:00.000Z");

  // Already 26 Nov in Tokyo while it's 25 Nov in UTC: "today" is allowed.
  const tokyoNow = new Date(Date.UTC(2026, 10, 25, 22));
  const tokyo = resolveReportPeriod(q("range=custom&from=2026-11-26&to=2026-11-26"), tokyoNow, "Asia/Tokyo");
  assert.ok("period" in tokyo);
  assert.equal(tokyo.period.end.getTime(), tokyoNow.getTime());

  // Bad zone falls back to UTC.
  const bad = resolveReportPeriod(q("range=custom&from=2026-09-01&to=2026-09-01"), NOW, "Not/AZone");
  assert.ok("period" in bad);
  assert.equal(bad.period.start.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("custom range validation", () => {
  assert.ok("error" in resolveReportPeriod(q("range=custom&from=2026-10-10&to=2026-10-01"), NOW));
  assert.ok("error" in resolveReportPeriod(q("range=custom&from=2026-02-30&to=2026-03-01"), NOW));
  assert.ok("error" in resolveReportPeriod(q("range=custom&from=2026-12-01&to=2026-12-02"), NOW));
  assert.ok("error" in resolveReportPeriod(q("range=custom&from=2024-01-01&to=2026-01-01"), NOW));
  assert.ok("error" in resolveReportPeriod(q("range=custom"), NOW));
});

test("report weeks: Monday-aligned, completed only, overlapping the period", () => {
  const r = resolveReportPeriod(q("range=30"), NOW);
  assert.ok("period" in r);
  const weeks = reportWeeks(r.period, NOW);
  // Period starts Mon 26 Oct; last completed week starts Mon 16 Nov.
  assert.equal(weeks[0].start.toISOString().slice(0, 10), "2026-10-26");
  assert.equal(weeks[weeks.length - 1].start.toISOString().slice(0, 10), "2026-11-16");
  assert.ok(weeks.every((w) => w.start.getUTCDay() === 1 && !w.partial));
});

test("pdfText keeps Latin-1, maps dashes and quotes, drops emoji", () => {
  assert.equal(pdfText("Café – “Movie” night 🎬"), 'Café - "Movie" night');
});
