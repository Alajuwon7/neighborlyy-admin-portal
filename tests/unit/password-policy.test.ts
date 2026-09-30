import { test } from "node:test";
import assert from "node:assert/strict";
import { explainWeakPassword, isWeakPasswordError } from "../../lib/password-policy";

// GoTrue's message with the project's current policy (length + all four classes).
const FULL_POLICY =
  "Password should be at least 8 characters. Password should contain at least one character of each: " +
  "abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};':\"|<>?,./`~.";

test("isWeakPasswordError recognises code, reasons and message", () => {
  assert.equal(isWeakPasswordError({ code: "weak_password" }), true);
  assert.equal(isWeakPasswordError({ reasons: ["characters"] }), true);
  assert.equal(isWeakPasswordError({ message: FULL_POLICY }), true);
  assert.equal(isWeakPasswordError({ message: "User already registered" }), false);
  assert.equal(isWeakPasswordError(null), false);
});

test("explainWeakPassword names only what is missing", () => {
  // The 2026-08-29 mobile bug: four classes but no symbol.
  assert.equal(
    explainWeakPassword("Password1", { code: "weak_password", message: FULL_POLICY }),
    "Your password needs a symbol (like ! or #)."
  );
  assert.equal(
    explainWeakPassword("abc", { code: "weak_password", message: FULL_POLICY }),
    "Your password needs 8 characters or more, an uppercase letter, a number and a symbol (like ! or #)."
  );
});

test("explainWeakPassword follows the server's configured rules, not a hardcoded copy", () => {
  const lengthOnly = "Password should be at least 12 characters.";
  assert.equal(
    explainWeakPassword("password", { code: "weak_password", message: lengthOnly }),
    "Your password needs 12 characters or more."
  );
});

test("explainWeakPassword falls back when it cannot attribute the refusal", () => {
  const msg = explainWeakPassword("Str0ng!Pass", { code: "weak_password", message: "" });
  assert.match(msg ?? "", /^That password was refused/);
  assert.equal(explainWeakPassword("x", { message: "Network error" }), null);
});
