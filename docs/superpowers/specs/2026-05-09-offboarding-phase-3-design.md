# PM Account Offboarding — Phase 3 Design

**Status:** Approved 2026-05-09
**Scope:** Gate 2 (Stripe billing review) + Gate 3 (Community disposition)
**Builds on:** Phase 1 (foundation, migration 024) + Phase 2 (deletion request through corp approval, migration 025) + Phase 2 hardening (migration 026)
**Defers to:** Phase 4 (PII wipe + soft delete + cron hard delete), Phase 5 (Transfer flow)

---

## Goal

After corporation approval lands a deletion request in `status='in_review'`, walk the property manager through:

1. **Billing review (Gate 2)** — schedule end-of-period cancellation on every community subscription. Webhook-driven fan-in flips `stripe_resolved_at`.
2. **Community disposition (Gate 3, Screen 4)** — pick a fate per community (Suspend, Close & archive). Transfer is disabled in this PR. Status advances to `approved`.

End state of this PR: status reaches `approved` and the PM lands on a `/finalize` stub that Phase 4 will replace with Screens 5–6.

---

## Non-goals

- Transfer disposition (deferred to Phase 5)
- PII wipe / soft delete / cron / Screens 5–6 (Phase 4)
- Resident push notifications (CC-6) — only the `admin_notifications` row insert ships; mobile-side consumption is a separate workstream
- Real GDPR data export (per Phase 1 decision: stub email tells PM to contact support within 30 days)

---

## Forward-compatibility constraints (must not be violated)

These are guardrails for future phases. Violating them creates migrations or refactors later.

1. **Transfer disposition must be gated by a single capability flag, not a separate code path.** The disposition card renders the Transfer radio in this PR but disabled. When Phase 5 ships, enabling it must be a one-line flag flip — not a UI rewrite or a duplicate component. Concretely: `<TransferOption disabled={!CAN_USE_TRANSFER} />` where `CAN_USE_TRANSFER` is a single boolean defined in `lib/offboarding/feature-flags.ts`.

2. **No status values between `approved` and `completed`.** Phase 4's entry point is `status='approved'`. Adding intermediate statuses (`pii_wiping`, `cleanup_in_progress`, etc.) would force a migration to the CHECK constraint and break the Phase 4 plan. Phase 3 sets `approved` and stops; Phase 4 picks up there and transitions to `completed` (or `blocked`) directly.

---

## Architecture

### File layout

```
supabase/migrations/
  027_offboarding_helper_views.sql           NEW

app/(dashboard)/dashboard/account/offboarding/
  layout.tsx                                  NEW — guard: redirects based on status
  billing/
    page.tsx                                  NEW — Server component
    actions.ts                                NEW — cancelSubscription, markBillingResolved
    BillingClient.tsx                         NEW — Realtime + stall handling
  disposition/
    page.tsx                                  NEW — Server component
    actions.ts                                NEW — setCommunityDisposition, finalizeDispositions
    DispositionCards.tsx                      NEW — Client per-card form
  finalize/
    page.tsx                                  NEW — Phase 4 stub

app/api/webhooks/stripe/route.ts              NEW — signature verify + handlers

lib/stripe/client.ts                          NEW — shared `getStripe()` factory
lib/offboarding/disposition.ts                NEW — types, eligibility helpers
lib/offboarding/feature-flags.ts              NEW — CAN_USE_TRANSFER flag

components/dashboard/OffboardingStatusCard.tsx  MODIFIED — "Continue" CTA when in_review
app/api/stripe/checkout/route.ts                MODIFIED — use lib/stripe/client.ts
app/api/stripe/checkout/success/route.ts        MODIFIED — use lib/stripe/client.ts
.env.example                                    MODIFIED — add STRIPE_WEBHOOK_SECRET
```

---

## Data model — migration 027

