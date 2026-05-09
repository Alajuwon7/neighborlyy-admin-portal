# PM Account Offboarding — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Stripe billing review (Gate 2) + per-community disposition (Gate 3) so PM deletion requests advance from `in_review` → `approved`, ready for Phase 4 PII wipe.

**Architecture:** Three new routes under `/dashboard/account/offboarding/{billing,disposition,finalize}` guarded by a single layout that enforces the status state machine. A new Stripe webhook (`/api/webhooks/stripe`) drives billing fan-in. Atomic SQL on `deletion_requests.community_disposition` (jsonb) prevents the same race-condition class we fixed in Phase 2 for the audit log.

**Tech Stack:** Next.js 16 App Router, React 19 server/client components, Supabase (RLS, realtime, RPCs), Stripe Node SDK, jose JWT (already wired in Phase 2), Playwright for e2e, `node --test` for pure-logic unit tests.

**Spec:** `docs/superpowers/specs/2026-05-09-offboarding-phase-3-design.md` (commit 7d6b6d8). All design decisions and forward-compatibility constraints live there. Read it before starting.

---

## File map

```
NEW
  supabase/migrations/027_offboarding_helper_views.sql
  app/(dashboard)/dashboard/account/offboarding/layout.tsx
  app/(dashboard)/dashboard/account/offboarding/billing/page.tsx
  app/(dashboard)/dashboard/account/offboarding/billing/actions.ts
  app/(dashboard)/dashboard/account/offboarding/billing/BillingClient.tsx
  app/(dashboard)/dashboard/account/offboarding/disposition/page.tsx
  app/(dashboard)/dashboard/account/offboarding/disposition/actions.ts
  app/(dashboard)/dashboard/account/offboarding/disposition/DispositionCards.tsx
  app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx
  app/api/webhooks/stripe/route.ts
  lib/stripe/client.ts
  lib/offboarding/disposition.ts
  lib/offboarding/feature-flags.ts
  tests/unit/offboarding-eligibility.test.ts          (node --test)
  tests/unit/stripe-fan-in.test.ts                    (node --test)
  tests/unit/stripe-signature.test.ts                 (node --test)
  tests/e2e/offboarding-phase3.spec.ts                (playwright)

MODIFIED
  app/api/stripe/checkout/route.ts                    use lib/stripe/client.ts
  app/api/stripe/checkout/success/route.ts            use lib/stripe/client.ts
  components/dashboard/OffboardingStatusCard.tsx      add "Continue" CTA when in_review + stripe_resolved_at
  .env.example                                        add STRIPE_WEBHOOK_SECRET
  package.json                                        add "test:unit" script
```

---

## Conventions

- **TDD per task** where the unit is pure logic. Server components and Next.js routes are exercised via Playwright at the end (Task 9). Webhook signature verification, fan-in computation, and eligibility helpers get `node --test` unit tests because they're worth pinning.
- **Migration application:** all migrations apply to the shared remote DB via `mcp__supabase__apply_migration`. Do not run `supabase db push`.
- **Commits:** end of each task. Commits go to `main` (no feature branch — matches the repo workflow for Phase 1+2).
- **Type imports:** types from `lib/offboarding/types.ts` and the new `lib/offboarding/disposition.ts`. Reuse `getAuthenticatedPM()` from `lib/queries.ts` in server actions.
- **Status checks:** use `OPEN_DELETION_STATUSES` from `lib/offboarding/types.ts` for "is this an open request?" guards.

---

## Task 1: Migration 027 — webhook events table, communities columns, audit summary view

**Files:**
- Create: `supabase/migrations/027_offboarding_helper_views.sql`

- [ ] **Step 1: Verify column names in dependent tables**

Run via MCP `mcp__supabase__execute_sql`:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('profiles','pending_users','events','help_requests')
  AND column_name IN ('community_code','status','event_date','start_at','start_time')
ORDER BY table_name, column_name;
```

Expected: confirms which date column `events` uses (`event_date` vs `start_at`) and what `help_requests.status` values look like. Note the actual column names — adjust the view definition in Step 2 if the assumption (`events.event_date`, `help_requests.status`) is wrong.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/027_offboarding_helper_views.sql`:

```sql
-- =============================================================================
-- Migration: 027_offboarding_helper_views
-- Description: Phase 3 foundation — Stripe webhook idempotency table,
--              per-community subscription state mirror, per-community audit
--              summary view for Screen 4.
-- =============================================================================

-- 1. Webhook idempotency. Stripe retries on non-2xx; INSERT-on-conflict gives
--    us first-writer-wins dedup keyed by Stripe's event id.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id           text        PRIMARY KEY,
  type         text        NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb       NOT NULL
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service-role only. No policies = no anon/authenticated access.

-- 2. Per-community Stripe state mirror. Lets the billing UI render without
--    hitting Stripe on every load and gives the webhook a clear write target.
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at           timestamptz;

-- 3. Per-community audit summary for Screen 4 cards.
--    "Active resident" = approved profile (per design).
--    NOTE: replace `e.event_date` with the actual column name confirmed in Step 1
--    if it differs.
CREATE OR REPLACE VIEW community_audit_summary AS
SELECT
  c.id              AS community_id,
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

-- 4. Realtime: BillingClient needs to react to community status changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='communities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE communities';
  END IF;
END $$;
```

- [ ] **Step 3: Apply migration**

Call `mcp__supabase__apply_migration` with name `offboarding_helper_views` and the SQL above.

Expected: `{"success":true}`.

- [ ] **Step 4: Verify**

Call `mcp__supabase__execute_sql`:

```sql
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='stripe_webhook_events') AS webhook_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='communities' AND column_name='stripe_subscription_status') AS sub_status_col,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name='community_audit_summary') AS view_exists,
  (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='communities') AS realtime_added;
```

Expected: all four return `1`.

- [ ] **Step 5: Run security advisor**

