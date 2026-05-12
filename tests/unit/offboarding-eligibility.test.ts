import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCloseCommunity,
  isDispositionAction,
  allCommunitiesHaveDisposition,
} from "../../lib/offboarding/disposition";

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

test("allCommunitiesHaveDisposition: empty communityIds returns false (defensive)", () => {
  assert.equal(allCommunitiesHaveDisposition([], []), false);
  assert.equal(
    allCommunitiesHaveDisposition([], [
      { community_id: "stale", action: "suspend", set_at: "2026-05-09T00:00:00.000Z" },
    ]),
    false,
  );
});

test("allCommunitiesHaveDisposition: returns true when every id has a disposition", () => {
  assert.equal(
    allCommunitiesHaveDisposition(
      ["c1", "c2"],
      [
        { community_id: "c1", action: "suspend", set_at: "2026-05-09T00:00:00.000Z" },
        { community_id: "c2", action: "close", set_at: "2026-05-09T00:00:00.000Z" },
      ],
    ),
    true,
  );
});

test("allCommunitiesHaveDisposition: returns false when one id is missing", () => {
  assert.equal(
    allCommunitiesHaveDisposition(
      ["c1", "c2"],
      [
        { community_id: "c1", action: "suspend", set_at: "2026-05-09T00:00:00.000Z" },
      ],
    ),
    false,
  );
});
