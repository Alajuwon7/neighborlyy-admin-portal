import { test } from "node:test";
import assert from "node:assert/strict";
import { excludeAuthors, filterCountedResidents, nonResidentIds } from "../../lib/residents";

// Records every builder call so the test asserts the query that would be sent.
function recorder() {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["or", "eq", "not"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  return { builder, calls };
}

test("filterCountedResidents keeps the admin filter and drops flagged accounts", () => {
  const { builder, calls } = recorder();
  filterCountedResidents(builder);
  assert.deepEqual(calls, [
    ["or", "role.is.null,role.neq.admin"],
    ["eq", "exclude_from_leaderboard", false],
  ]);
});

test("excludeAuthors adds a not-in filter, and nothing for an empty list", () => {
  const a = recorder();
  excludeAuthors(a.builder, ["u1", "u2"]);
  assert.deepEqual(a.calls, [["not", "user_id", "in", "(u1,u2)"]]);

  const b = recorder();
  excludeAuthors(b.builder, []);
  assert.deepEqual(b.calls, []);
});

test("nonResidentIds returns admins and flagged accounts only", async () => {
  const rows = [
    { id: "res", role: "resident", exclude_from_leaderboard: false },
    { id: "mgr", role: "admin", exclude_from_leaderboard: false },
    { id: "founder", role: "resident", exclude_from_leaderboard: true },
  ];
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  };
  assert.deepEqual(await nonResidentIds(supabase as never, ["TREND1"]), ["mgr", "founder"]);
});
