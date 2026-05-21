# Production Smoke-Test Checklist — Miyora Admin Portal

**Launch window:** Day 3 of 3  
**Environment:** Vercel production deployment  
**Estimated total time:** ~65-85 min  
**Tester:** ___________________________  
**Date/time started:** ___________________________

---

> **How to use this checklist:** Work through each section in order. Tick `- [x]` when the criterion passes. If an item fails, note it in the margin and check the "When to abort" section before continuing. Do not skip the offboarding section — it is the primary new feature of this release.

---

## 1. Pre-flight Checks (5 min)

### Production URL

- [ ] `curl -o /dev/null -s -w "%{http_code}" https://<PROD_URL>/` returns `200`.  
  _Pass criterion: HTTP status is exactly `200`, not a redirect loop or 5xx._

- [ ] `curl -o /dev/null -s -w "%{http_code}" https://<PROD_URL>/login` returns `200`.  
  _Pass criterion: the login page is reachable, no 404/500._

### Vercel deploy

- [ ] In the Vercel Dashboard → your project → **Deployments**, the top deployment shows the latest commit SHA from `main` (`1142f7d` or newer) and its status is **Ready**.  
  _Pass criterion: status badge is green "Ready"; SHA matches `git log --oneline -1` on main._

### Vercel environment variables

Open **Vercel Dashboard → Settings → Environment Variables** and verify the following are set for the **Production** environment (values need not be visible — their presence is sufficient):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_STARTER_MONTHLY`
- [ ] `STRIPE_PRICE_STARTER_ANNUAL`
- [ ] `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- [ ] `STRIPE_PRICE_PROFESSIONAL_ANNUAL`
- [ ] `STRIPE_PRICE_ENTERPRISE_MONTHLY`
- [ ] `STRIPE_PRICE_ENTERPRISE_ANNUAL`
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL`
- [ ] `NEXT_PUBLIC_APP_URL` (should equal the production URL, not `localhost`)
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `OFFBOARDING_APPROVAL_SECRET` (32+ char hex secret)
- [ ] `CRON_SECRET`

_Pass criterion: all 18 variables are listed. Any missing variable is a hard stop — see "When to abort"._

### Stripe webhook endpoint

In **Stripe Dashboard → Developers → Webhooks**, locate the production endpoint pointing at `https://<PROD_URL>/api/webhooks/stripe`:

- [ ] Endpoint URL matches the production Vercel URL.
- [ ] The following three events are subscribed:
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
- [ ] Signing secret (`whsec_…`) matches `STRIPE_WEBHOOK_SECRET` in Vercel.

_Pass criterion: all three events listed, endpoint status is "Enabled", no recent delivery failures in the last 24 hours._

### Supabase — migration 031 applied

Open the Supabase SQL Editor for the shared project and run:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'complete_pm_offboarding',
    'hard_delete_expired_offboarding'
  );
```

- [ ] Result set contains exactly **2 rows**: `complete_pm_offboarding` and `hard_delete_expired_offboarding`.

_Pass criterion: row count = 2. If 0 or 1, migration 031 was not applied — abort launch._

Also verify the `subscription_history.community_id` column is nullable (migration 031 schema adjustment):

```sql
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'subscription_history'
  AND column_name  = 'community_id';
```

- [ ] Result is `YES`.

_Pass criterion: `is_nullable = YES`. If `NO`, the FK safety net for Gate 6 community hard-delete is missing._

### Auth hardening

In **Supabase Dashboard → Authentication → Providers → Email**:

- [ ] **Minimum password length** is set to `8`.
- [ ] **Password requirements** is set to require both letters and digits (`letters_digits`).

In **Supabase Dashboard → Authentication → Providers** (check for MFA):

- [ ] TOTP MFA is enabled (or confirm per the project's auth-hardening runbook that the chosen MFA method is active).

> **Note:** HIBP (Have I Been Pwned) breach-check and MFA enrollment policies are configured in the Supabase Dashboard under Authentication settings. Confirm the correct settings are in place per the project's `docs/SUPABASE_AUTH_CONFIG.md` reference. These are manual Supabase Dashboard settings and cannot be verified programmatically from this checklist.

_Pass criterion: password length = 8, requirement = letters + digits, MFA method active._

---

## 2. Auth + Onboarding Smoke (10 min)

### Login redirect

- [ ] Visit `https://<PROD_URL>/` in a fresh incognito/private browser window.  
  _Pass criterion: you are redirected to `/login`, not shown a blank page or 500._

