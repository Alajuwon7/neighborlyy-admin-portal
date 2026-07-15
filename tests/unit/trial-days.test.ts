import { test } from "node:test";
import assert from "node:assert/strict";
import { soonestTrialDaysLeft } from "../../lib/trial-days";

const NOW = new Date("2026-07-15T12:00:00Z");

test("returns null when no community is on trial", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "active", trial_ends_at: "2026-07-20T12:00:00Z" }],
      NOW,
    ),
    null,
  );
});

test("returns the fewest days left among trialing communities", () => {
  const days = soonestTrialDaysLeft(
    [
      { status: "trial", trial_ends_at: "2026-07-25T12:00:00Z" }, // 10
      { status: "trial", trial_ends_at: "2026-07-18T12:00:00Z" }, // 3  <- soonest
      { status: "active", trial_ends_at: "2026-07-16T12:00:00Z" }, // ignored
    ],
    NOW,
  );
  assert.equal(days, 3);
});

test("ignores trialing communities with null trial_ends_at", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "trial", trial_ends_at: null }],
      NOW,
    ),
    null,
  );
});

test("clamps already-ended trials to 0", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "trial", trial_ends_at: "2026-07-10T12:00:00Z" }],
      NOW,
    ),
    0,
  );
});
