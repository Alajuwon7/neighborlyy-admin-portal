import { createClient } from "@/lib/supabase/server";
import {
  confirmRedirectPath,
  MOBILE_CONFIRMED_PATH,
  sanitizeNextPath,
} from "@/lib/auth-confirm";
import { type EmailOtpType, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Handles email-link auth confirmations (password recovery, etc.).
//
// Prefers the token-hash flow (`verifyOtp`): unlike the PKCE `?code=` flow it
// is NOT tied to a single-use code held in the originating browser, so it
// survives email link-scanners/prefetch and repeated reset requests — the
// causes of recovery links intermittently dumping users on the sign-in page.
//
// Falls back to the PKCE `?code=` flow so an unmodified email template (which
// still sends `redirect_to=.../api/auth/confirm?code=...`) keeps working.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"), "/dashboard/account");

  const supabase = await createClient();

  // The Supabase project is shared with the Miyora mobile app, so mobile
  // signups confirm through this route too. Mobile users get sent to the
  // return-to-app page instead of into the PM portal (see lib/auth-confirm).
  const redirectAfterConfirm = async (user: User | null) => {
    // Positive PM check: the signup trigger creates a property_managers row
    // before the user ever confirms, and RLS lets a PM read their own row.
    // Skipped for recovery, which never leaves the portal flow.
    let hasPmRow = false;
    if (user && type !== "recovery") {
      const { data: pmRow } = await supabase
        .from("property_managers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      hasPmRow = Boolean(pmRow);
    }
    const path = confirmRedirectPath(user, hasPmRow, type, next);
    if (path === MOBILE_CONFIRMED_PATH) {
      // verifyOtp/exchangeCodeForSession just set portal session cookies for
      // a mobile-app user; clear them — they sign in inside the app and must
      // not hold a portal session. Local scope: leave any app session alone.
      await supabase.auth.signOut({ scope: "local" });
    }
    return NextResponse.redirect(`${origin}${path}`);
  };

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return redirectAfterConfirm(data.user);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectAfterConfirm(data.user);
    }
  }

  // Link was invalid, expired, or already used. Send the user somewhere they can
  // recover, with an explanation rather than a silent bounce: password resets go
  // back to /forgot-password; signup and other confirmations go to /login.
  const failurePath = type === "recovery" ? "/forgot-password" : "/login";
  return NextResponse.redirect(`${origin}${failurePath}?error=link_invalid`);
}
