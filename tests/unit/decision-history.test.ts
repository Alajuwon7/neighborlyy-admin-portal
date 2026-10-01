import { test } from "node:test";
import assert from "node:assert/strict";
import { decidedByLabel, parseDecisionFilter, parsePage, sanitizeSearch } from "../../lib/decision-history";

test("sanitizeSearch strips PostgREST filter syntax and pattern characters", () => {
  assert.equal(sanitizeSearch("  ann  smith "), "ann smith");
  assert.equal(sanitizeSearch("a,b)or(email.ilike.*"), "a b or email.ilike.");
  assert.equal(sanitizeSearch("50%_off\\"), "50 _off");
  assert.equal(sanitizeSearch(undefined), "");
  assert.equal(sanitizeSearch("O'Brien"), "O'Brien");
  assert.equal(sanitizeSearch("x".repeat(200)).length, 80);
});

test("parse helpers default safely", () => {
  assert.equal(parseDecisionFilter("rejected"), "rejected");
  assert.equal(parseDecisionFilter("drop"), "all");
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("-1"), 1);
  assert.equal(parsePage("abc"), 1);
});

test("decidedByLabel", () => {
  const names = new Map([["admin-1", "Dana (mobile)"]]);
  assert.equal(decidedByLabel(null, "me", names), "Not recorded");
  assert.equal(decidedByLabel("me", "me", names), "You");
  assert.equal(decidedByLabel("admin-1", "me", names), "Dana (mobile)");
  assert.equal(decidedByLabel("someone", "me", names), "Another admin");
});