### Sign up a fresh PM account

- [ ] Click **Sign Up** (or navigate to the sign-up page) and register a new account using a real email address you can check (e.g., a `+smoketest` alias on your domain).
- [ ] Fill in name, email, and a valid password (8+ chars, letters + digits).
- [ ] Submit — you should see a "check your email" confirmation state.  
  _Pass criterion: no 500 error; confirmation message rendered on screen._

### Email verification

- [ ] Check the inbox for the verification email (from `RESEND_FROM_EMAIL` — `noreply@miyora-app.com` or the configured value). It should arrive within 60 seconds.
- [ ] Click the verification link in the email.  
  _Pass criterion: link opens in the browser and you are redirected to the onboarding wizard or a "email confirmed" page, not a 404 or "invalid link"._

### Onboarding wizard — all 6 steps

Work through the wizard, verifying each step renders correctly and the "Next" action succeeds:

- [ ] **Step 1 — Organization type:** Select "Individual Manager" and continue.  
  _Pass criterion: step renders, selection persists, able to proceed._

- [ ] **Step 2 — Property info:** Enter a test property name and address; continue.  
  _Pass criterion: form validates, step advances._

- [ ] **Step 3 — Branding:** Upload or skip a logo; choose brand colors; continue.  
  _Pass criterion: branding section renders; continue works._

- [ ] **Step 4 — Facilities:** Add at least one facility with hours; continue.  
  _Pass criterion: facility entry saved, step advances._

- [ ] **Step 5 — Admin access:** Invite (or skip) a team member; continue.  
  _Pass criterion: step renders and advances without error._

- [ ] **Step 6 — Billing:** Choose a plan (use a Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC) or use the skip-payment path if it exists.  
  _Pass criterion: billing step completes without Stripe error; no 500 in the browser console._

### Dashboard loads with seeded community

- [ ] After completing onboarding, you land on `/dashboard`.  
  _Pass criterion: dashboard renders; at least one community card is visible; no console errors._

---

## 3. Core Admin Flows (15-20 min)

### Pending users

- [ ] Navigate to the community → **Pending** tab (URL pattern: `/dashboard/communities/[id]/pending`).
- [ ] If a pending resident exists: click **Approve** on one pending user. Verify the user disappears from the pending list and appears in Residents.  
  _Pass criterion: resident moves from pending to active without page error._
- [ ] If a pending resident exists: click **Deny** on another (or the same after re-seeding). Verify the denial succeeds and the row is removed.  
  _Pass criterion: deny action completes without 500; user no longer in pending list._

> **Note:** The deny flow had a recent `rejected_by` fix. If the DB still shows the old schema (confirm by running `SELECT column_name FROM information_schema.columns WHERE table_name='pending_users' AND column_name='rejected_by'`), defer this sub-test and note it in the sign-off. Do not abort the launch on this alone.

### Residents list

- [ ] Navigate to the community → **Residents** tab.  
  _Pass criterion: residents list renders; no 500 or blank screen._

### Events

- [ ] Navigate to **Events** and create a new event (name, date, description).  
  _Pass criterion: event appears in the list after save._
- [ ] Edit the event — change the name; save.  
  _Pass criterion: updated name shown in the list._
- [ ] Delete the event.  
  _Pass criterion: event removed from the list; no 500._

### Alerts

- [ ] Navigate to **Alerts** (or the notifications/alerts section) and create a test alert.  
  _Pass criterion: alert saves without error._
