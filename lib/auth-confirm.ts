// Where to send a user after their email-link confirmation succeeds.
//
// The Supabase project is shared with the Miyora mobile app, so the
// "Confirm signup" email lands every new user — PM or resident — on the
// portal's /api/auth/confirm route. PMs are recognized two ways: a
// property_managers row (created by the signup trigger, migration 032) or the
// user_metadata.account_type stamp from the portal signup form. Either is
// sufficient, so a transient failure reading one doesn't bounce a real PM.
// A confirmed user with neither belongs in the mobile app and goes to the
// return-to-app page instead of the PM dashboard.

export const MOBILE_CONFIRMED_PATH = "/email-confirmed";

type ConfirmedUser = { user_metadata?: Record<string, unknown> } | null;

export function confirmRedirectPath(
  user: ConfirmedUser,
  hasPmRow: boolean,
  type: string | null,
  next: string
): string {
  // Recovery links go to the reset-password flow regardless of account type.
  if (type === "recovery") return next;
  // No user to inspect (shouldn't happen on success) — keep portal behavior.
  if (!user) return next;
  if (hasPmRow || user.user_metadata?.account_type === "property_manager") {
    return next;
  }
  return MOBILE_CONFIRMED_PATH;
}

// Email links carry ?next=<path>. Only same-origin absolute paths are allowed:
// `${origin}${next}` with next like "@evil.com" yields https://portal@evil.com
// (userinfo trick) and "//evil.com" is protocol-relative — both open redirects.
export function sanitizeNextPath(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return fallback;
}
