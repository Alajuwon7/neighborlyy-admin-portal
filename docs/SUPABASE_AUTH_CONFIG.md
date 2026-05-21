# Supabase Auth Configuration

These settings must be configured manually in the Supabase Dashboard. They cannot be set via code or migrations.

## URL Configuration

**Dashboard Location:** Authentication > URL Configuration

| Setting | Value |
|---------|-------|
| Site URL | `https://miyora-admin-portal-two.vercel.app` |

### Redirect URLs

| URL | Purpose |
|-----|---------|
| `https://miyora-admin-portal-two.vercel.app/api/auth/callback` | Production OAuth/magic link callback |
| `http://localhost:3000/api/auth/callback` | Local development callback |

## Password Settings

**Dashboard Location:** Authentication > Providers > Email > Password Requirements

| Setting | Required Value |
|---------|---------------|
| Minimum password length | `8` |
| Password requirements | `letters_digits` (require both letters and digits) |

## How to Restore

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the project
3. Navigate to **Authentication > URL Configuration**
   - Set **Site URL** to `https://miyora-admin-portal-two.vercel.app`
   - Add both redirect URLs listed above
4. Navigate to **Authentication > Providers > Email**
   - Set **Minimum password length** to `8`
   - Set **Password requirements** to **Require both letters and digits** (`letters_digits`)
5. Click **Save**

> **Note:** These settings were accidentally changed during a deployment. If you are redeploying or setting up a new environment, verify these settings match the values above.

## Custom SMTP — Resend (configured 2026-05-19)

All auth emails (signup confirmation, password reset, invite, magic link) route through Resend SMTP, sender `Miyora <noreply@miyora-app.com>`.

**Dashboard Location:** Authentication > SMTP Settings

| Field | Value |
|-------|-------|
| Enable Custom SMTP | **ON** (master toggle — if off, all fields below are ignored) |
| Sender email | `noreply@miyora-app.com` |
| Sender name | `Miyora` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | **`resend`** (literal lowercase word — NOT your email, NOT the API key) |
| Password | the `re_...` API key from Resend |

**Authentication > Rate Limits:** Set `Emails sent per hour` to `100` (default 30 is too low for active dev/testing).

**DNS prerequisite:** Domain `miyora-app.com` must be verified in Resend (DNS records live at Bizee).

**Most common config mistake:** putting the sender email or the API key into the Username field. Resend's SMTP username is always the literal word `resend` for every account.

## ⚠️ Confirm Email — currently DISABLED

As of 2026-05-19, **"Confirm email"** is turned OFF in Authentication > Providers > Email as a workaround for a signup bug (the post-`auth.signUp` client-side `property_managers` insert returns 401 without an established session). Before public launch:

1. Fix the signup bug — preferred fix is a Postgres trigger on `auth.users` insert that creates `property_managers` automatically from the user metadata, and delete the client-side `.insert()` call in `app/(auth)/signup/page.tsx`.
2. Re-enable "Confirm email".
3. Test the full signup → verify → onboarding flow end-to-end.