- [ ] In the Supabase SQL Editor, verify an `admin_notifications` row was inserted:

  ```sql
  SELECT id, type, created_at
  FROM admin_notifications
  ORDER BY created_at DESC
  LIMIT 1;
  ```

  _Pass criterion: a row exists with `created_at` in the last 2 minutes._

### Facilities

- [ ] Navigate to the community's **Facilities** tab and add a new facility with operating hours.  
  _Pass criterion: facility saved, appears in the list._
- [ ] Edit the facility — change its name or hours; save.  
  _Pass criterion: updated values shown._

### Team members

- [ ] Navigate to **Team** and invite a teammate (enter an email address).  
  _Pass criterion: invitation sent without error; invitee email appears in the team list with a "pending" or "invited" status._

### Account settings

- [ ] Navigate to **Account → Profile** and update the display name or avatar.  
  _Pass criterion: change saves without error; page reflects the update._
- [ ] Navigate to **Account → Settings** and update the corporation contact email (this is the email that receives the offboarding corp-approval link).  
  _Pass criterion: save succeeds; new email is shown on the settings page._

---

## 4. PM Account Offboarding Flow (20-30 min)

> **Setup requirement:** Before this section, ensure the test PM account's corporation contact email (`RESEND_FROM_EMAIL` destination) is an inbox you can actually check. Also confirm the test account has at least one community with zero active residents (required for the "Close" disposition path) or at least one community with residents (for the "Suspend" path).

### Initiate the offboarding intent

- [ ] From the dashboard, navigate to **Account → Danger Zone** (or **Account → Delete My Account**).
- [ ] Click **"Delete My Account"** (or the equivalent CTA in the Danger Zone section).
- [ ] In the intent modal: select a reason, type the confirmation email, and submit.  
  _Pass criterion: modal submits without error; you are redirected or shown a confirmation state indicating the request is in review._

### Corp approval email

- [ ] Check the corporation contact email inbox. The corp-approval email should arrive within 60 seconds.  
  _Pass criterion: email arrives from `noreply@miyora-app.com` (or `RESEND_FROM_EMAIL`) with a unique approval link._

### Corp approval form

- [ ] Click the corp approval link in the email.  
  _Pass criterion: the link opens `/offboarding/approve?token=…` and renders the approval form — not a 404, 401, or expired-token error._
- [ ] Fill in **name** and **title** fields in the approval form; click **Submit**.  
  _Pass criterion: form submits without error; success state rendered._

### PM email — approval confirmed

- [ ] Check the PM's email inbox. A "your corporation approved your closure request" email should arrive within 60 seconds.  
  _Pass criterion: email arrives; it contains the PM's name and a link or instructions to proceed._

### Dashboard — offboarding-in-progress status card

- [ ] Return to the PM's browser session (or sign back in) and navigate to the dashboard.  
  _Pass criterion: an offboarding-in-progress status card or banner is visible. The layout guard should route you toward the offboarding flow if you navigate to unrelated pages._

### Gate 2 — Billing (`/dashboard/account/offboarding/billing`)

- [ ] Navigate to `/dashboard/account/offboarding/billing`.  
  _Pass criterion: billing step renders; it shows the active subscription and a "Cancel Subscription" action._
- [ ] Click **Cancel Subscription** (cancels via Stripe `cancel_at_period_end: true`).  
  _Pass criterion: action completes; the page updates to show the subscription is cancelled at period end._
- [ ] In **Stripe Dashboard → Customers → [test PM customer] → Subscriptions**, verify:
  - [ ] The subscription status is **Active** with `cancel_at_period_end = true`.  
    _Pass criterion: Stripe shows `Cancel at period end: Yes`._
- [ ] In the Stripe Dashboard → **Developers → Webhooks → [your endpoint] → Recent deliveries**, verify a `customer.subscription.updated` webhook was delivered successfully (200 response from your endpoint).  
  _Pass criterion: the event appears in recent deliveries with a `200` response code and a delivery time within the last 2 minutes._
