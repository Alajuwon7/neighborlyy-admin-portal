import { test } from "node:test";
import assert from "node:assert/strict";
import { canCloseCommunity, isDispositionAction } from "../../lib/offboarding/disposition";

test("canCloseCommunity is true when zero active residents", () => {
  assert.equal(canCloseCommunity(0), true);
});

test("canCloseCommunity is false when active residents > 0", () => {
  assert.equal(canCloseCommunity(1), false);
  assert.equal(canCloseCommunity(48), false);
});

test("isDispositionAction validates the three known actions", () => {
  assert.equal(isDispositionAction("transfer"), true);
  assert.equal(isDispositionAction("suspend"), true);
  assert.equal(isDispositionAction("close"), true);
});

test("isDispositionAction rejects unknown values", () => {
  assert.equal(isDispositionAction("delete"), false);
  assert.equal(isDispositionAction(""), false);
  assert.equal(isDispositionAction(null), false);
  assert.equal(isDispositionAction(undefined), false);
});
