import { test } from "node:test";
import assert from "node:assert/strict";
import { countGoing, eventHost, parseHostFilter } from "../../lib/event-host";

test("an explicit hosted_by wins over the creator", () => {
  const admins = new Set(["pm-1"]);
  assert.equal(eventHost("pm-1", admins, "resident"), "resident");
  assert.equal(eventHost(null, admins, "resident"), "resident");
  assert.equal(eventHost("res-1", admins, "management"), "management");
  assert.equal(eventHost("pm-1", admins, "bogus"), "management");
});

test("portal-created events (no creator) are management", () => {
  assert.equal(eventHost(null, new Set()), "management");
});

test("events by an admin profile are management, others are resident", () => {
  const admins = new Set(["pm-1"]);
  assert.equal(eventHost("pm-1", admins), "management");
  assert.equal(eventHost("res-1", admins), "resident");
});

test("only residents' 'going' RSVPs are counted", () => {
  const counts = countGoing(
    [
      { event_id: "a", user_id: "r1", status: "going" },
      { event_id: "a", user_id: "r2", status: "going" },
      { event_id: "a", user_id: "pm", status: "going" },
      { event_id: "a", user_id: "r3", status: "not_going" },
      { event_id: "b", user_id: "r1", status: "maybe" },
    ],
    new Set(["pm"]),
  );
  assert.equal(counts.get("a"), 2);
  assert.equal(counts.get("b"), undefined);
});

test("host filter falls back to all", () => {
  assert.equal(parseHostFilter("resident"), "resident");
  assert.equal(parseHostFilter(["management"]), "management");
  assert.equal(parseHostFilter("bogus"), "all");
  assert.equal(parseHostFilter(undefined), "all");
});
