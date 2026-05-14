# PM Account Offboarding — Phase 4 Design

**Status:** Approved 2026-05-14
**Scope:** Gate 5 (PII wipe) + Screens 5–6 + Gate 6 (30-day soft delete → cron hard delete)
**Builds on:** Phase 1 (foundation, migration 024) + Phase 2 (deletion request through corp approval, migrations 025–026) + Phase 3 (billing gate + community disposition, migrations 027–030)
**Defers to:** Phase 5 (Transfer flow)

---

## Goal

After a property manager finalizes community dispositions, the deletion request sits at `status='approved'` and the PM lands on `/finalize` (currently a stub). Phase 4 replaces that stub with:

1. **Screen 5 — final confirmation.** A summary of what will happen (communities, billing, data), with a two-tap "Close my account" button.
2. **Gate 5 — PII wipe.** Null the PM's personal data, mark the organization deleted, soft-delete closed communities, anonymize the Stripe customer, delete the `auth.users` row, send the final confirmation email. Status advances `approved → completed`.
3. **Screen 6 — deletion complete.** A full-page success state, then sign-out.
4. **Gate 6 — cron hard delete.** A daily Vercel cron job hard-deletes the organization, closed communities, and PM row 30 days after `soft_deleted_at`. The `deletion_requests` row is retained for 7 years.

End state of this PR: a PM can complete their own account closure end-to-end, and a scheduled job reclaims the soft-deleted rows after the 30-day window.

---

## Non-goals

- Transfer disposition / transfer flow (deferred to Phase 5)
- Real GDPR data export — per the Phase 1 decision, the final email tells the PM to contact `support@neighborlyy.com` within 30 days for an export
- Rewriting resident `community_code` values to `[CLOSED-{code}]` — see "Resident data" decision below
- Co-owner / multi-PM organization survival — no co-owner concept exists in the schema; orgs are 1:1 with a PM today
- Resident push notifications (CC-6) — already handled as an `admin_notifications` stub in Phase 3; no new work here

---

## Forward-compatibility constraints (carried from Phase 3)

1. **No status values between `approved` and `completed`.** Phase 4's entry point is `status='approved'`; it transitions directly to `completed` (or stays `approved` on a retryable failure). No `pii_wiping` / `cleanup_in_progress` intermediate states — adding them would force a CHECK-constraint migration.
2. **Transfer stays gated by `CAN_USE_TRANSFER`.** Not touched by Phase 4, but the disposition card and server action must remain as Phase 3 left them.

---

## Key decisions

### Resident data (Gate 4) — keep residents untouched

The deletion-flow doc describes rewriting each resident's `community_code` to `[CLOSED-{code}]` for suspended/closed communities. Phase 4 does **not** do this. Residents stay pointed at their community row, which itself carries `suspended_reason` (set in Phase 3) or `deleted_at` (set in Phase 4 for closed communities). Rationale: it honors the "residents are never touched" non-negotiable rule, avoids a risky mass-update of resident rows, and the mobile workstream is not yet ready to consume a renamed code. The `[CLOSED-]` convention can be introduced later, in lockstep with the mobile app.

### Stripe customer anonymization — best-effort, non-fatal

The subscription was already cancelled in Phase 3 (Gate 2). Phase 4's only Stripe touchpoint is anonymizing the customer record (name + email + metadata) for GDPR. If it fails, the action logs loudly, appends an audit entry, and proceeds — the account closure is not blocked. The "Stripe resolved in the same transaction" non-negotiable rule refers to *cancellation*, which already completed; customer anonymization is cosmetic and retryable.

### Cron platform — Vercel Cron

The hard-delete runs as a Vercel cron job hitting an in-repo route handler, guarded by `CRON_SECRET` (already in `.env.local`). This keeps the schedule in the admin-portal repo and out of the shared Supabase project, consistent with the project constraint that migrations/DB-scheduling on the shared DB go through the SQL editor only.

### Final email — best-effort, non-fatal

The final confirmation email is sent before the PM's email is nulled. If Resend fails, the action logs + audits `final_email_failed` and still proceeds: the PM has double-confirmed closure, and the 30-day window plus the support contact is the safety net. (Email send happens *before* the DB commit point, so a failure here is recorded but does not strand the request.)

