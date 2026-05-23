import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
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
  const next = searchParams.get("next") ?? "/dashboard/account";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Link was invalid, expired, or already used — send the user back to request
  // a fresh one with an explanation rather than a silent bounce to /login.
  return NextResponse.redirect(`${origin}/forgot-password?error=link_invalid`);
}