- [ ] In Supabase SQL Editor, verify `stripe_resolved_at` is now stamped on the `deletion_requests` row:

  ```sql
  SELECT id, status, stripe_resolved_at
  FROM deletion_requests
  WHERE status IN ('approved', 'in_review')
  ORDER BY created_at DESC
  LIMIT 1;
  ```

  _Pass criterion: `stripe_resolved_at` is non-null, and the timestamp is recent._

### Gate 3 — Community Disposition (`/dashboard/account/offboarding/disposition`)

- [ ] Navigate to `/dashboard/account/offboarding/disposition`.  
  _Pass criterion: disposition step renders; each community in the org has a disposition card._
- [ ] For a community **with active residents**: choose **Suspend** and save.  
  _Pass criterion: disposition card updates; no error. In Supabase, confirm `communities.suspended_reason` is set for that community._
- [ ] For a community **with zero active residents** (or after moving all residents out): choose **Close** and save.  
  _Pass criterion: disposition card updates. In Supabase, confirm `community_disposition` row has `action='close'` for that community._

  > If you only have one community and it has residents, you can only test Suspend here. Note it in sign-off and verify Close coverage in the integration test suite.

- [ ] Verify in Supabase that the `admin_notifications` table has a `community_suspended` row for the suspended community:

  ```sql
  SELECT id, type, community_id, created_at
  FROM admin_notifications
  WHERE type = 'community_suspended'
  ORDER BY created_at DESC
  LIMIT 1;
  ```

  _Pass criterion: a row exists with `type = 'community_suspended'` and `created_at` in the last 2 minutes._

### Screen 5 — Final Summary (`/dashboard/account/offboarding/finalize`)

- [ ] Navigate to `/dashboard/account/offboarding/finalize`.  
  _Pass criterion: Screen 5 renders — you see a summary of communities (each with its disposition), billing status (cancelled / effective date), and the data section (what gets wiped)._
- [ ] Verify the **"Cancel — I changed my mind"** button is visible.  
  _Pass criterion: cancel CTA is rendered and clickable (do not click it now unless aborting)._

### Two-tap "Close my account"

- [ ] Click **"Close my account"** once.  
  _Pass criterion: button text changes to **"Tap again to confirm"** (or equivalent armed state) — the account is NOT yet closed._
- [ ] Click **"Tap again to confirm"** within a few seconds.  
  _Pass criterion: the action submits; a loading state is shown._

### Screen 6 — Deletion complete (client state swap)

- [ ] Verify that Screen 6 renders in the same browser window — it should show a "Your account has been closed" full-page success state with the hard-delete date (today + 30 days) and a support contact.  
  _Pass criterion: Screen 6 content is visible; you have NOT been navigated to a new URL (it is a client-side state swap)._
- [ ] Check the PM's email inbox. The final confirmation email should arrive within 60 seconds.  
  _Pass criterion: email arrives with the PM's name, communities closed, and the 30-day hard-delete date._

### Post-closure verifications

- [ ] In **Stripe Dashboard → Customers**, locate the test PM's customer record.  
  _Pass criterion: customer name is **"Deleted Account"**; customer email ends with `@miyora.internal`; metadata contains `deleted_at` and `deletion_request_id`._

- [ ] Click **"Close this window"** (or the sign-out button on Screen 6).  
  _Pass criterion: you are signed out and redirected to `/login`. The PM's session is terminated._

- [ ] Attempt to sign back in with the original PM credentials.  
  _Pass criterion: sign-in fails because the `auth.users` row has been deleted. You cannot log in._