Call `mcp__supabase__get_advisors` with `type: "security"`. Confirm no NEW critical/warn issues introduced by 027 (the existing pre-Phase-3 warnings will persist; ignore those).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/027_offboarding_helper_views.sql
git commit -m "feat(offboarding): migration 027 — webhook events, community sub state, audit view"
```

---

## Task 2: Shared Stripe client + refactor existing routes

**Files:**
- Create: `lib/stripe/client.ts`
- Modify: `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout/success/route.ts`

- [ ] **Step 1: Create the shared client**

Create `lib/stripe/client.ts`:

```ts
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  cached = new Stripe(key);
  return cached;
}
```

- [ ] **Step 2: Refactor checkout/route.ts**

Open `app/api/stripe/checkout/route.ts`. Replace the inline `getStripe` factory:

```ts
// Remove:
import Stripe from "stripe";
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Replace with:
import { getStripe } from "@/lib/stripe/client";
```

- [ ] **Step 3: Refactor checkout/success/route.ts**

Same edit pattern as Step 2 — remove the inline factory, import from `@/lib/stripe/client`.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add lib/stripe/client.ts app/api/stripe/checkout/route.ts app/api/stripe/checkout/success/route.ts
git commit -m "refactor(stripe): consolidate Stripe client into lib/stripe/client.ts"
```

---

## Task 3: Stripe signature verification (TDD)

**Files:**
- Create: `tests/unit/stripe-signature.test.ts`
- Modify: `package.json` (add `test:unit` script)

This task locks down the rule that the webhook never trusts an unverified body. We test against the Stripe SDK's own constructEvent — the webhook handler uses the same path.

- [ ] **Step 1: Add test:unit script**

Edit `package.json` `scripts`:

```json
"test:unit": "node --test --test-reporter=spec tests/unit/*.test.ts",
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/stripe-signature.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

const SECRET = "whsec_test_" + "a".repeat(32);

function buildSignedPayload(secret: string, payload: object, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload);
  const sig = Stripe.webhooks.signature.computeSignature(timestamp, body, secret);
  return { body, header: `t=${timestamp},v1=${sig}` };
}

test("constructEvent accepts a correctly signed payload", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { body, header } = buildSignedPayload(SECRET, {
    id: "evt_1",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_1" } },
  });
  const evt = stripe.webhooks.constructEvent(body, header, SECRET);
  assert.equal(evt.id, "evt_1");
  assert.equal(evt.type, "customer.subscription.deleted");
});

test("constructEvent throws on tampered body", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { header } = buildSignedPayload(SECRET, {
    id: "evt_1",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_1" } },
  });
  const tamperedBody = JSON.stringify({ id: "evt_HACKED" });
  assert.throws(() => stripe.webhooks.constructEvent(tamperedBody, header, SECRET));
});

test("constructEvent throws on wrong secret", () => {
  const stripe = new Stripe("sk_test_dummy");
  const { body, header } = buildSignedPayload(SECRET, {
    id: "evt_1",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_1" } },
  });
  assert.throws(() => stripe.webhooks.constructEvent(body, header, "whsec_wrong_" + "b".repeat(32)));
});
```

- [ ] **Step 3: Run tests to confirm they fail/pass against the SDK**

Run: `npm run test:unit -- tests/unit/stripe-signature.test.ts`
Expected: 3 tests pass (the SDK does the work; this is a guard against a future SDK upgrade silently breaking signature checks).

- [ ] **Step 4: Commit**

```bash
git add package.json tests/unit/stripe-signature.test.ts
git commit -m "test: pin Stripe signature verification contract via SDK"
```

---

## Task 4: Stripe webhook handler

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Modify: `.env.example` (add `STRIPE_WEBHOOK_SECRET`)

- [ ] **Step 1: Add env var to example**

Open `.env.example` and add (alphabetized near the other Stripe vars):

```
STRIPE_WEBHOOK_SECRET=whsec_replace_with_value_from_stripe_cli_or_dashboard
```

- [ ] **Step 2: Write the route**

Create `app/api/webhooks/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/offboarding/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: first writer wins. Subsequent retries return 200 immediately.
  const { data: inserted, error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as object })
    .select("id")
    .maybeSingle();

  if (insertError && (insertError as { code?: string }).code !== "23505") {
    console.error("[stripe-webhook] failed to record event", insertError);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
  if (!inserted) {
    return NextResponse.json({ received: true, deduped: true }, { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
        break;
      default:
        // Other event types are recorded for audit but not actioned.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error for ${event.type}`, err);
    // Still return 200 — we've recorded the event. Manual replay possible if needed.
    return NextResponse.json({ received: true, handler_error: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  await admin
    .from("communities")
    .update({
      stripe_subscription_status: sub.status,
      stripe_cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    })
    .eq("stripe_subscription_id", sub.id)
    .neq("stripe_subscription_status", sub.status);
}

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  await admin
    .from("communities")
    .update({ stripe_subscription_status: "canceled" })
    .eq("stripe_subscription_id", sub.id);

  await runFanIn(admin, sub.id);
}

async function handleInvoicePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
) {
  // invoice.subscription is a string id when expanded=false (default for webhooks)
  const subId = (invoice as { subscription?: string }).subscription;
  if (!subId) return;

  const { data: community } = await admin
    .from("communities")
    .select("organization_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!community?.organization_id) return;

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id")
    .eq("org_id", community.organization_id)
    .eq("status", "in_review")
    .maybeSingle();
  if (!req) return;

  await admin
    .from("deletion_requests")
    .update({ status: "billing_blocked" })
    .eq("id", req.id)
    .eq("status", "in_review");

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "system",
    actor_id: "stripe",
    action: "billing_blocked_by_payment_failure",
    note: `invoice=${invoice.id}; subscription=${subId}`,
  });
}

