import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_DURATIONS,
  PRIORITIES,
  durationToTimestamps,
  getAlertState,
  formatCountdown,
} from "../../lib/alerts";

const NOW = Date.UTC(2026, 4, 22, 16, 0, 0); // 2026-05-22T16:00:00Z

test("ALERT_DURATIONS has the mobile-matching set", () => {
  assert.deepEqual(
    ALERT_DURATIONS.map((d) => d.value),
    ["3h", "6h", "12h", "1d", "2d", "3d", "1w"]
  );
  assert.equal(ALERT_DURATIONS.find((d) => d.value === "3h")?.ms, 3 * 3600000);
  assert.equal(ALERT_DURATIONS.find((d) => d.value === "1w")?.ms, 7 * 86400000);
});

test("PRIORITIES lists urgent/high/medium/low", () => {
  assert.deepEqual(
    PRIORITIES.map((p) => p.value),
    ["urgent", "high", "medium", "low"]
  );
});

test("durationToTimestamps('off') clears pin + expiry", () => {
  assert.deepEqual(durationToTimestamps("off", NOW), {
    is_pinned: false,
    pin_expires_at: null,
    valid_until: null,
  });
});

test("durationToTimestamps('') is treated as off", () => {
  assert.deepEqual(durationToTimestamps("", NOW), {
    is_pinned: false,
    pin_expires_at: null,
    valid_until: null,
  });
});

test("durationToTimestamps('3h') ties pin_expires_at and valid_until to now+3h UTC", () => {
  const r = durationToTimestamps("3h", NOW);
  const expected = new Date(NOW + 3 * 3600000).toISOString();
  assert.equal(r.is_pinned, true);
  assert.equal(r.pin_expires_at, expected);
  assert.equal(r.valid_until, expected);
});

test("getAlertState: future pin_expires_at => pinned, not expired, msLeft>0", () => {
  const future = new Date(NOW + 2 * 3600000).toISOString();
  const s = getAlertState(
    { is_pinned: true, pin_expires_at: future, valid_until: future },
    NOW
  );
  assert.equal(s.isPinned, true);
  assert.equal(s.isExpired, false);
  assert.equal(s.msLeft, 2 * 3600000);
});

test("getAlertState: past valid_until => expired, not pinned", () => {
  const past = new Date(NOW - 3600000).toISOString();
  const s = getAlertState(
    { is_pinned: true, pin_expires_at: past, valid_until: past },
    NOW
  );
  assert.equal(s.isPinned, false);
  assert.equal(s.isExpired, true);
});

test("getAlertState: standing alert (nulls) => not pinned, not expired", () => {
  const s = getAlertState(
    { is_pinned: false, pin_expires_at: null, valid_until: null },
    NOW
  );
  assert.equal(s.isPinned, false);
  assert.equal(s.isExpired, false);
  assert.equal(s.msLeft, null);
});

test("formatCountdown formats days/hours/minutes", () => {
  assert.equal(formatCountdown(2 * 86400000 + 3 * 3600000), "2d 3h left");
  assert.equal(formatCountdown(3 * 3600000 + 45 * 60000), "3h 45m left");
  assert.equal(formatCountdown(12 * 60000), "12m left");
  assert.equal(formatCountdown(30000), "<1m left");
  assert.equal(formatCountdown(0), "expired");
});