- [ ] In Supabase SQL Editor, run the following DB state verification queries:

  **PM PII nulled:**
  ```sql
  -- Replace <pm_id> with the actual property_manager id from deletion_requests
  SELECT id, full_name, email, phone, avatar_url, company_name
  FROM property_managers
  WHERE id = '<pm_id>';
  ```
  _Pass criterion: `full_name = '[deleted]'`, `email` starts with `'[deleted]-'`, `phone IS NULL`, `avatar_url IS NULL`, `company_name IS NULL`._

  **Org status deleted:**
  ```sql
  SELECT id, status, deleted_at
  FROM organizations
  WHERE id = '<org_id>';
  ```
  _Pass criterion: `status = 'deleted'`, `deleted_at` is non-null and recent._

  **Closed community soft-deleted:**
  ```sql
  SELECT id, name, deleted_at
  FROM communities
  WHERE organization_id = '<org_id>'
    AND deleted_at IS NOT NULL;
  ```
  _Pass criterion: the closed community has `deleted_at` set._

  **Suspended community untouched:**
  ```sql
  SELECT id, name, deleted_at, suspended_reason
  FROM communities
  WHERE organization_id = '<org_id>'
    AND deleted_at IS NULL;
  ```
  _Pass criterion: the suspended community has `deleted_at IS NULL`; `suspended_reason` is set._

  **Deletion request completed:**
  ```sql
  SELECT id, status, pii_wiped_at, soft_deleted_at, hard_deleted_at
  FROM deletion_requests
  WHERE org_id = '<org_id>'
  ORDER BY created_at DESC
  LIMIT 1;
  ```
  _Pass criterion: `status = 'completed'`, `pii_wiped_at` non-null, `soft_deleted_at` non-null, `hard_deleted_at IS NULL` (not yet expired — that is the cron's job)._

---

## 5. Cron + Scheduled Job Verification (5 min)

### Cron schedule in Vercel

- [ ] In **Vercel Dashboard → your project → Cron Jobs**, verify the cron `/api/cron/offboarding-hard-delete` is scheduled with the expression **`0 2 * * *`** (daily at 02:00 UTC).  
  _Pass criterion: entry is listed with the correct path and schedule._

### Manual trigger

- [ ] Click **"Run now"** (or the equivalent trigger button) on the cron job entry in the Vercel Dashboard.
- [ ] View the resulting function log. Look for the line:

  ```
  [cron:offboarding-hard-delete] processed=N errored=0
  ```

  where N ≥ 0 (N = 0 is fine if no requests have aged past 30 days yet).  
  _Pass criterion: the log line appears; `errored=0`; no uncaught exception or 500 response in the log._

### Unauthorized access rejection

- [ ] From a terminal, run:

  ```bash
  curl -i https://<PROD_URL>/api/cron/offboarding-hard-delete
  ```

  (No `Authorization` header.)  
  _Pass criterion: response is `HTTP 401`. The body can be anything. No DB operation is performed._

- [ ] Optionally verify with a wrong secret:

  ```bash
  curl -i -H "Authorization: Bearer wrong-secret" https://<PROD_URL>/api/cron/offboarding-hard-delete
  ```

  _Pass criterion: response is `HTTP 401`._

---

## 6. Mobile-App Cross-Cutting Checks (10 min)

> **Note:** The mobile app is a separate React Native repository sharing the same Supabase project. These checks require a device or simulator running the mobile app. The admin portal can trigger the events; the mobile-side observation must be confirmed by a tester with access to the mobile app.

### Realtime alerts — admin to mobile

- [ ] From the admin portal, post a new **Alert** to a community with at least one active resident.
- [ ] On the mobile device (logged in as a resident of that community), verify the alert notification appears within a few seconds.  
  _Pass criterion (mobile-side): push notification or in-app notification arrives; content matches the alert posted from admin._

  > If the mobile device is not available during this window, note "mobile realtime deferred" in sign-off. It is not a launch blocker if core admin-to-DB writes are confirmed working (checked in Section 3).

### Realtime pending user flow

- [ ] From the mobile app, sign up a new resident for one of the admin's communities.
- [ ] In the admin portal → community → **Pending** tab, verify the new pending user row appears within a few seconds (realtime subscription).  
  _Pass criterion: no manual page refresh needed; the row appears live._

  > If mobile sign-up is not available during this window, simulate by inserting a `pending_users` row directly via Supabase SQL Editor and confirming the admin UI updates in realtime.

### Suspend disposition — `admin_notifications` row

- [ ] This was verified in Section 4 (Gate 3). Cross-reference:

  ```sql
  SELECT id, type, community_id, created_at
  FROM admin_notifications
  WHERE type = 'community_suspended'
  ORDER BY created_at DESC
  LIMIT 1;
  ```

  _Pass criterion: row exists with `type = 'community_suspended'`._

  > Mobile-side consumption of `community_suspended` notifications is a separate workstream and is NOT verified here. Confirm with the mobile team that they have a listener before marking residents as affected.

---

## 7. Rollback Plan

**If a critical bug is found during the smoke test**, do not attempt a hotfix under time pressure. Instead:

1. **Revert Vercel deployment:** In **Vercel Dashboard → Deployments**, find the previous successful "Ready" deployment (prior to the Phase 4 merge `5475105`). Click the `…` menu → **"Promote to Production"**. This restores the previous frontend/API code within 30-60 seconds and requires no git operations.

2. **Database rollback considerations:** Migration 031 added two RPCs (`complete_pm_offboarding` and `hard_delete_expired_offboarding`) and made `subscription_history.community_id` nullable. These changes are **safe to leave in place** even after a Vercel rollback:
   - The two RPCs are callable only by the service role; they are harmless if unused by the rolled-back frontend.
   - The nullable column is a permissive change — older code that always writes a `community_id` will continue to work correctly.
   - If for any reason the RPCs must be removed (e.g., they conflict with a hotfix), they can be dropped with `DROP FUNCTION public.complete_pm_offboarding(uuid, jsonb)` and `DROP FUNCTION public.hard_delete_expired_offboarding()` — no data loss.

3. **Offboarding requests stuck mid-flight:** If a PM initiated the offboarding flow and the bug was encountered mid-flow, the partial unique index `deletion_requests_one_open_per_pm_idx` allows the PM's request to be reset by updating its status to `'cancelled'` in the SQL Editor. The PM can re-initiate cleanly. No orphaned rows or cascading cleanup is needed in the normal case.

4. **Stripe subscriptions:** Any Stripe subscription that was set to `cancel_at_period_end = true` during smoke testing remains in that state. If the test PM's subscription needs to be restored, reactivate it in the Stripe Dashboard (Subscriptions → [sub] → Update). This does not affect other customers.

---

## When to Abort the Launch

Stop the launch immediately and do not proceed to general availability if any of the following red-flag conditions are observed:

- [ ] **Missing critical env vars:** Any of `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OFFBOARDING_APPROVAL_SECRET`, or `CRON_SECRET` is absent from the Vercel Production environment.

- [ ] **Migration 031 not applied:** The SQL query in Section 1 returns fewer than 2 rows for the RPCs. The offboarding completion flow will throw a "function does not exist" error at runtime.

- [ ] **Stripe webhook signature failures:** Recent deliveries in the Stripe Dashboard show `400` responses from your endpoint on `customer.subscription.updated` or `customer.subscription.deleted`. This means `STRIPE_WEBHOOK_SECRET` is mismatched — billing resolution will never fire and `deletion_requests` will stay stuck in `in_review`.

- [ ] **Corp approval link broken (4xx/5xx):** The approval form at `/offboarding/approve?token=…` returns 404 or 401. No offboarding request can ever be approved, making the entire feature non-functional.

- [ ] **Auth user deletion failing during smoke test:** The PM was still able to log in after completing the two-tap closure. Check the audit log on the `deletion_requests` row for an `auth_delete_failed` entry. If confirmed, the auth deletion path has a runtime error — accounts will not actually be locked out.

- [ ] **`deletion_requests` stuck in `approved` state:** After the two-tap close completes and Screen 6 renders, the DB row still shows `status = 'approved'` rather than `completed`. This means `complete_pm_offboarding` did not commit — PM PII has not been wiped. Do not launch.

- [ ] **Cron returns 500 on manual trigger:** The function log shows an uncaught exception or the Vercel log shows a 500 response. A broken cron means soft-deleted accounts will never be hard-deleted and could accumulate indefinitely.

- [ ] **Cron route does not enforce authorization:** `curl -i https://<PROD_URL>/api/cron/offboarding-hard-delete` (no `Authorization` header) returns anything other than `401`. The cron endpoint is publicly accessible and can be abused to trigger hard deletes.

- [ ] **Production URL unreachable or returns 5xx at the root:** The deployment itself failed. No features are available.

---

## Sign-off

| Field | Value |
|---|---|
| **Tester name** | |
| **Date** | |
| **Time completed** | |
| **Vercel deployment SHA** | |
| **Decision** | `GO` / `NO-GO` |
| **Notes / deferred items** | |

If **NO-GO**: list the specific failing items and the rollback action taken.

If **GO**: confirm all sections 1–6 passed (or deferred items are explicitly accepted risk), sign here, and notify the team.

---

_Checklist version: 2026-05-16. Covers release up to and including commit `1142f7d` (Phase 4 — PM Account Offboarding completion + cron hard-delete). Phase 5 (transfer flow) is not included._

---

## Day 3 Smoke Test Results — 2026-05-19

**Environment:** `miyora-admin-portal-two.vercel.app` (live-mode Stripe, live Resend, prod Supabase project `jytmdphkjphpaiuvhbaf`).
**Tester:** Alajuwon Thomas.
**Decision:** `NO-GO` — verified core flows work, but discovered 5 items below that must clear before public launch.

### Verified working end-to-end ✅

- **Resend SMTP via Supabase** — auth emails (signup confirmation, invite) deliver from `Miyora <noreply@miyora-app.com>`.
- **Direct Resend transactional email** — full offboarding pipeline:
  - Corp approval request → corp contact inbox ✓
  - Deletion request received → PM inbox ✓
  - Corp decision notice → PM inbox (after corp officer approval at `/offboarding/approve`) ✓
- **Stripe checkout (live mode)** — onboarding wizard → Stripe Checkout → success route → dashboard, with a real card on the 14-day trial.
- **Onboarding wizard** — Step 1 prefix gap polish ("Miyora @" padding 115px → 90px) deployed.
- **Welcome modal** — fixed-position overlay now renders correctly over the dashboard (was being demoted to `position: relative` by `.nly-mesh-bg > *` rule).
- **BillingClient `allResolved`** — now accepts `cancel_scheduled` and `stripe_cancel_at`-truthy as resolved, not just `canceled`. Trial users with scheduled cancellations can now advance through the offboarding wizard.

### Launch-blocking issues discovered

1. **Signup `property_managers` 401** — client-side `.insert()` after `auth.signUp` runs without a session when "Confirm email" is on. **Workaround:** "Confirm email" was disabled tonight to unblock the test. **Real fix:** Postgres trigger on `auth.users` insert that creates the PM row from user metadata; remove the client-side insert. See `app/(auth)/signup/page.tsx` ~line 58.
2. **"Confirm email" is currently OFF in Supabase** — must be re-enabled after #1 is fixed. Unverified signups are accepted as of right now.
3. **Trailing `\n` in `NEXT_PUBLIC_SUPABASE_ANON_KEY`** — Vercel prod env stores the value with a literal newline at the end. Currently tolerated, but a latent bug. Fix by removing and re-adding via `printf '%s'` piping.
4. **Schema drift after May 18 DB wipe** — `public.onboarding_sessions` was missing in prod (PGRST205 from Stripe checkout). Re-applied migration 005 via SQL editor tonight. Other tables may also be missing — schema-diff against `supabase/migrations/` before launch.
5. **Live-mode trial subscription on a real card** — testing required a real card because Stripe is in live mode. The 14-day trial subscription must be canceled in Stripe dashboard before 2026-06-02.

### Auth setup applied

- Supabase Custom SMTP wired to Resend — config recorded in `docs/SUPABASE_AUTH_CONFIG.md`.
- Auth rate limit bumped to 100 emails/hour (from 30) to accommodate active testing.
- `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` re-added without `--sensitive` flag earlier in the day (yesterday's fix) — offboarding email links now point to prod, not localhost.
- `RESEND_API_KEY`, `STRIPE_*` env vars confirmed present in Vercel production.
