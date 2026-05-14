import { test } from "node:test";
import assert from "node:assert/strict";
import { deletionComplete } from "../../lib/email/templates/deletion-complete";

test("deletionComplete includes communities, hard-delete date, and support email", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["Maple Ridge — Suspended (awaiting a new property manager)"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.match(tpl.subject, /closed/i);
  assert.match(tpl.html, /Maple Ridge/);
  assert.match(tpl.html, /June 13, 2026/);
  assert.match(tpl.html, /support@neighborlyy\.com/);
  assert.match(tpl.text, /Maple Ridge/);
  assert.match(tpl.text, /June 13, 2026/);
});

test("deletionComplete handles zero communities", () => {
  const tpl = deletionComplete({
    pmFirstName: "",
    communityLines: [],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.match(tpl.html, /No communities required handoff/);
  assert.match(tpl.text, /No communities required handoff/);
});

test("deletionComplete escapes HTML in community lines", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["<script>Bad</script> Community"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.doesNotMatch(tpl.html, /<script>Bad<\/script>/);
  assert.match(tpl.html, /&lt;script&gt;/);
});
