import { test } from "node:test";
import assert from "node:assert/strict";
import { deletionComplete } from "../../lib/email/templates/deletion-complete";

test("deletionComplete includes communities, hard-delete date, and support email", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["Maple Ridge — Suspended (awaiting a new property manager)"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@miyora.com",
  });
  assert.match(tpl.subject, /closed/i);
  assert.match(tpl.html, /Maple Ridge/);
  assert.match(tpl.html, /June 13, 2026/);
  assert.match(tpl.html, /support@miyora\.com/);
  assert.match(tpl.text, /Maple Ridge/);
  assert.match(tpl.text, /June 13, 2026/);
});

test("deletionComplete handles zero communities", () => {
  const tpl = deletionComplete({
    pmFirstName: "",
    communityLines: [],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@miyora.com",
  });
  assert.match(tpl.html, /No communities required handoff/);
  assert.match(tpl.text, /No communities required handoff/);
  assert.match(tpl.html, /Hi there,/);
  assert.match(tpl.text, /Hi there,/);
});

test("deletionComplete escapes HTML in community lines", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["<script>Bad</script> Community"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@miyora.com",
  });
  assert.doesNotMatch(tpl.html, /<script>Bad<\/script>/);
  assert.match(tpl.html, /&lt;script&gt;/);
});

test("deletionComplete escapes HTML in pmFirstName", () => {
  const tpl = deletionComplete({
    pmFirstName: '<img src=x onerror="alert(1)">',
    communityLines: [],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@miyora.com",
  });
  assert.doesNotMatch(tpl.html, /<img/);
  assert.match(tpl.html, /&lt;img/);
});
