import { test } from "node:test";
import assert from "node:assert/strict";
import { dispositionLabel } from "../../lib/offboarding/disposition";
import { buildStripeAnonymization } from "../../lib/offboarding/completion";

test("dispositionLabel: suspend", () => {
  assert.equal(dispositionLabel("suspend"), "Suspended (awaiting a new property manager)");
});

test("dispositionLabel: close", () => {
  assert.equal(dispositionLabel("close"), "Closed and archived");
});

test("dispositionLabel: transfer", () => {
  assert.equal(dispositionLabel("transfer"), "Transferred to another property manager");
});

test("buildStripeAnonymization produces the GDPR-safe customer shape", () => {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const result = buildStripeAnonymization("pm-123", "req-456", now);
  assert.equal(result.name, "Deleted Account");
  assert.equal(result.email, "deleted-pm-123@neighborlyy.internal");
  assert.equal(result.metadata.deleted_at, "2026-05-14T12:00:00.000Z");
  assert.equal(result.metadata.deletion_request_id, "req-456");
});

test("buildStripeAnonymization defaults the timestamp to now", () => {
  const result = buildStripeAnonymization("pm-1", "req-1");
  assert.ok(!Number.isNaN(Date.parse(result.metadata.deleted_at)));
});