---

## Orchestration approach

The wipe touches four systems — Resend (email), Stripe (customer anonymization), Supabase Auth (`auth.users`), and the database. Approach: **one atomic Postgres RPC for all DB mutations, with the external calls sequenced around it in the server action.** This matches the existing precedent (`set_community_disposition`, `append_audit_entry`) — no read-modify-write races, and partial-failure behavior is well-defined per step.

Rejected alternatives: all-in-server-action (race-prone, no atomicity if a mid-sequence query fails); background queue (no queue infra, and the PM is waiting on the page for confirmation).

---

## Architecture

### File layout

```
supabase/migrations/
  031_pm_offboarding_completion.sql           NEW — complete_pm_offboarding + hard_delete_expired_offboarding RPCs + cron index

app/(dashboard)/dashboard/account/offboarding/
  finalize/
    page.tsx                                  MODIFIED — replace stub with Screen 5 summary
    actions.ts                                NEW — completeOffboarding server action
    FinalConfirmation.tsx                     NEW — client: two-tap close, Screen 5 → Screen 6 state swap

app/api/cron/offboarding-hard-delete/
  route.ts                                    NEW — CRON_SECRET-guarded handler, calls hard_delete_expired_offboarding

lib/email/templates/
  deletion-complete.ts                        NEW — final confirmation email template

lib/offboarding/
  completion.ts                               NEW — pure helpers (which communities to soft-delete, cron-eligibility predicate)

app/(dashboard)/dashboard/account/
  actions.ts                                  MODIFIED — remove @deprecated deleteAccount (+ now-dead helpers/UI it solely fed)

vercel.json                                   NEW — daily cron schedule
.env.example                                  MODIFIED — document STRIPE_SECRET_KEY, CRON_SECRET if not already present
```

---

## Data model — migration 031

Two SECURITY DEFINER functions (search_path pinned to `public, pg_temp`, `REVOKE EXECUTE FROM anon, authenticated, public` — admin/cron only), plus one partial index.

### `complete_pm_offboarding(p_request_id uuid, p_audit jsonb)`

Atomic. Guarded by `WHERE status = 'approved'` so it cannot double-run or run out of order. In a single transaction:

```
1. property_managers (WHERE id = req.pm_id):
     full_name    → '[deleted]'              -- column is NOT NULL; cannot null it
     phone        → NULL
     avatar_url   → NULL
     company_name → NULL
     email        → '[deleted]-' || id::text -- column is NOT NULL UNIQUE
   -- Schema adaptation: the compliance doc lists first_name/last_name → null and
   -- email → '[deleted]', but property_managers has a single NOT NULL full_name
   -- and a NOT NULL UNIQUE email. full_name is set to the '[deleted]' sentinel;
   -- email is set to a per-row-unique sentinel ('[deleted]-{pm_id}') so it both
   -- satisfies the unique constraint across multiple deletions AND frees the
   -- real address for re-signup.

2. organizations (WHERE id = req.org_id):
     status     → 'deleted'
     deleted_at → now()

3. communities — soft-delete ONLY the closed ones:
     UPDATE communities SET deleted_at = now()
     WHERE id IN (community_ids whose disposition action = 'close')
       AND deleted_at IS NULL
   -- Suspended communities keep suspended_reason and survive — they await a new PM.

4. deletion_requests (WHERE id = p_request_id AND status = 'approved'):
     pii_wiped_at    → now()
     soft_deleted_at → now()
     status          → 'completed'
     audit_log       → audit_log || p_audit   (append, via the existing immutability trigger)

5. RETURN the affected request row (or a row count) so the action can detect a
   no-op (e.g. status was not 'approved').
```

The closed-community set is derived inside the function from `deletion_requests.community_disposition` (the jsonb array of `{ community_id, action, ... }` entries written in Phase 3).

### `hard_delete_expired_offboarding()`

Called by the cron route. For every `deletion_requests` row where
`status = 'completed' AND soft_deleted_at < now() - interval '30 days' AND hard_deleted_at IS NULL`:

```
1. DELETE FROM communities    WHERE organization_id = req.org_id AND deleted_at IS NOT NULL;
2. DELETE FROM organizations  WHERE id = req.org_id AND status = 'deleted';
3. DELETE FROM property_managers WHERE id = req.pm_id;
   -- deletion_requests.pm_id / org_id are ON DELETE SET NULL, so these deletes
   -- null those FKs but leave the audit row intact. actor_id in audit_log
   -- entries is a plain text field, so actor history survives.
4. UPDATE deletion_requests SET hard_deleted_at = now(),
     audit_log = audit_log || <cron audit entry>
   WHERE id = req.id;
   -- The deletion_requests row itself is RETAINED (7-year compliance retention).
5. RETURN a summary: count of requests processed + affected ids.
```

### Index

```sql
CREATE INDEX IF NOT EXISTS deletion_requests_hard_delete_due_idx
  ON deletion_requests (soft_deleted_at)
  WHERE status = 'completed' AND hard_deleted_at IS NULL;
```

---

## Server action — `finalize/actions.ts › completeOffboarding()`

Sequenced around the atomic RPC. External calls happen first (they need pre-wipe data); the RPC is the commit point; auth deletion happens last (after status is already `completed`, so a failure there is recoverable).

```
1. Auth + load the PM's deletion request at status='approved'
   (reuse the loadPmAndRequest pattern from disposition/actions.ts).
   If none → { ok:false, "No account closure in progress" }.

2. Send final email (lib/email/templates/deletion-complete.ts) to pm.email.
   Best-effort: on failure → console.warn + appendAudit('final_email_failed'),
   then continue. (Runs before the DB commit, so a failure is recorded but
   does not strand the request.)

3. Anonymize Stripe customer(s): for each community with a stripe_customer_id,
   stripe.customers.update(id, {
     name: 'Deleted Account',
     email: `deleted-${pm_id}@neighborlyy.internal`,
     metadata: { deleted_at, deletion_request_id },
   }).
   Best-effort: on failure → console.warn + appendAudit('stripe_anonymize_failed'),
   continue. On success → appendAudit('stripe_anonymized').

4. Call complete_pm_offboarding(request_id, <pii_wiped audit entry>).
   THE COMMIT POINT. If it errors or reports a no-op (status not 'approved')
   → return { ok:false, retryable error }. Nothing irreversible has happened
   to the DB yet (steps 2–3 only appended audit + touched Stripe).

5. Delete the auth user: admin.auth.admin.deleteUser(user.id).
   Best-effort: status is already 'completed', so a failure is recoverable
   (cron / manual retry). On failure → console.warn + appendAudit('auth_delete_failed').
   On success → appendAudit('auth_deleted'). Frees the email for re-signup.

6. Return { ok: true }. NO revalidatePath — see "Screen 6" below.
```

Audit entries appended throughout via the existing `append_audit_entry` RPC. The `complete_pm_offboarding` RPC takes its primary audit entry inline (`pii_wiped`, listing the nulled fields) so it commits atomically with the status change; the best-effort steps append their own entries separately.

---

## Screens 5 & 6

### Screen 5 — `finalize/page.tsx` (replaces the stub)

Server component:
- Loads the `approved` deletion request, the org's communities, the `community_disposition` array, and billing state (`stripe_subscription_status`, `stripe_cancel_at`).
- Renders the summary, scaled to the spec at `03-UX-SCREENS.md` Screen 5:
  - **Communities** — one line per community with its disposition (Suspended / Closed and archived).
  - **Billing** — "Subscription cancelled, effective {stripe_cancel_at}" (or "No active subscription").
  - **Your data** — what gets wiped (name, email, phone) · login disabled immediately · residents' data preserved · compliance record retained.
  - 30-day cancel window note + support contact.
- Renders `<FinalConfirmation requestId={...} />`.

### `FinalConfirmation.tsx` (client)

- Two buttons: "Cancel — I changed my mind" (calls existing `cancelDeletionRequest`) and a red "Close my account" button using the **two-tap pattern** (first tap arms, second tap within a few seconds confirms — no accidental closures).
- Second tap → `completeOffboarding()`.
- On `{ ok:false }` → toast the error, stay on Screen 5 (retryable).
- On `{ ok:true }` → swap component state to render **Screen 6** (see below).