```sql
-- 1. Webhook idempotency. Stripe retries on non-2xx; we must not double-process.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id           text        PRIMARY KEY,        -- Stripe event id (evt_...)
  type         text        NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb       NOT NULL
);
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies. Service role only.

-- 2. Mirror Stripe sub state on communities so the billing UI doesn't hit
--    Stripe on every render.
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,   -- 'active','canceled','past_due', etc.
  ADD COLUMN IF NOT EXISTS stripe_cancel_at           timestamptz;

-- 3. Per-community summary view for Screen 4 cards. RLS inherits from
--    underlying tables (profiles, pending_users, events, help_requests).
--    "Active resident" = approved profile (per design decision).
CREATE OR REPLACE VIEW community_audit_summary AS
SELECT
  c.id            AS community_id,
  c.community_code,
  c.name,
  c.organization_id,
  COUNT(DISTINCT p.id)  FILTER (WHERE p.status IS DISTINCT FROM 'pending'
                                  AND p.status IS DISTINCT FROM 'rejected') AS active_residents,
  COUNT(DISTINCT pu.id)                                                     AS pending_residents,
  COUNT(DISTINCT e.id)  FILTER (WHERE e.event_date >= now())                AS upcoming_events,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.status = 'open')                   AS open_help_requests
FROM communities c
LEFT JOIN profiles       p  ON p.community_code = c.community_code
LEFT JOIN pending_users  pu ON pu.community_code = c.community_code
LEFT JOIN events         e  ON e.community_code = c.community_code
LEFT JOIN help_requests  hr ON hr.community_code = c.community_code
GROUP BY c.id, c.community_code, c.name, c.organization_id;
```

**Implementation note:** column names (`event_date`, `status`, `community_code`) are assumed; verify against actual schema with `\d profiles`, `\d events`, `\d help_requests` before applying.

---

## Stripe webhook flow

`POST /api/webhooks/stripe`

```
1. Read raw body + Stripe-Signature header
2. stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
   - throws on bad sig → return 400
3. INSERT INTO stripe_webhook_events (id, type, payload) ON CONFLICT DO NOTHING
   - if 0 rows, return 200 (already processed)
4. Switch on event.type:

   customer.subscription.updated:
     UPDATE communities
        SET stripe_subscription_status = event.data.object.status,
            stripe_cancel_at = event.data.object.cancel_at
      WHERE stripe_subscription_id = event.data.object.id
        AND stripe_subscription_status IS DISTINCT FROM event.data.object.status

   customer.subscription.deleted:
     UPDATE communities
        SET stripe_subscription_status = 'canceled'
      WHERE stripe_subscription_id = event.data.object.id;
     -- then run fan-in (see below)

   invoice.payment_failed:
     -- Find PM via customer → community → org → active deletion request
     UPDATE deletion_requests
        SET status = 'billing_blocked'
      WHERE org_id = (lookup)
        AND status = 'in_review';

5. Fan-in (only after subscription.deleted):
   For each open deletion request whose org owns the canceled sub:
     IF every community.stripe_subscription_id is NULL OR
        every community.stripe_subscription_status = 'canceled':
       UPDATE deletion_requests
          SET stripe_resolved_at = now()
        WHERE id = req.id AND stripe_resolved_at IS NULL;
       appendAudit('deletion_requests', req.id, {actor:'system', action:'billing_resolved'})

6. Return 200
```

**Trust boundary:** never trust a webhook's claimed PM/org. Always look up by `stripe_subscription_id` (which is server-issued and uniquely indexed) and follow the FK chain.

**Idempotency:** at three layers — (a) `ON CONFLICT DO NOTHING` on the events table, (b) `WHERE` clauses on the actual UPDATEs that no-op if already in target state, (c) `stripe_resolved_at IS NULL` guard on the fan-in update.

---

## Billing gate (Gate 2)

`/dashboard/account/offboarding/billing` — server component:

- Queries `communities` for the PM's org with `(name, stripe_subscription_id, stripe_subscription_status, stripe_cancel_at)`
- If zero communities have an active sub → call `markBillingResolved` server action and `redirect('/dashboard/account/offboarding/disposition')`
- Otherwise render a list of communities with current status and a per-community "Schedule cancellation" button

