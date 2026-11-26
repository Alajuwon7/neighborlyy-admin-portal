import { test } from "node:test";
import assert from "node:assert/strict";
import { adoptionPct, buildAdvice } from "../../lib/insights-advice";
import { resolveReportPeriod } from "../../lib/report-period";
import type { InsightsReport } from "../../lib/insights-report";

const NOW = new Date(Date.UTC(2026, 10, 25, 15));
const resolved = resolveReportPeriod(new URLSearchParams("range=30"), NOW);
if (!("period" in resolved)) throw new Error("period");
const r = resolved;

function report(over: Partial<InsightsReport> = {}): InsightsReport {
  return {
    communityName: "Test",
    buildingResidents: 521,
    period: r.period,
    generatedAt: NOW,
    residents: 47,
    active: 30,
    activeShare: 64,
    decisions: { approved: 3, rejected: 0, total: 3, approvalRate: 100 },
    wait: { hours: 10, sample: 3 },
    weekly: [],
    help: { total: 0, completed: 0, cancelled: 0, completionRate: null, medianResolveHours: null },
    helpCategories: [],
    openHelpNow: 0,
    inProgressHelpNow: 0,
    events: [],
    eventInfoAvailable: true,
    alertsSent: 0,
    ...over,
  };
}

test("adoption is residents on the app over the building total", () => {
  assert.equal(adoptionPct(report()), 9);
  assert.equal(adoptionPct(report({ buildingResidents: null })), null);
});

test("low adoption suggests spreading the community code", () => {
  const a = buildAdvice(report());
  assert.match(a.glance.summary, /47 of the building's 521 residents \(9%\)/);
  assert.ok(a.glance.tips.some((t) => /community code/.test(t)));
});

test("missing building count asks for it", () => {
  const a = buildAdvice(report({ buildingResidents: null }));
  assert.ok(a.glance.tips.some((t) => /Property Details/.test(t)));
});

test("slow approvals get a tip, fast ones don't", () => {
  assert.ok(buildAdvice(report({ wait: { hours: 96, sample: 4 } })).glance.tips.some((t) => /waited/.test(t)));
  assert.ok(!buildAdvice(report()).glance.tips.some((t) => /waited/.test(t)));
});

test("no events suggests scheduling some", () => {
  const a = buildAdvice(report());
  assert.match(a.events.summary, /No events/);
  assert.ok(a.events.tips.length > 0);
});

test("resident vs management comparison needs a real gap", () => {
  const ev = (host: "management" | "resident", going: number) => ({
    title: "E",
    eventDate: new Date(NOW.getTime() - 5 * 864e5).toISOString(),
    location: null,
    host,
    going,
    maxAttendees: null,
  });
  const close = buildAdvice(report({ events: [ev("management", 9), ev("resident", 9)] }));
  assert.ok(!close.events.tips.some((t) => /averaged/.test(t)));
  const wide = buildAdvice(report({ events: [ev("management", 3), ev("resident", 12)] }));
  assert.ok(wide.events.tips.some((t) => /Resident-hosted events averaged 12/.test(t)));
});

test("top suggestions are capped at three", () => {
  const a = buildAdvice(report({ buildingResidents: null, wait: { hours: 96, sample: 2 }, activeShare: 10 }));
  assert.ok(a.topTips.length <= 3);
});