async function runFanIn(
  admin: ReturnType<typeof createAdminClient>,
  canceledSubId: string,
) {
  const { data: community } = await admin
    .from("communities")
    .select("organization_id")
    .eq("stripe_subscription_id", canceledSubId)
    .maybeSingle();
  if (!community?.organization_id) return;

  const { data: orgCommunities } = await admin
    .from("communities")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("organization_id", community.organization_id);

  const allDone = (orgCommunities ?? []).every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
  if (!allDone) return;

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id")
    .eq("org_id", community.organization_id)
    .eq("status", "in_review")
    .is("stripe_resolved_at", null)
    .maybeSingle();
  if (!req) return;

  const { error: updErr } = await admin
    .from("deletion_requests")
    .update({ stripe_resolved_at: new Date().toISOString() })
    .eq("id", req.id)
    .is("stripe_resolved_at", null);
  if (updErr) return;

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "system",
    actor_id: "stripe",
    action: "billing_resolved",
    note: `last_subscription=${canceledSubId}`,
  });
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts .env.example
git commit -m "feat(offboarding): Stripe webhook with signature verify, idempotency, fan-in"
```

---

## Task 5: Fan-in unit test (TDD safety net)

**Files:**
- Create: `tests/unit/stripe-fan-in.test.ts`

This pins the fan-in rule: `stripe_resolved_at` flips to non-null only when every community in the org is canceled (or has no sub). Implemented as a pure-function test against an extracted helper.

- [ ] **Step 1: Extract pure helper from the route**

Open `app/api/webhooks/stripe/route.ts`. Refactor the "all done?" check into an exported pure function. Replace this block in `runFanIn`:

```ts
const allDone = (orgCommunities ?? []).every(
  (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
);
```

with a call to a new helper at the top of the file (export so the test can import):

```ts
export function allCommunitiesBillingResolved(
  communities: { stripe_subscription_id: string | null; stripe_subscription_status: string | null }[],
): boolean {
  return communities.every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
}
```

And replace the call site:

```ts
const allDone = allCommunitiesBillingResolved(orgCommunities ?? []);
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/stripe-fan-in.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { allCommunitiesBillingResolved } from "../../app/api/webhooks/stripe/route";

test("returns true when zero communities", () => {
  assert.equal(allCommunitiesBillingResolved([]), true);
});

test("returns true when all subs canceled", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: "sub_2", stripe_subscription_status: "canceled" },
    ]),
    true,
  );
});

test("returns true when communities have no sub at all", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: null, stripe_subscription_status: null },
      { stripe_subscription_id: null, stripe_subscription_status: null },
    ]),
    true,
  );
});

test("returns true when mix of canceled and no-sub", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: null, stripe_subscription_status: null },
    ]),
    true,
  );
});

test("returns false when one is still active", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "canceled" },
      { stripe_subscription_id: "sub_2", stripe_subscription_status: "active" },
    ]),
    false,
  );
});

test("returns false when one is past_due", () => {
  assert.equal(
    allCommunitiesBillingResolved([
      { stripe_subscription_id: "sub_1", stripe_subscription_status: "past_due" },
    ]),
    false,
  );
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test:unit -- tests/unit/stripe-fan-in.test.ts`
Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts tests/unit/stripe-fan-in.test.ts
git commit -m "test(offboarding): pin fan-in rule via extracted helper"
```

---

## Task 6: Disposition types + feature flag + eligibility (TDD)

**Files:**
- Create: `lib/offboarding/feature-flags.ts`, `lib/offboarding/disposition.ts`, `tests/unit/offboarding-eligibility.test.ts`

- [ ] **Step 1: Write failing eligibility test**

Create `tests/unit/offboarding-eligibility.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { canCloseCommunity, isDispositionAction } from "../../lib/offboarding/disposition";

test("canCloseCommunity is true when zero active residents", () => {
  assert.equal(canCloseCommunity(0), true);
});

test("canCloseCommunity is false when active residents > 0", () => {
  assert.equal(canCloseCommunity(1), false);
  assert.equal(canCloseCommunity(48), false);
});

test("isDispositionAction validates the three known actions", () => {
  assert.equal(isDispositionAction("transfer"), true);
  assert.equal(isDispositionAction("suspend"), true);
  assert.equal(isDispositionAction("close"), true);
});

test("isDispositionAction rejects unknown values", () => {
  assert.equal(isDispositionAction("delete"), false);
  assert.equal(isDispositionAction(""), false);
  assert.equal(isDispositionAction(null), false);
  assert.equal(isDispositionAction(undefined), false);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- tests/unit/offboarding-eligibility.test.ts`
Expected: tests fail with import error (file doesn't exist yet).

- [ ] **Step 3: Implement disposition module**

Create `lib/offboarding/disposition.ts`:

```ts
import type { CommunityDisposition } from "./types";

export type DispositionAction = "transfer" | "suspend" | "close";

const VALID_ACTIONS: DispositionAction[] = ["transfer", "suspend", "close"];

export function isDispositionAction(value: unknown): value is DispositionAction {
  return typeof value === "string" && (VALID_ACTIONS as string[]).includes(value);
}

export function canCloseCommunity(activeResidents: number): boolean {
  return activeResidents === 0;
}

export interface CommunitySummary {
  community_id: string;
  community_code: string;
  name: string;
  organization_id: string;
  active_residents: number;
  pending_residents: number;
  upcoming_events: number;
  open_help_requests: number;
}

export function dispositionForCommunity(
  dispositions: CommunityDisposition[],
  communityId: string,
): CommunityDisposition | null {
  return dispositions.find((d) => d.community_id === communityId) ?? null;
}

export function allCommunitiesHaveDisposition(
  communityIds: string[],
  dispositions: CommunityDisposition[],
): boolean {
  if (communityIds.length === 0) return false;
  const decided = new Set(dispositions.map((d) => d.community_id));
  return communityIds.every((id) => decided.has(id));
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm run test:unit -- tests/unit/offboarding-eligibility.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Add feature flag module**

Create `lib/offboarding/feature-flags.ts`:

```ts
// Single source of truth for offboarding capability gates. Phase 5 enables
// transfer by flipping CAN_USE_TRANSFER. The disposition card MUST consult
// this flag rather than implementing parallel code paths — see the spec at
// docs/superpowers/specs/2026-05-09-offboarding-phase-3-design.md
// (forward-compatibility constraint #1).
export const CAN_USE_TRANSFER = false;
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/offboarding/feature-flags.ts lib/offboarding/disposition.ts tests/unit/offboarding-eligibility.test.ts
git commit -m "feat(offboarding): disposition types, eligibility helpers, feature flag"
```

---

## Task 7: Layout guard

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/layout.tsx`

- [ ] **Step 1: Write the layout**

Create the layout — server-side status check, redirects per the state machine.

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { OPEN_DELETION_STATUSES } from "@/lib/offboarding/types";
import type { DeletionStatus } from "@/lib/offboarding/types";

const ROUTE_FOR_STATUS: Partial<Record<DeletionStatus, string>> = {
  in_review: "/dashboard/account/offboarding/billing",
  billing_blocked: "/dashboard/account/offboarding/billing",
  approved: "/dashboard/account/offboarding/finalize",
};

export default async function OffboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!pm) redirect("/dashboard/account");

  const { data: req } = await supabase
    .from("deletion_requests")
    .select("status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", OPEN_DELETION_STATUSES)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) redirect("/dashboard/account");

  const path = (await headers()).get("x-pathname") ?? "";

  // in_review with billing not yet resolved → only /billing allowed
  if (req.status === "in_review" && !req.stripe_resolved_at) {
    if (!path.endsWith("/billing")) {
      redirect("/dashboard/account/offboarding/billing");
    }
  }

  // in_review with billing resolved → only /disposition allowed
  if (req.status === "in_review" && req.stripe_resolved_at) {
    if (!path.endsWith("/disposition")) {
      redirect("/dashboard/account/offboarding/disposition");
    }
  }

  if (req.status === "billing_blocked" && !path.endsWith("/billing")) {
    redirect("/dashboard/account/offboarding/billing");
  }

  if (req.status === "approved" && !path.endsWith("/finalize")) {
    redirect("/dashboard/account/offboarding/finalize");
  }

  // awaiting_corp_approval / pending should never reach here — bounce.
  if (req.status === "awaiting_corp_approval" || req.status === "pending") {
    redirect("/dashboard/account");
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify x-pathname header is available**

The Next.js 16 docs at `node_modules/next/dist/docs/` describe how middleware sets headers. Run:

```bash
grep -rn "x-pathname\|nextUrl.pathname" middleware.ts middleware/ 2>/dev/null | head -5
```

If `x-pathname` isn't being set by middleware, fall back to using `headers().get("next-url")` or use `usePathname()` in a tiny client component. Note: the recommended Next.js 16 idiom for "current path" in a server component is to read `headers()` for a request header set in middleware, OR use a client `usePathname()` and pass it to a server action. Verify which pattern the codebase already uses by reading one or two existing server-component pages, e.g.:

```bash
grep -rn "headers()\|usePathname" app/ --include="*.tsx" | head -10
```

If neither is established, add `x-pathname` in `middleware.ts`:

```ts
// In middleware.ts (likely already exists)
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-pathname", request.nextUrl.pathname);
return NextResponse.next({ request: { headers: requestHeaders } });
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/dashboard/account/offboarding/layout.tsx middleware.ts
git commit -m "feat(offboarding): layout guard enforcing status state machine"
```

---

## Task 8: Billing gate — page + actions + client

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/billing/{page,actions,BillingClient}.{tsx,ts}`

- [ ] **Step 1: Write the server action module**

Create `app/(dashboard)/dashboard/account/offboarding/billing/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { appendAudit } from "@/lib/offboarding/audit";

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadPmAndRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm) return { error: "Profile not found" as const };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, org_id, status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", ["in_review", "billing_blocked"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { error: "No active deletion request" as const };

  return { user, pm, admin, req };
}

