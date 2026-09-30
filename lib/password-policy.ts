// Translates Supabase's weak-password rejection into something a PM can act on.
//
// Ported from the mobile app (Miyora: src/utils/passwordPolicy.ts) — keep the two
// in sync. The app and portal share one Supabase project, so they share one
// password policy.
//
// The Supabase project enforces its own policy (dashboard-configured, changeable
// without a deploy): currently 8+ chars with lower, upper, digit AND symbol.
// GoTrue's message spells out every accepted character, which is unusable in a UI:
//
//   "Password should be at least 8 characters. Password should contain at least one
//    character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ,
//    0123456789, !@#$%^&*()_+-=[]{};':\"|<>?,./`~."
//
// We hold the password, so we test it ourselves and only parse the message to learn
// which rules the server currently enforces. The server's rules are deliberately
// not hardcoded here — a copy of them is exactly the drift this exists to avoid.

const CHARACTER_CLASSES: {
  /** The literal set GoTrue prints in its message when this class is required. */
  marker: string;
  test: (password: string) => boolean;
  describe: string;
}[] = [
  { marker: "abcdefghijklmnopqrstuvwxyz", test: (p) => /[a-z]/.test(p), describe: "a lowercase letter" },
  { marker: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", test: (p) => /[A-Z]/.test(p), describe: "an uppercase letter" },
  { marker: "0123456789", test: (p) => /[0-9]/.test(p), describe: "a number" },
  // A short prefix of GoTrue's symbol set keeps us clear of quote/backslash
  // escaping differences between the raw body and the parsed message.
  { marker: "!@#$%^&*()", test: (p) => /[^A-Za-z0-9]/.test(p), describe: "a symbol (like ! or #)" },
];

/** Does this look like Supabase's "weak password" rejection? */
export function isWeakPasswordError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; reasons?: unknown; message?: unknown };
  if (e.code === "weak_password") return true;
  // AuthWeakPasswordError carries reasons like ['length', 'characters'].
  if (Array.isArray(e.reasons) && e.reasons.length > 0) return true;
  return typeof e.message === "string" && /password should be at least|password should contain/i.test(e.message);
}

/**
 * A short instruction naming what THIS password is missing, or null if `error`
 * is not a weak-password rejection.
 */
export function explainWeakPassword(password: string, error: unknown): string | null {
  if (!isWeakPasswordError(error)) return null;

  const message =
    typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : "";

  const needs: string[] = [];

  // Only mention length if the password actually falls short.
  const lengthMatch = message.match(/at least (\d+) characters/i);
  const minLength = lengthMatch ? parseInt(lengthMatch[1], 10) : null;
  if (minLength !== null && password.length < minLength) {
    needs.push(`${minLength} characters or more`);
  }

  // Only classes the server requires AND this password lacks.
  for (const cls of CHARACTER_CLASSES) {
    if (!message.includes(cls.marker)) continue;
    if (cls.test(password)) continue;
    needs.push(cls.describe);
  }

  if (needs.length === 0) {
    // The server refused but we couldn't attribute it — never claim to know why.
    return "That password was refused. Try a longer one with a mix of upper and lowercase letters, a number and a symbol.";
  }

  return `Your password needs ${joinReadable(needs)}.`;
}

/** "a" / "a and b" / "a, b and c" */
function joinReadable(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