Server action `cancelSubscription(communityId)`:
1. Verify community belongs to PM's org (admin client + manual check)
2. `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`
3. Mirror state change to communities row optimistically (webhook will confirm)
4. Append audit
5. Return success

`BillingClient.tsx` (client component):
- Subscribes to realtime on `deletion_requests` row (already enabled in migration 025)
- Also subscribes to `communities` row updates for live status (extend realtime publication in 027 if not already)
- Tracks "last cancellation triggered at" in local state
- After 10 minutes with no `stripe_resolved_at`, reveals "Need help? Contact support" CTA with the relevant Stripe IDs prefilled in a `mailto:support@neighborlyy.com` link

"Continue to community decisions" button enables only when `stripe_resolved_at IS NOT NULL`.

---

## Community disposition (Gate 3 / Screen 4)

`/dashboard/account/offboarding/disposition` — server component:

- Queries `community_audit_summary` view filtered by PM's `organization_id`
- Reads existing `community_disposition` from the deletion request to pre-fill state
- Renders `<DispositionCards />` client component

`DispositionCards.tsx`:

For each community, a card with three radios:
- **Transfer to another PM** — `disabled={!CAN_USE_TRANSFER}` per the forward-compat constraint. In this PR `CAN_USE_TRANSFER = false`. Tooltip: "Coming in v1.1".
- **Suspend** — always available. "Residents will be notified. The community will be locked until a new PM takes over."
- **Close and archive** — `disabled={active_residents > 0}`. Helper text: "(Currently unavailable — N residents)".

Per-card "Confirm this community's disposition" button → `setCommunityDisposition(communityId, action)`:
1. RLS-check community ownership
2. Validate eligibility server-side (re-check `active_residents` for Close)
3. Atomic SQL update on `deletion_requests.community_disposition`:
   ```sql
   UPDATE deletion_requests
      SET community_disposition = (
        SELECT jsonb_agg(elem)
          FROM (
            SELECT elem FROM jsonb_array_elements(community_disposition) elem
            WHERE elem->>'community_id' != $community_id
            UNION ALL SELECT $new_entry::jsonb
          ) sub
      )
    WHERE id = $request_id AND status = 'in_review';
   ```
   This is atomic — overwrites any prior entry for the same community, preserves entries for others. Same race-safety pattern as audit log (no read-modify-write in JS).
4. If `action='suspend'`:
   - `UPDATE communities SET suspended_reason = 'PM offboarding' WHERE id = ...`
   - `INSERT INTO admin_notifications (community_code, type, payload) VALUES (..., 'community_suspended', {...})` — mobile app consumes this in a separate workstream (CC-6 stub)
5. Append audit entry

"Continue to account closure" button at bottom:
- Enabled when every community in the org has a disposition entry
- Calls `finalizeDispositions()` which:
  1. Re-validates every community has a disposition
  2. Updates `deletion_requests.status = 'approved'`
  3. Appends audit
  4. `redirect('/dashboard/account/offboarding/finalize')`

---

## Finalize stub

`/dashboard/account/offboarding/finalize/page.tsx` — minimal Phase 4 placeholder:

```
"Your account is queued for closure"
"We'll send a final confirmation email when closure completes."
"You can still cancel until closure begins. [Cancel deletion]"
```

Renders `cancelDeletionRequest` button (existing). Replaced by Screens 5–6 in Phase 4.

**Critical:** this page reads `status='approved'` directly. Phase 4 must be able to take over the same status without a schema change.

---

## Layout guard

`/dashboard/account/offboarding/layout.tsx`:

Server-side check on every request:
- No active deletion request → redirect to `/dashboard/account`
- Status `awaiting_corp_approval` / `pending` → redirect to `/dashboard/account` (status card will surface)
- Status `cancelled` / `blocked` / `completed` → redirect to `/dashboard/account`
- Status `billing_blocked` → if path != `/billing`, redirect to `/billing`
- Status `in_review` + `stripe_resolved_at IS NULL` → if path != `/billing`, redirect to `/billing`
- Status `in_review` + `stripe_resolved_at IS NOT NULL` → allow `/disposition`; redirect from `/billing`
- Status `approved` → only `/finalize` is allowed