export async function cancelSubscription(communityId: string): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { user, pm, admin } = ctx;

  const { data: community } = await admin
    .from("communities")
    .select("id, organization_id, stripe_subscription_id, stripe_subscription_status")
    .eq("id", communityId)
    .single();
  if (!community) return { ok: false, error: "Community not found" };
  if (community.organization_id !== pm.organization_id) {
    return { ok: false, error: "Not your community" };
  }
  if (!community.stripe_subscription_id) {
    return { ok: false, error: "No active subscription" };
  }

  // Idempotent: already canceled or scheduled → return success without re-calling Stripe.
  if (
    community.stripe_subscription_status === "canceled" ||
    community.stripe_subscription_status === "cancel_scheduled"
  ) {
    return { ok: true };
  }

  try {
    await getStripe().subscriptions.update(community.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe cancellation failed",
    };
  }

  // Optimistic mirror; webhook will confirm with final status.
  await admin
    .from("communities")
    .update({ stripe_subscription_status: "cancel_scheduled" })
    .eq("id", communityId);

  await appendAudit(admin, "deletion_requests", ctx.req.id, {
    actor: "pm",
    actor_id: user.id,
    action: "subscription_cancellation_scheduled",
    note: `community=${communityId}; subscription=${community.stripe_subscription_id}`,
  });

  revalidatePath("/dashboard/account/offboarding/billing");
  return { ok: true };
}

export async function markBillingResolved(): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { admin, req } = ctx;

  // Re-check: this should only run when no community has an active sub.
  const { data: communities } = await admin
    .from("communities")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("organization_id", req.org_id);

  const allDone = (communities ?? []).every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
  if (!allDone) return { ok: false, error: "Not all subscriptions are canceled" };

  if (!req.stripe_resolved_at) {
    await admin
      .from("deletion_requests")
      .update({ stripe_resolved_at: new Date().toISOString() })
      .eq("id", req.id)
      .is("stripe_resolved_at", null);

    await appendAudit(admin, "deletion_requests", req.id, {
      actor: "system",
      actor_id: "auto-pass",
      action: "billing_resolved",
      note: "no active subscriptions on any community",
    });
  }

  revalidatePath("/dashboard/account/offboarding/billing");
  return { ok: true };
}
```

- [ ] **Step 2: Write the page**

Create `app/(dashboard)/dashboard/account/offboarding/billing/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markBillingResolved } from "./actions";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm) redirect("/dashboard/account");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", ["in_review", "billing_blocked"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  const { data: communities } = await admin
    .from("communities")
    .select("id, name, stripe_subscription_id, stripe_subscription_status, stripe_cancel_at")
    .eq("organization_id", pm.organization_id);

  const list = communities ?? [];
  const hasAnyActiveSub = list.some(
    (c) => c.stripe_subscription_id && c.stripe_subscription_status !== "canceled",
  );

  // Auto-pass: nothing to cancel.
  if (!hasAnyActiveSub && !req.stripe_resolved_at) {
    await markBillingResolved();
    redirect("/dashboard/account/offboarding/disposition");
  }

  if (req.stripe_resolved_at) {
    redirect("/dashboard/account/offboarding/disposition");
  }

  const isBlocked = req.status === "billing_blocked";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          Account closure — Step 1 of 2: Billing review
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--nly-text-secondary)" }}>
          We&apos;ll cancel each community subscription at the end of its current
          billing period. Review and confirm below.
        </p>
      </header>

      {isBlocked && (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{ borderColor: "var(--nly-error)", color: "var(--nly-error)" }}
          role="alert"
        >
          A recent payment failed. Please resolve the outstanding invoice in the
          Stripe customer portal before continuing.
        </div>
      )}

      <BillingClient
        deletionRequestId={req.id}
        initialCommunities={list.map((c) => ({
          id: c.id,
          name: c.name,
          stripe_subscription_id: c.stripe_subscription_id,
          stripe_subscription_status: c.stripe_subscription_status,
          stripe_cancel_at: c.stripe_cancel_at,
        }))}
      />

      <Link
        href="/dashboard/account"
        className="text-xs underline"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        Cancel and return to account settings
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Write the client component**

