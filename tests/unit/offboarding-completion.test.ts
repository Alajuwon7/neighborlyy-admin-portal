import { test } from "node:test";
import assert from "node:assert/strict";
import { dispositionLabel } from "../../lib/offboarding/disposition";

test("dispositionLabel: suspend", () => {
  assert.match(dispositionLabel("suspend"), /Suspended/);
});

test("dispositionLabel: close", () => {
  assert.match(dispositionLabel("close"), /Closed and archived/);
});

test("dispositionLabel: transfer", () => {
  assert.match(dispositionLabel("transfer"), /Transferred/);
});