This single layout enforces the state machine in URLs — server-rendered, can't be bypassed by client routing.

---

## Status state machine (this PR)

```
                 (Phase 2 entry)
                       │
                  in_review ─────────────┐
                       │                  │
       (cancel any time)             (invoice.payment_failed)
                       │                  │
                       ▼                  ▼
                  cancelled        billing_blocked
                                          │
                              (PM resolves billing externally,
                               webhook update or manual)
                                          │
                                          ▼
                                     in_review
                                          │
                       (all subs cancel, fan-in)
                                          │
                                          ▼
              stripe_resolved_at = now()  (status still in_review)
                                          │
                       (PM finalizes all dispositions)
                                          │
                                          ▼
                                     approved  ───────────► (Phase 4 takes over)
```

---

## Error handling

| Scenario | Behavior |
|---|---|
| Webhook signature fails | 400, log only, no audit (untrusted) |
| Webhook arrives for unknown sub_id | 200 + log warning (could be from another env) |
| `cancelSubscription` throws | Toast error, no DB change, retryable |
| Webhook never arrives | BillingClient surfaces support contact after 10 min |
| `setCommunityDisposition` for non-owned community | 403, audit "unauthorized_disposition_attempt" |
| PM tries Close with residents | Server rejects with 422, UI shouldn't have allowed it |
| Direct nav to `/disposition` before billing clears | Layout guard redirects to `/billing` |
| `invoice.payment_failed` mid-flow | Status → `billing_blocked`, status card shows alert |
| All communities have no Stripe sub | Auto-pass on `/billing` page load |
| Phase 4 not built when reaching `/finalize` | Stub page renders; status stays `approved` indefinitely until Phase 4 |
| PM cancels deletion any time | Existing flow; layout guard redirects to `/account` on next render |

---

## Testing

**Unit:**
- Webhook signature: known-good vs known-bad pair
- Webhook idempotency: replay same event twice → single side effect
- Disposition eligibility: `canClose(activeResidents)` returns false for >0
- Atomic disposition update: SQL pattern test against migration

**Integration:**
- Fan-in: 3 communities, 3 `subscription.deleted` events → `stripe_resolved_at` set exactly once
- Disposition race: two concurrent `setCommunityDisposition` for same community → one entry in jsonb array
- Layout guard: each status × each path → expected redirect

**Manual / PR-description checklist:**
- Stall path (10-min timer) — full E2E impractical to automate
- Mobile push from `community_suspended` admin_notifications row — requires mobile workstream

---

## Risks

| Risk | Mitigation |
|---|---|
| Stripe webhook IP / network differences in prod vs dev | Use Stripe CLI for local replay; document setup in PR |
| `community_audit_summary` view performance on large orgs | View has no N+1 risk; limit by `organization_id` filter; add explain-analyze in PR description if any org has >50 communities |
| Forward-compat slip on Transfer | Code review enforces `CAN_USE_TRANSFER` flag pattern; spec calls it out explicitly |
| Forward-compat slip on status enum | No new statuses added in this PR; reviewer should fail any PR adding statuses between `approved` and `completed` |
| Mobile workstream not ready when suspend ships | `admin_notifications` row is inert until consumed; no PM-visible breakage |

---

## Acceptance criteria

1. Migration 027 applies cleanly on the shared remote DB; `community_audit_summary` returns expected counts for an existing test org
2. Webhook handler verifies signature, deduplicates by event id, and updates `communities` state for all three event types
3. Billing page renders all communities with sub state, "Schedule cancellation" works, "Continue" enables when fan-in fires
4. Disposition page renders one card per community from the view; per-card confirm persists; "Continue" enables when all confirmed
5. Suspend disposition inserts `admin_notifications` row
6. Finalize page renders for `status='approved'`; cancel still works
7. Layout guard correctly redirects every (status, path) combination
8. Code review pass before merge (per project workflow)