Create `app/(dashboard)/dashboard/account/offboarding/billing/BillingClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cancelSubscription } from "./actions";
import { createClient } from "@/lib/supabase/client";

interface CommunityRow {
  id: string;
  name: string;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_cancel_at: string | null;
}

interface BillingClientProps {
  deletionRequestId: string;
  initialCommunities: CommunityRow[];
}

const STALL_MS = 10 * 60 * 1000;

export function BillingClient({ deletionRequestId, initialCommunities }: BillingClientProps) {
  const router = useRouter();
  const [communities, setCommunities] = useState<CommunityRow[]>(initialCommunities);
  const [working, setWorking] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState<number | null>(null);
  const [showStallHelp, setShowStallHelp] = useState(false);

  // Subscribe to community + deletion_request updates.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`offboarding-billing:${deletionRequestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "communities" },
        (payload: { new: Partial<CommunityRow> & { id?: string } }) => {
          if (!payload.new?.id) return;
          setCommunities((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deletion_requests",
          filter: `id=eq.${deletionRequestId}`,
        },
        (payload: { new: { stripe_resolved_at?: string | null } }) => {
          if (payload.new?.stripe_resolved_at) {
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deletionRequestId, router]);

  // Stall watcher: 10 minutes after last cancel action without resolution.
  useEffect(() => {
    if (lastActionAt === null) return;
    const timer = setTimeout(() => setShowStallHelp(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [lastActionAt]);

  async function handleCancel(communityId: string) {
    setWorking(communityId);
    const result = await cancelSubscription(communityId);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cancellation scheduled.");
    setLastActionAt(Date.now());
  }

  const allResolved = communities.every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );

  return (
    <div className="space-y-3">
      {communities.map((c) => {
        const status = c.stripe_subscription_status ?? "none";
        const scheduled = status === "cancel_scheduled" || (c.stripe_cancel_at && status !== "canceled");
        return (
          <div
            key={c.id}
            className="rounded-2xl border p-4 space-y-2"
            style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                  {c.name}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--nly-text-secondary)" }}>
                  Status: {humanizeStatus(status)}
                  {c.stripe_cancel_at && status !== "canceled" && (
                    <> · ends {new Date(c.stripe_cancel_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              {!c.stripe_subscription_id ? (
                <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                  No subscription
                </span>
              ) : status === "canceled" ? (
                <span className="text-xs" style={{ color: "var(--nly-success)" }}>
                  ✓ Canceled
                </span>
              ) : scheduled ? (
                <span className="text-xs" style={{ color: "var(--nly-text-secondary)" }}>
                  Scheduled
                </span>
              ) : (
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => handleCancel(c.id)}
                  className="h-9 rounded-lg text-sm font-medium border px-3 transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-2"
                  style={{ borderColor: "var(--nly-brand)", color: "var(--nly-brand)" }}
                >
                  {working === c.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Schedule cancellation"
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {showStallHelp && (
        <div
          className="rounded-2xl border p-4 text-sm space-y-2"
          style={{ borderColor: "var(--nly-warning)", color: "var(--nly-text-primary)" }}
        >
          <p>
            We&apos;re still waiting for Stripe to confirm your cancellations.
            Need help?
          </p>
          <a
            href={buildSupportMailto(communities)}
            className="text-xs underline"
            style={{ color: "var(--nly-brand)" }}
          >
            Contact support@neighborlyy.com
          </a>
        </div>
      )}

      <button
        type="button"
        disabled={!allResolved}
        onClick={() => router.push("/dashboard/account/offboarding/disposition")}
        className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        Continue to community decisions →
      </button>
    </div>
  );
}

function humanizeStatus(s: string | null): string {
  switch (s) {
    case "active": return "Active";
    case "canceled": return "Canceled";
    case "cancel_scheduled": return "Cancellation scheduled";
    case "past_due": return "Past due";
    case "unpaid": return "Unpaid";
    case "trialing": return "Trial";
    case "none":
    case null: return "No subscription";
    default: return s;
  }
}

function buildSupportMailto(communities: CommunityRow[]): string {
  const subs = communities
    .filter((c) => c.stripe_subscription_id)
    .map((c) => `${c.name}: ${c.stripe_subscription_id}`)
    .join("%0A");
  const subject = encodeURIComponent("Offboarding billing stuck");
  const body = `Stripe subscriptions:%0A${subs}`;
  return `mailto:support@neighborlyy.com?subject=${subject}&body=${body}`;
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/dashboard/account/offboarding/billing/
git commit -m "feat(offboarding): billing gate page, actions, realtime client"
```

---

## Task 9: Disposition gate — page + actions + cards

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/disposition/{page,actions,DispositionCards}.{tsx,ts}`

- [ ] **Step 1: Write the action module**

Create `app/(dashboard)/dashboard/account/offboarding/disposition/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/offboarding/audit";
import {
  isDispositionAction,
  canCloseCommunity,
  allCommunitiesHaveDisposition,
  type DispositionAction,
} from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadPmAndRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm) return { error: "Profile not found" as const };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, org_id, status, stripe_resolved_at, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "in_review")
    .not("stripe_resolved_at", "is", null)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { error: "No active deletion request in disposition stage" as const };

  return { user, pm, admin, req };
}

export async function setCommunityDisposition(
  communityId: string,
  action: string,
  notes?: string,
): Promise<ActionResult> {
  if (!isDispositionAction(action)) {
    return { ok: false, error: "Invalid disposition action" };
  }
  if (action === "transfer") {
    return { ok: false, error: "Transfer disposition is not yet available" };
  }

  const ctx = await loadPmAndRequest();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { user, pm, admin, req } = ctx;

  const { data: community } = await admin
    .from("communities")
    .select("id, organization_id, community_code, name")
    .eq("id", communityId)
    .single();
  if (!community || community.organization_id !== pm.organization_id) {
    return { ok: false, error: "Community not found" };
  }

  if (action === "close") {
    const { data: summary } = await admin
      .from("community_audit_summary")
      .select("active_residents")
      .eq("community_id", communityId)
      .maybeSingle();
    if (!summary || !canCloseCommunity(summary.active_residents)) {
      return { ok: false, error: "Cannot close — community still has active residents" };
    }
  }

  const newEntry: CommunityDisposition = {
    community_id: communityId,
    action: action as Exclude<DispositionAction, "transfer">,
    notes: notes?.slice(0, 500),
    set_at: new Date().toISOString(),
  };

  // Atomic SQL update: drop any prior entry for this community, append new.
  // jsonb_path_query_array filters out the prior entry, then concat appends.
  const { error: updateError } = await admin.rpc("set_community_disposition", {
    p_request_id: req.id,
    p_community_id: communityId,
    p_entry: newEntry,
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (action === "suspend") {
    await admin
      .from("communities")
      .update({ suspended_reason: "PM offboarding" })
      .eq("id", communityId);

    // CC-6 stub: row inserted; mobile app workstream consumes.
    await admin.from("admin_notifications").insert({
      community_code: community.community_code,
      type: "community_suspended",
      payload: {
        community_id: communityId,
        reason: "PM offboarding",
        deletion_request_id: req.id,
      },
    });
  }

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "pm",
    actor_id: user.id,
    action: `disposition_set_${action}`,
    note: `community=${community.community_code}`,
  });

  revalidatePath("/dashboard/account/offboarding/disposition");
  return { ok: true };
}

export async function finalizeDispositions(): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { user, pm, admin, req } = ctx;

  const { data: communities } = await admin
    .from("communities")
    .select("id")
    .eq("organization_id", pm.organization_id);
  const communityIds = (communities ?? []).map((c) => c.id);

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];
  if (!allCommunitiesHaveDisposition(communityIds, dispositions)) {
    return { ok: false, error: "Every community needs a disposition before continuing" };
  }

  const { error: updateError } = await admin
    .from("deletion_requests")
    .update({ status: "approved" })
    .eq("id", req.id)
    .eq("status", "in_review");
  if (updateError) return { ok: false, error: updateError.message };

  await appendAudit(admin, "deletion_requests", req.id, {
    actor: "pm",
    actor_id: user.id,
    action: "dispositions_finalized",
    note: `count=${dispositions.length}`,
  });

  revalidatePath("/dashboard/account/offboarding/disposition");
  redirect("/dashboard/account/offboarding/finalize");
}
```

- [ ] **Step 2: Add the `set_community_disposition` RPC to migration 027 follow-up**

The action above calls a SECURITY DEFINER RPC that doesn't exist yet. Apply via `mcp__supabase__apply_migration` with name `offboarding_disposition_rpc`:

```sql
CREATE OR REPLACE FUNCTION public.set_community_disposition(
  p_request_id   uuid,
  p_community_id uuid,
  p_entry        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' THEN
    RAISE EXCEPTION 'set_community_disposition: entry must be a non-null JSON object';
  END IF;

  -- Atomic: drop any existing entry for this community_id, then append new.
  UPDATE public.deletion_requests
     SET community_disposition = COALESCE(
       (
         SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(community_disposition) AS elem
          WHERE elem->>'community_id' IS DISTINCT FROM p_community_id::text
       ),
       '[]'::jsonb
     ) || jsonb_build_array(p_entry)
   WHERE id = p_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_community_disposition(uuid, uuid, jsonb)
  FROM anon, authenticated, public;
```

Also save this SQL to a new local file `supabase/migrations/028_offboarding_disposition_rpc.sql` (matches what's actually in the DB so the repo stays in sync).

Verify with `mcp__supabase__execute_sql`:

```sql
SELECT COUNT(*) FROM pg_proc WHERE proname='set_community_disposition';
```

Expected: `1`.

- [ ] **Step 3: Write the page**

Create `app/(dashboard)/dashboard/account/offboarding/disposition/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DispositionCards } from "./DispositionCards";
import type { CommunityDisposition } from "@/lib/offboarding/types";
import type { CommunitySummary } from "@/lib/offboarding/disposition";

export default async function DispositionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single();
  if (!pm) redirect("/dashboard/account");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status, stripe_resolved_at, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "in_review")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req || !req.stripe_resolved_at) {
    redirect("/dashboard/account/offboarding/billing");
  }

  const { data: summaries } = await admin
    .from("community_audit_summary")
    .select("*")
    .eq("organization_id", pm.organization_id);

  const communities = (summaries ?? []) as CommunitySummary[];
  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          Choose what happens to your communities
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--nly-text-secondary)" }}>
          You must make a decision for each community before your account can be closed.
        </p>
      </header>

      <DispositionCards
        deletionRequestId={req.id}
        communities={communities}
        initialDispositions={dispositions}
      />

      <Link
        href="/dashboard/account"
        className="text-xs underline"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        Cancel and return to account settings
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Write the disposition cards client component**

Create `app/(dashboard)/dashboard/account/offboarding/disposition/DispositionCards.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { setCommunityDisposition, finalizeDispositions } from "./actions";
import { CAN_USE_TRANSFER } from "@/lib/offboarding/feature-flags";
import {
  canCloseCommunity,
  type CommunitySummary,
} from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";

interface DispositionCardsProps {
  deletionRequestId: string;
  communities: CommunitySummary[];
  initialDispositions: CommunityDisposition[];
}

type LocalAction = "transfer" | "suspend" | "close";

export function DispositionCards({
  communities,
  initialDispositions,
}: DispositionCardsProps) {
  const router = useRouter();
  const [dispositions, setDispositions] = useState<CommunityDisposition[]>(initialDispositions);
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function getDisposition(communityId: string) {
    return dispositions.find((d) => d.community_id === communityId) ?? null;
  }

  async function handleConfirm(community: CommunitySummary, action: LocalAction) {
    setWorking(community.community_id);
    const result = await setCommunityDisposition(community.community_id, action);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${community.name}: set to ${action}`);
    setDispositions((prev) => [
      ...prev.filter((d) => d.community_id !== community.community_id),
      {
        community_id: community.community_id,
        action: action as "transfer" | "suspend" | "close",
        set_at: new Date().toISOString(),
      },
    ]);
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeDispositions();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/dashboard/account/offboarding/finalize");
    });
  }

  const allDecided = communities.length > 0 && communities.every((c) => getDisposition(c.community_id));

  return (
    <div className="space-y-4">
      {communities.map((c) => (
        <DispositionCard
          key={c.community_id}
          community={c}
          current={getDisposition(c.community_id)}
          working={working === c.community_id}
          onConfirm={(action) => handleConfirm(c, action)}
        />
      ))}

      <button
        type="button"
        disabled={!allDecided || pending}
        onClick={handleFinalize}
        className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        {pending ? "Finalizing..." : "Continue to account closure →"}
      </button>
    </div>
  );
}

function DispositionCard({
  community,
  current,
  working,
  onConfirm,
}: {
  community: CommunitySummary;
  current: CommunityDisposition | null;
  working: boolean;
  onConfirm: (action: LocalAction) => void;
}) {
  const [selected, setSelected] = useState<LocalAction | null>(
    (current?.action as LocalAction | undefined) ?? null,
  );

  const closable = canCloseCommunity(community.active_residents);

  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <header>
        <h3 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {community.name}
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--nly-text-secondary)" }}>
          {community.active_residents} active residents · {community.pending_residents} pending ·{" "}
          {community.upcoming_events} upcoming events · {community.open_help_requests} open help requests
        </p>
      </header>

      <fieldset className="space-y-2 text-sm">
        <legend className="text-xs font-semibold mb-1" style={{ color: "var(--nly-text-secondary)" }}>
          What should happen to this community?
        </legend>

        <RadioOption
          checked={selected === "transfer"}
          onChange={() => setSelected("transfer")}
          disabled={!CAN_USE_TRANSFER}
          label="Transfer to another PM"
          description={CAN_USE_TRANSFER ? "They will receive an invitation to accept." : "Coming in v1.1"}
        />

        <RadioOption
          checked={selected === "suspend"}
          onChange={() => setSelected("suspend")}
          label="Suspend"
          description="Residents will be notified. The community will be locked until a new PM takes over."
        />

        <RadioOption
          checked={selected === "close"}
          onChange={() => setSelected("close")}
          disabled={!closable}
          label="Close and archive"
          description={
            closable
              ? "The community will be archived permanently."
              : `(Currently unavailable — ${community.active_residents} active residents)`
          }
        />
      </fieldset>

      <div className="flex items-center justify-between gap-3 pt-1">
        {current ? (
          <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--nly-success)" }}>
            <Check size={14} /> Confirmed: {current.action}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Not yet confirmed
          </span>
        )}
        <button
          type="button"
          disabled={!selected || working || (selected === "transfer" && !CAN_USE_TRANSFER)}
          onClick={() => selected && onConfirm(selected)}
          className="h-9 rounded-lg text-sm font-medium border px-3 transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-2"
          style={{ borderColor: "var(--nly-brand)", color: "var(--nly-brand)" }}
        >
          {working ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </>
          ) : current ? (
            "Update disposition"
          ) : (
            "Confirm this community's disposition"
          )}
        </button>
      </div>
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <label
      className="flex items-start gap-2 cursor-pointer"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="space-y-0.5">
        <span className="block font-medium" style={{ color: "var(--nly-text-primary)" }}>
          {label}
        </span>
        <span className="block text-xs" style={{ color: "var(--nly-text-secondary)" }}>
          {description}
        </span>
      </span>
    </label>
  );
}
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/dashboard/account/offboarding/disposition/ supabase/migrations/028_offboarding_disposition_rpc.sql
git commit -m "feat(offboarding): disposition page, atomic per-community RPC, cards"
```

---

## Task 10: Finalize stub + status card CTA

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx`
- Modify: `components/dashboard/OffboardingStatusCard.tsx`

- [ ] **Step 1: Write the finalize stub page**

Create `app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function FinalizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!pm) redirect("/dashboard/account");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4 text-center">
      <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
        Your account is queued for closure
      </h1>
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        We&apos;ll send a final confirmation email when closure completes.
      </p>
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        You can still cancel until closure begins.
      </p>
      <Link
        href="/dashboard/account"
        className="inline-block text-xs underline"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        Return to account settings
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Add Continue CTA to status card**

Open `components/dashboard/OffboardingStatusCard.tsx`. Find the JSX that renders the action buttons (the `<button type="button"` ... "Cancel request" block). Insert a new "Continue to billing review" CTA above the cancel button when status is `in_review` (with or without `stripe_resolved_at`):

```tsx
import Link from "next/link";

// ...inside the component, before the existing button row:
{(request.status === "in_review" || request.status === "billing_blocked") && (
  <Link
    href="/dashboard/account/offboarding/billing"
    className="w-full h-9 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 inline-flex items-center justify-center"
    style={{ backgroundColor: "var(--nly-brand)" }}
  >
    Continue offboarding →
  </Link>
)}
{request.status === "approved" && (
  <Link
    href="/dashboard/account/offboarding/finalize"
    className="w-full h-9 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 inline-flex items-center justify-center"
    style={{ backgroundColor: "var(--nly-brand)" }}
  >
    View closure status →
  </Link>
)}
```

- [ ] **Step 3: Type check + lint**

Run:
```bash
npx tsc --noEmit
npx eslint 'app/(dashboard)/dashboard/account/offboarding/**/*.{ts,tsx}' 'components/dashboard/OffboardingStatusCard.tsx'
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/dashboard/account/offboarding/finalize/ components/dashboard/OffboardingStatusCard.tsx
git commit -m "feat(offboarding): finalize stub + status card continue CTAs"
```

---

## Task 11: Playwright e2e — happy path

**Files:**
- Create: `tests/e2e/offboarding-phase3.spec.ts`

This test exercises the user-visible flow end-to-end against the dev server. Stripe events are simulated via direct DB writes (since this is a feature-level test, not a Stripe integration test).

- [ ] **Step 1: Read existing e2e helpers**

```bash
cat tests/helpers/auth.helper.ts tests/fixtures/test-data.ts tests/global-setup.ts
```

Note the patterns in use (login helper, test PM credentials, supabase admin in tests).

- [ ] **Step 2: Write the spec**

Create `tests/e2e/offboarding-phase3.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAsTestPM } from "../helpers/auth.helper";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

test.describe("PM offboarding Phase 3 — happy path", () => {
  let pmId: string;
  let orgId: string;
  let requestId: string;

  test.beforeEach(async ({ page }) => {
    const session = await loginAsTestPM(page);
    pmId = session.pmId;
    orgId = session.orgId;

    // Seed: deletion request in 'in_review' with stripe_resolved_at set
    // (simulates corp-approved + auto-passed billing for orgs with no subs).
    const { data } = await supabaseAdmin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "in_review",
        stripe_resolved_at: new Date().toISOString(),
        audit_log: [],
      })
      .select("id")
      .single();
    requestId = data!.id;
  });

  test.afterEach(async () => {
    if (requestId) {
      await supabaseAdmin.from("deletion_requests").delete().eq("id", requestId);
    }
  });

  test("status card → finalize via disposition", async ({ page }) => {
    await page.goto("/dashboard/account");
    await expect(page.getByText(/account deletion in progress/i)).toBeVisible();

    await page.getByRole("link", { name: /continue offboarding/i }).click();
    await expect(page).toHaveURL(/\/offboarding\/disposition$/);

    // Pick "Suspend" for first community card and confirm.
    const firstCard = page.locator("[role=group]").first();
    await firstCard.getByLabel(/suspend/i).check();
    await firstCard.getByRole("button", { name: /confirm/i }).click();
    await expect(firstCard.getByText(/Confirmed: suspend/i)).toBeVisible();

    // Continue to closure. (Single-community test org assumed.)
    await page.getByRole("button", { name: /continue to account closure/i }).click();
    await expect(page).toHaveURL(/\/offboarding\/finalize$/);
    await expect(page.getByText(/queued for closure/i)).toBeVisible();
  });

  test("layout guard redirects from disposition when billing not resolved", async ({ page }) => {
    await supabaseAdmin
      .from("deletion_requests")
      .update({ stripe_resolved_at: null })
      .eq("id", requestId);

    await page.goto("/dashboard/account/offboarding/disposition");
    await expect(page).toHaveURL(/\/offboarding\/billing$/);
  });
});
```

- [ ] **Step 3: Run e2e suite**

Run: `npx playwright test tests/e2e/offboarding-phase3.spec.ts`
Expected: 2 tests pass. If they fail, debug (likely middleware/x-pathname or seed assumptions).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/offboarding-phase3.spec.ts
git commit -m "test(offboarding): Phase 3 e2e — disposition flow + layout guard"
```

---

## Task 12: Code review pass

This task does not write code. It dispatches the same code-review workflow used at the end of Phase 2 (per saved feedback: review at every phase boundary).

- [ ] **Step 1: Run unit + e2e**

```bash
npm run test:unit
npx playwright test
```

Expected: all green.

- [ ] **Step 2: Get git SHAs**

```bash
BASE_SHA=$(git log --oneline | grep "feat(offboarding): migration 027" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)
echo "Base: $BASE_SHA  Head: $HEAD_SHA"
```

- [ ] **Step 3: Dispatch code-review subagent**

Use the `superpowers:requesting-code-review` skill template. Brief the reviewer with:
- DESCRIPTION: "Phase 3 offboarding — Stripe billing gate, per-community disposition, finalize stub. Adds webhook, two new routes, atomic disposition RPC, layout guard."
- PLAN_OR_REQUIREMENTS: `docs/superpowers/specs/2026-05-09-offboarding-phase-3-design.md`
- BASE_SHA / HEAD_SHA from Step 2
- Specific verification asks: (a) layout guard covers every (status, path) combination, (b) `set_community_disposition` RPC is race-safe under concurrent calls for the same community_id, (c) feature flag pattern for transfer is the only gate (no parallel code path), (d) no statuses introduced between `approved` and `completed`, (e) webhook idempotency holds under retry storm.

- [ ] **Step 4: Address Critical / Important findings**

Same workflow as Phase 2: fix Critical inline, fix Important before declaring Phase 3 complete. Minor issues can be deferred with TODOs.

- [ ] **Step 5: Final verification**

```bash
npx tsc --noEmit
npm run test:unit
npx playwright test tests/e2e/offboarding-phase3.spec.ts
```

Expected: all clean.

---

## Done criteria for Phase 3

- All 12 tasks committed
- Unit + e2e suites green
- Code review pass with no Critical/Important open
- Migration 027 + 028 applied on remote
- Manual smoke test:
  1. Seed a `deletion_request` in `in_review` with `stripe_resolved_at` set
  2. Visit `/dashboard/account` → see "Continue offboarding" CTA
  3. Click → land on `/disposition` (auto-pass routed past billing because no subs)
  4. Pick suspend on each community → "Continue to account closure" enables → click → land on `/finalize`
  5. `deletion_requests.status` is `approved`; audit log shows full trail; admin_notifications row exists for each suspended community
- Phase 4 entry point (`status='approved'`) reachable without further migration

---

## Self-review

**Spec coverage:**
- ✅ Migration 027 (Task 1) — webhook events, community columns, view, realtime
- ✅ Stripe webhook with signature + idempotency + 3 event types + fan-in (Tasks 3, 4, 5)
- ✅ `lib/stripe/client.ts` consolidation (Task 2)
- ✅ Layout guard for state machine (Task 7)
- ✅ Billing page + auto-pass + cancel action + stall handling (Task 8)
- ✅ Disposition page + atomic RPC + cards (Task 9)
- ✅ `admin_notifications` insert on suspend (Task 9)
- ✅ Finalize stub (Task 10)
- ✅ Status card CTA wiring (Task 10)
- ✅ Forward-compat constraint #1 (CAN_USE_TRANSFER) — Task 6 + Task 9 cards
- ✅ Forward-compat constraint #2 (no statuses between approved and completed) — never introduced
- ✅ Code review pass (Task 12)

**Placeholder scan:**
- One reminder in Task 1 Step 2 to verify `events.event_date` column name. That's a real schema check, not a placeholder.
- Task 7 Step 2 has fallback paths for the `x-pathname` header pattern — that's intentional discovery, not a TBD.

**Type consistency:**
- `CommunityDisposition` from `lib/offboarding/types.ts` used in disposition page, action, cards, and finalize (consistent shape: community_id, action, set_at).
- `CommunitySummary` from `lib/offboarding/disposition.ts` used by both disposition page and cards.
- Status check uses `OPEN_DELETION_STATUSES` consistently.
- Migration 028 RPC name (`set_community_disposition`) matches the action call site.

**Scope:**
- All work is Phase 3 only. Phase 4 is explicitly out (only the stub page reads `status='approved'`).
- Transfer disposition is gated, not built.