### Screen 6 — deletion complete (client-side state swap, NOT a route)

Screen 6 is rendered as a state inside `FinalConfirmation`, not a separate page. Reason: once `completeOffboarding` flips `status` to `completed`, the layout guard redirects any navigation to `/dashboard/account` away from the offboarding tree — and the PM's PII/auth is gone — but the browser session is still alive in memory until we explicitly sign out. A client state swap sidesteps both problems.

- Renders the full-page success state per `03-UX-SCREENS.md` Screen 6 (what was done, hard-delete date = now + 30 days, support contact).
- "Close this window" button → `supabase.auth.signOut()` → `router.push('/login')`.
- `completeOffboarding` deliberately does **not** call `revalidatePath` — an RSC refetch of `/finalize` would trip the layout guard mid-screen.

---

## Cron hard-delete

### `app/api/cron/offboarding-hard-delete/route.ts`

```
export const runtime = "nodejs";

GET handler:
  1. Verify Authorization: Bearer ${CRON_SECRET}
     (Vercel Cron sends this header automatically when CRON_SECRET is set).
     Missing/mismatch → 401.
  2. admin.rpc('hard_delete_expired_offboarding').
  3. Return JSON summary { processed, affected }.
  4. On RPC error → 500 + log (Vercel surfaces failed cron invocations).
```

### `vercel.json` (new)

```json
{
  "crons": [
    { "path": "/api/cron/offboarding-hard-delete", "schedule": "0 2 * * *" }
  ]
}
```

Daily at 02:00 UTC, per `04-COMPLIANCE.md` ("Scheduled — daily at 02:00 UTC").

---

## Layout guard + legacy cleanup

- `offboarding/layout.tsx` already routes `status='approved'` to `/finalize` and bounces `completed`/`cancelled`/`blocked` to `/dashboard/account`. **No change needed** — Phase 4 only verifies this in tests.
- Remove the `@deprecated deleteAccount` export from `app/(dashboard)/dashboard/account/actions.ts`. Before removing, confirm whether `getTeamMembersForTransfer` and any Danger Zone UI component were *solely* feeding the legacy direct-delete path; if so, remove them too. If anything still references `deleteAccount`, repoint it at the offboarding flow or remove the caller.

---

## Error handling

| Scenario | Behavior |
|---|---|
| No `approved` request when `completeOffboarding` runs | `{ ok:false, "No account closure in progress" }`; layout guard would also have bounced them |
| Final email send fails | Logged + audited `final_email_failed`; wipe proceeds |
| Stripe customer anonymization fails | Logged + audited `stripe_anonymize_failed`; wipe proceeds |
| `complete_pm_offboarding` RPC errors | `{ ok:false }` retryable; no DB mutation committed; PM stays on Screen 5 |
| `complete_pm_offboarding` reports no-op (status ≠ approved) | Treated as already-done / concurrent run; `{ ok:false }` retryable, action re-checks on retry |
| `auth.admin.deleteUser` fails | Logged + audited `auth_delete_failed`; status already `completed`; cron/manual retry; layout guard bounces residual logins |
| Direct nav to `/finalize` with non-`approved` status | Layout guard redirects (unchanged from Phase 3) |
| Cron route hit without valid `CRON_SECRET` | 401, no DB access |
| `hard_delete_expired_offboarding` errors mid-batch | Per-request work is committed individually; cron returns 500; next run picks up the rest (idempotent — `hard_deleted_at IS NULL` guard) |
| PM cancels on Screen 5 | Existing `cancelDeletionRequest`; status → `cancelled`; layout guard bounces on next render |

---

## Testing

**Unit (`lib/offboarding/completion.ts` helpers + RPC logic):**
- "which communities get soft-deleted" — only `action='close'` entries, not `suspend`.
- Cron-eligibility predicate — `completed` + `soft_deleted_at` older than 30 days + `hard_deleted_at IS NULL`; rejects each failing condition.
- `completeOffboarding` order-of-operations with email/Stripe/auth/RPC mocked: RPC failure aborts *before* auth deletion; email + Stripe failures do *not* abort; auth failure does not flip status back.

**Integration (against the shared remote DB, seeded test org):**
- Full wipe: seed an `approved` request → `completeOffboarding` → PM PII nulled, `email='[deleted]'`, org `status='deleted'` + `deleted_at` set, closed communities `deleted_at` set, suspended communities untouched, request `status='completed'` with `pii_wiped_at`/`soft_deleted_at` set, `auth.users` row gone.
- Cron: seed a `completed` request with `soft_deleted_at` 31 days ago → `hard_delete_expired_offboarding` → org/closed-community/PM rows deleted, `deletion_requests` row retained with `hard_deleted_at` set. A request only 5 days old is left alone.

**E2E (Playwright, chromium — follows the Phase 3 spec patterns):**
- Screen 5 renders the summary for an `approved` request (communities + billing + data sections).
- Two-tap "Close my account" → Screen 6 success state renders.
- Layout guard: `/finalize` with `completed` status redirects to `/dashboard/account`.
- Stripe / auth-delete / email are mocked or stubbed at the seam (real end-to-end Stripe is a manual PR-checklist item).

**Manual / PR-description checklist:**
- Real Stripe customer anonymization against a live test customer.
- Vercel cron invocation in a preview/prod deploy (confirm the `Authorization` header check passes).

---

## Risks

| Risk | Mitigation |
|---|---|
| `auth.admin.deleteUser` succeeds but RPC already failed → PM locked out, status not `completed` | RPC runs *before* auth deletion; auth deletion only happens after a successful commit |
| Stripe keys / Resend keys absent at runtime → steps throw | Both steps are best-effort and audited; the wipe still completes. Prerequisite checklist (below) covers getting real keys in place |
| Cron double-fires or overlaps | `hard_delete_expired_offboarding` is idempotent — the `hard_deleted_at IS NULL` guard means a second run is a no-op for already-processed rows |
| Layout guard refetch trips mid-Screen-6 | `completeOffboarding` omits `revalidatePath`; Screen 6 is a client state swap, not a navigation |
| Removing `deleteAccount` breaks a caller | Grep for references before removal; repoint or remove callers in the same PR |
| Co-owner org incorrectly marked deleted | Documented non-goal — no co-owner concept in the schema today; revisit if/when multi-PM orgs exist |

---

## Prerequisites (before end-to-end runs — not blocking spec/plan work)

`.env.local` currently has `CRON_SECRET` and a placeholder `STRIPE_WEBHOOK_SECRET`, but **no `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, or `RESEND_FROM_EMAIL`**. Before Phase 4's email + Stripe steps can run for real:
- Add the real `STRIPE_SECRET_KEY` and real `STRIPE_WEBHOOK_SECRET` (from the Stripe dashboard webhook endpoint) — locally **and** in Vercel.
- Confirm `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are set in both environments.

The user will provide the Stripe keys when implementation is ready for them.

---

## Acceptance criteria

1. Migration 031 applies cleanly on the shared remote DB; both RPCs exist with `EXECUTE` revoked from `anon`/`authenticated`/`public`.
2. `complete_pm_offboarding` atomically nulls PM PII, marks the org deleted, soft-deletes only closed communities, sets `pii_wiped_at`/`soft_deleted_at`/`status='completed'`, and appends the `pii_wiped` audit entry — all guarded by `status='approved'`.
3. `completeOffboarding` sequences email → Stripe → RPC → auth-delete; external-call failures are audited but non-fatal; RPC failure aborts before auth deletion.
4. Screen 5 renders the communities/billing/data summary for an `approved` request; two-tap "Close my account" works; "Cancel" still works.
5. Screen 6 renders as a client state swap on success; "Close this window" signs the PM out.
6. The cron route rejects requests without a valid `CRON_SECRET` and otherwise runs `hard_delete_expired_offboarding`; `vercel.json` schedules it daily at 02:00 UTC.
7. `hard_delete_expired_offboarding` deletes org/closed-community/PM rows past the 30-day window, retains the `deletion_requests` row, sets `hard_deleted_at`, and is idempotent.
8. The `@deprecated deleteAccount` export (and any now-dead helpers/UI) is removed; the build is clean.
9. Unit + integration + e2e suites pass; code review pass before merge (per project workflow).
