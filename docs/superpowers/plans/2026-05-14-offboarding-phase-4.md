# PM Account Offboarding — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a property manager complete their own account closure end-to-end (Screen 5 confirmation → atomic PII wipe → Screen 6 done), and add a daily cron job that hard-deletes the soft-deleted org/communities/PM row 30 days later.

**Architecture:** All database mutations for the wipe happen inside one atomic Postgres RPC (`complete_pm_offboarding`); the `completeOffboarding` server action sequences the external calls (Stripe customer anonymization → RPC → final email → auth-user deletion) around it. Stripe goes pre-commit because the customer record mirrors PM/org identifying data; the email goes post-commit so a no-op RPC (concurrent run / double-tap) doesn't produce a duplicate confirmation. A second RPC (`hard_delete_expired_offboarding`) is driven by a `CRON_SECRET`-guarded Vercel cron route. Screen 6 is a client-side state swap inside the confirmation component, not a route — once status flips to `completed` the layout guard would redirect any navigation away.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Supabase (Postgres RPCs, service-role admin client, Auth admin API), Stripe SDK, Resend, `node:test` for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-05-14-offboarding-phase-4-design.md`

---

## Conventions for this plan

- **Unit tests** run with `npm run test:unit` (`node --import tsx --test --test-reporter=spec tests/unit/*.test.ts`). Use `node:test` + `node:assert/strict` — see existing `tests/unit/offboarding-eligibility.test.ts` for the exact style.
- **Type check:** `npx tsc --noEmit`. **Lint:** `npm run lint`.
- Server actions, pages, and client components in this codebase are **not** unit-tested in isolation (see Phase 3 — only pure helpers and the webhook were unit-tested). Their behavior is verified by the Playwright e2e suite (Task 10) plus `tsc`/`lint`. This plan follows that established pattern: Tasks 1–3 are full TDD; Tasks 5–9 are write + `tsc` + `lint` + commit; Task 10 is the behavioral verification.
- **Migrations cannot be applied from this repo** (`db push` is forbidden — the Supabase project is shared with the mobile app). Migration 031 is written and committed here, then applied **by the user via the Supabase SQL editor**. Task 4 includes that as an explicit manual checkpoint.
- Branch: `feat/offboarding-phase-4` (already created; the spec is committed there).

---

## File Structure

**Create:**
- `lib/offboarding/completion.ts` — pure helper: `buildStripeAnonymization()` (GDPR-safe Stripe customer shape)
- `lib/email/templates/deletion-complete.ts` — final "account closed" email template
- `supabase/migrations/031_pm_offboarding_completion.sql` — `complete_pm_offboarding` + `hard_delete_expired_offboarding` RPCs + cron index
- `app/(dashboard)/dashboard/account/offboarding/finalize/actions.ts` — `completeOffboarding` server action
- `app/(dashboard)/dashboard/account/offboarding/finalize/FinalConfirmation.tsx` — client component: two-tap close, Screen 5 buttons → Screen 6 state swap
- `app/api/cron/offboarding-hard-delete/route.ts` — `CRON_SECRET`-guarded cron handler
- `vercel.json` — daily cron schedule
- `tests/unit/offboarding-completion.test.ts` — unit tests for `buildStripeAnonymization` + `dispositionLabel`
- `tests/unit/deletion-complete-email.test.ts` — unit tests for the email template
- `tests/e2e/offboarding-phase4.spec.ts` — e2e: Screen 5 render + two-tap arm, the RPC wipe, the cron route

**Modify:**
- `lib/offboarding/disposition.ts` — add `dispositionLabel(action)` helper
- `lib/offboarding/email-senders.ts` — add `sendDeletionComplete()`
- `app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx` — replace the stub with the Screen 5 summary
- `app/(dashboard)/dashboard/account/actions.ts` — remove the dead `deleteAccount` + `getTeamMembersForTransfer` exports

*(`.env.example` already documents `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET` — no change needed there. The user adding the real values to `.env.local` / Vercel is a runtime prerequisite, not a code change.)*

---

### Task 1: `dispositionLabel` helper

**Files:**
- Modify: `lib/offboarding/disposition.ts`
- Test: `tests/unit/offboarding-completion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/offboarding-completion.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dispositionLabel } from "../../lib/offboarding/disposition";

test("dispositionLabel: suspend", () => {
  assert.match(dispositionLabel("suspend"), /Suspended/);
});

test("dispositionLabel: close", () => {
  assert.match(dispositionLabel("close"), /Closed and archived/);
});

test("dispositionLabel: transfer", () => {
  assert.match(dispositionLabel("transfer"), /Transferred/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `dispositionLabel` is not exported from `lib/offboarding/disposition.ts`.

- [ ] **Step 3: Add the helper**

Append to `lib/offboarding/disposition.ts` (after the existing exports):

```ts
export function dispositionLabel(action: DispositionAction): string {
  switch (action) {
    case "suspend":
      return "Suspended (awaiting a new property manager)";
    case "close":
      return "Closed and archived";
    case "transfer":
      return "Transferred to another property manager";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS (the three `dispositionLabel` tests, plus all pre-existing unit tests still green).

- [ ] **Step 5: Commit**

```bash
git add lib/offboarding/disposition.ts tests/unit/offboarding-completion.test.ts
git commit -m "feat(offboarding): add dispositionLabel helper for Phase 4 summaries"
```

---

### Task 2: `buildStripeAnonymization` helper

**Files:**
- Create: `lib/offboarding/completion.ts`
- Test: `tests/unit/offboarding-completion.test.ts` (extend the file from Task 1)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/offboarding-completion.test.ts`:

```ts
import { buildStripeAnonymization } from "../../lib/offboarding/completion";

test("buildStripeAnonymization produces the GDPR-safe customer shape", () => {
  const now = new Date("2026-05-14T12:00:00.000Z");
  const result = buildStripeAnonymization("pm-123", "req-456", now);
  assert.equal(result.name, "Deleted Account");
  assert.equal(result.email, "deleted-pm-123@neighborlyy.internal");
  assert.equal(result.metadata.deleted_at, "2026-05-14T12:00:00.000Z");
  assert.equal(result.metadata.deletion_request_id, "req-456");
});

test("buildStripeAnonymization defaults the timestamp to now", () => {
  const result = buildStripeAnonymization("pm-1", "req-1");
  assert.ok(!Number.isNaN(Date.parse(result.metadata.deleted_at)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `lib/offboarding/completion`.

- [ ] **Step 3: Create the helper**

Create `lib/offboarding/completion.ts`:

```ts
// Pure helpers for Phase 4 account closure. The atomic DB work lives in the
// `complete_pm_offboarding` / `hard_delete_expired_offboarding` Postgres RPCs
// (migration 031); this module only holds logic that the server action needs
// in TypeScript and that is worth unit-testing on its own.

export interface StripeAnonymization {
  name: string;
  email: string;
  metadata: {
    deleted_at: string;
    deletion_request_id: string;
  };
}

/**
 * GDPR-safe replacement values for a Stripe customer belonging to a deleted PM.
 * The subscription itself was already cancelled in Phase 3 (Gate 2); this only
 * scrubs the customer's identifying fields.
 */
export function buildStripeAnonymization(
  pmId: string,
  deletionRequestId: string,
  now: Date = new Date(),
): StripeAnonymization {
  return {
    name: "Deleted Account",
    email: `deleted-${pmId}@neighborlyy.internal`,
    metadata: {
      deleted_at: now.toISOString(),
      deletion_request_id: deletionRequestId,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS (all `offboarding-completion.test.ts` tests + pre-existing tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/offboarding/completion.ts tests/unit/offboarding-completion.test.ts
git commit -m "feat(offboarding): add buildStripeAnonymization helper"
```

---

### Task 3: Final "account closed" email template + sender

**Files:**
- Create: `lib/email/templates/deletion-complete.ts`
- Modify: `lib/offboarding/email-senders.ts`
- Test: `tests/unit/deletion-complete-email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/deletion-complete-email.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deletionComplete } from "../../lib/email/templates/deletion-complete";

test("deletionComplete includes communities, hard-delete date, and support email", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["Maple Ridge — Suspended (awaiting a new property manager)"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.match(tpl.subject, /closed/i);
  assert.match(tpl.html, /Maple Ridge/);
  assert.match(tpl.html, /June 13, 2026/);
  assert.match(tpl.html, /support@neighborlyy\.com/);
  assert.match(tpl.text, /Maple Ridge/);
  assert.match(tpl.text, /June 13, 2026/);
});

test("deletionComplete handles zero communities", () => {
  const tpl = deletionComplete({
    pmFirstName: "",
    communityLines: [],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.match(tpl.html, /No communities required handoff/);
  assert.match(tpl.text, /No communities required handoff/);
});

test("deletionComplete escapes HTML in community lines", () => {
  const tpl = deletionComplete({
    pmFirstName: "Alex",
    communityLines: ["<script>Bad</script> Community"],
    hardDeleteDate: "June 13, 2026",
    supportEmail: "support@neighborlyy.com",
  });
  assert.doesNotMatch(tpl.html, /<script>Bad<\/script>/);
  assert.match(tpl.html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `lib/email/templates/deletion-complete`.

- [ ] **Step 3: Create the template**

Create `lib/email/templates/deletion-complete.ts`:

```ts
import { emailShell, escapeHtml } from "./_layout";

export interface DeletionCompleteInput {
  pmFirstName: string;
  /** One line per community, e.g. "Maple Ridge — Suspended (awaiting a new property manager)" */
  communityLines: string[];
  /** Human-readable date the 30-day window ends, e.g. "June 13, 2026" */
  hardDeleteDate: string;
  supportEmail: string;
}

export function deletionComplete(input: DeletionCompleteInput) {
  const name = escapeHtml(input.pmFirstName || "there");
  const subject = "Your Neighborlyy account has been closed";

  const communityItems = input.communityLines.length
    ? input.communityLines
        .map((line) => `<li style="margin:0 0 4px;">${escapeHtml(line)}</li>`)
        .join("")
    : `<li style="margin:0 0 4px;">No communities required handoff.</li>`;

  const html = emailShell({
    preheader: "Your account is closed. Community data is retained for 30 days.",
    body: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Your account has been closed</h1>
      <p style="margin:0 0 16px;">Hi ${name},</p>
      <p style="margin:0 0 16px;">Your Neighborlyy property manager account has been closed. Here's what happened:</p>
      <p style="margin:0 0 8px;font-weight:600;">Communities</p>
      <ul style="margin:0 0 16px;padding-left:20px;">${communityItems}</ul>
      <p style="margin:0 0 8px;font-weight:600;">Your data</p>
      <ul style="margin:0 0 16px;padding-left:20px;">
        <li style="margin:0 0 4px;">Your name, email, and phone number have been wiped.</li>
        <li style="margin:0 0 4px;">Your login has been disabled.</li>
        <li style="margin:0 0 4px;">Your residents' accounts and history are fully preserved.</li>
        <li style="margin:0 0 4px;">A compliance record of this process is retained.</li>
      </ul>
      <p style="margin:0 0 16px;">Your community data will be permanently deleted on <strong>${escapeHtml(input.hardDeleteDate)}</strong>. If you need a data export before then, email <a href="mailto:${escapeHtml(input.supportEmail)}">${escapeHtml(input.supportEmail)}</a>.</p>
      <p style="margin:0 0 8px;">Thank you for using Neighborlyy.</p>
    `,
  });

  const text =
    `Hi ${input.pmFirstName || "there"},\n\n` +
    `Your Neighborlyy property manager account has been closed.\n\n` +
    `Communities:\n` +
    (input.communityLines.length
      ? input.communityLines.map((l) => `  - ${l}`).join("\n")
      : "  - No communities required handoff.") +
    `\n\nYour data:\n` +
    `  - Your name, email, and phone number have been wiped.\n` +
    `  - Your login has been disabled.\n` +
    `  - Your residents' accounts and history are fully preserved.\n` +
    `  - A compliance record of this process is retained.\n\n` +
    `Your community data will be permanently deleted on ${input.hardDeleteDate}. ` +
    `If you need a data export before then, email ${input.supportEmail}.\n\n` +
    `Thank you for using Neighborlyy.`;

  return { subject, html, text };
}
```

- [ ] **Step 4: Add the sender**

In `lib/offboarding/email-senders.ts`, add the import near the other template imports:

```ts
import { deletionComplete } from "@/lib/email/templates/deletion-complete";
```

And add this sender at the end of the file:

```ts
export interface SendDeletionCompleteArgs {
  to: string;
  pmFirstName: string;
  communityLines: string[];
  hardDeleteDate: string;
}

export async function sendDeletionComplete(args: SendDeletionCompleteArgs) {
  const tpl = deletionComplete({
    pmFirstName: args.pmFirstName,
    communityLines: args.communityLines,
    hardDeleteDate: args.hardDeleteDate,
    supportEmail: SUPPORT_EMAIL,
  });
  return sendEmail({
    to: args.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: SUPPORT_EMAIL,
  });
}
```

- [ ] **Step 5: Run test + typecheck to verify**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: PASS — all email-template tests green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/email/templates/deletion-complete.ts lib/offboarding/email-senders.ts tests/unit/deletion-complete-email.test.ts
git commit -m "feat(offboarding): add deletion-complete email template + sender"
```

---

### Task 4: Migration 031 — completion + hard-delete RPCs

**Files:**
- Create: `supabase/migrations/031_pm_offboarding_completion.sql`

This task writes and commits the migration, then has a **manual apply checkpoint**. There is no automated test here — the RPCs are exercised by the Task 10 e2e suite, which can only pass once the migration is applied.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/031_pm_offboarding_completion.sql`:

```sql
-- =============================================================================
-- Migration: 031_pm_offboarding_completion
-- Description: Phase 4 of PM Account Offboarding. Adds the atomic completion
--              RPC (Gate 5 — PII wipe) and the cron hard-delete RPC (Gate 6),
--              plus a schema adjustment so subscription_history rows survive
--              a community hard-delete (financial-record retention), plus a
--              partial index for the cron query. Per the design at
--              docs/superpowers/specs/2026-05-14-offboarding-phase-4-design.md
-- =============================================================================

-- 0. subscription_history retention.
--    The column is currently NOT NULL with NO ACTION on delete, which would
--    cause community hard-deletes to fail and would force us to either delete
--    financial records (compliance violation) or leave communities forever
--    soft-deleted. Allow community_id to go NULL and have the FK SET NULL on
--    community deletion — preserves the financial row, just severs its link.
ALTER TABLE public.subscription_history
  ALTER COLUMN community_id DROP NOT NULL;

ALTER TABLE public.subscription_history
  DROP CONSTRAINT IF EXISTS subscription_history_community_id_fkey;

ALTER TABLE public.subscription_history
  ADD CONSTRAINT subscription_history_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;

-- 1. complete_pm_offboarding — atomic Gate 5 PII wipe.
--    Guarded by status='approved' so it cannot run out of order or twice.
--    Nulls PM PII, marks the org deleted, soft-deletes ONLY closed communities
--    of THIS PM's org, sets pii_wiped_at/soft_deleted_at/status='completed',
--    appends one audit row.
CREATE OR REPLACE FUNCTION public.complete_pm_offboarding(
  p_request_id uuid,
  p_audit      jsonb
)
RETURNS TABLE (out_request_id uuid, out_pm_id uuid, out_org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pm_id     uuid;
  v_org_id    uuid;
  v_close_ids uuid[];
BEGIN
  IF p_audit IS NULL OR jsonb_typeof(p_audit) <> 'object' THEN
    RAISE EXCEPTION 'complete_pm_offboarding: p_audit must be a non-null JSON object';
  END IF;

  -- Lock the request row and confirm it is exactly at the Phase 4 entry point.
  SELECT dr.pm_id, dr.org_id
    INTO v_pm_id, v_org_id
    FROM public.deletion_requests dr
   WHERE dr.id = p_request_id
     AND dr.status = 'approved'
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Wrong id, or status already advanced. The caller treats an empty result
    -- set as a retryable no-op (already completed / concurrent run).
    RETURN;
  END IF;

  -- NULL-safety guard: a malformed request with NULL pm_id or org_id would
  -- silently match zero rows below, leaving status='completed' without
  -- actually scrubbing anything. Refuse so the caller sees the error.
  IF v_pm_id IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'complete_pm_offboarding: request % has NULL pm_id or org_id',
      p_request_id;
  END IF;

  -- Community ids whose disposition action is 'close' (from the jsonb array
  -- written in Phase 3). Suspended communities are intentionally left alone --
  -- they survive and await a new PM.
  SELECT array_agg((elem->>'community_id')::uuid)
    INTO v_close_ids
    FROM public.deletion_requests dr
         CROSS JOIN LATERAL jsonb_array_elements(dr.community_disposition) elem
   WHERE dr.id = p_request_id
     AND elem->>'action' = 'close';

  -- 1. Null the PM's personal data.
  --    full_name is NOT NULL  -> set to the '[deleted]' sentinel.
  --    email is NOT NULL UNIQUE -> set to a per-row-unique sentinel so multiple
  --    deletions never collide AND the real address is freed for re-signup.
  UPDATE public.property_managers
     SET full_name    = '[deleted]',
         phone        = NULL,
         avatar_url   = NULL,
         company_name = NULL,
         email        = '[deleted]-' || id::text
   WHERE id = v_pm_id;

  -- 2. Mark the organization deleted (soft).
  UPDATE public.organizations
     SET status     = 'deleted',
         deleted_at = now()
   WHERE id = v_org_id;

  -- 3. Soft-delete ONLY the closed communities, AND only those that belong to
  --    this org (defensive: prevents a malformed disposition entry from
  --    soft-deleting a community in another org).
  IF v_close_ids IS NOT NULL AND array_length(v_close_ids, 1) > 0 THEN
    UPDATE public.communities
       SET deleted_at = now()
     WHERE id = ANY(v_close_ids)
       AND organization_id = v_org_id
       AND deleted_at IS NULL;
  END IF;

  -- 4. Advance the request to completed, stamp the wipe timestamps, append audit.
  UPDATE public.deletion_requests
     SET pii_wiped_at    = now(),
         soft_deleted_at = now(),
         status          = 'completed',
         audit_log       = COALESCE(audit_log, '[]'::jsonb) || jsonb_build_array(p_audit)
   WHERE id = p_request_id
     AND status = 'approved';

  RETURN QUERY SELECT p_request_id, v_pm_id, v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_pm_offboarding(uuid, jsonb)
  FROM anon, authenticated, public;

-- 2. hard_delete_expired_offboarding — Gate 6 cron job.
--    For each request past the 30-day soft-delete window:
--      - Hard-deletes the closed communities (after pre-clearing their
--        team_members + analytics_events; community_settings cascades and
--        subscription_history auto-NULLs via the FK change above).
--      - Nulls property_manager_id on the PM's surviving (suspended)
--        communities + team_members so the PM delete can succeed.
--      - Hard-deletes the PM row.
--      - Does NOT delete the organization — it survives while any community
--        (including suspended ones awaiting a new PM) still references it.
--        Reclamation of zero-community orgs is out of scope here.
--      - Stamps hard_deleted_at and appends a 'hard_deleted' audit entry.
--    The deletion_requests row itself is RETAINED (7-year compliance).
--    Per-request work runs in its own subtransaction (BEGIN…EXCEPTION) so a
--    single failing request does not poison the whole batch.
--    Cursor uses FOR UPDATE SKIP LOCKED so two concurrent invocations partition
--    the work rather than blocking on each other or double-processing.
--    Idempotent via the hard_deleted_at IS NULL guard in the cursor query.
CREATE OR REPLACE FUNCTION public.hard_delete_expired_offboarding()
RETURNS TABLE (
  processed   integer,
  errored     integer,
  request_ids uuid[],
  errored_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req         record;
  v_close_ids   uuid[];
  v_ids         uuid[] := '{}';
  v_err_ids     uuid[] := '{}';
  v_count       integer := 0;
  v_err_count   integer := 0;
  v_cron_audit  jsonb;
  v_err_audit   jsonb;
BEGIN
  FOR v_req IN
    SELECT id, pm_id, org_id
      FROM public.deletion_requests
     WHERE status = 'completed'
       AND soft_deleted_at IS NOT NULL
       AND soft_deleted_at < now() - interval '30 days'
       AND hard_deleted_at IS NULL
     FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Per-iteration subtransaction. If any statement below raises, the
      -- EXCEPTION handler rolls back this iteration's changes only and audits
      -- the failure on the request row; the loop continues with the next
      -- request.

      -- Identify the closed (soft-deleted) communities for this org.
      IF v_req.org_id IS NULL THEN
        v_close_ids := '{}';
      ELSE
        SELECT array_agg(id)
          INTO v_close_ids
          FROM public.communities
         WHERE organization_id = v_req.org_id
           AND deleted_at IS NOT NULL;
      END IF;

      -- 1. Pre-clear NO-ACTION children of the closed communities that we
      --    intend to delete with the parent.
      --      community_settings.community_code -> CASCADE (Postgres handles).
      --      subscription_history.community_id -> SET NULL (FK above; rows kept).
      --      team_members.community_id     -> NO ACTION; we delete explicitly.
      --      analytics_events.community_id -> NO ACTION; we delete explicitly.
      IF v_close_ids IS NOT NULL AND array_length(v_close_ids, 1) > 0 THEN
        DELETE FROM public.team_members
         WHERE community_id = ANY(v_close_ids);
        DELETE FROM public.analytics_events
         WHERE community_id = ANY(v_close_ids);

        -- 2. Hard-delete the closed communities.
        DELETE FROM public.communities
         WHERE id = ANY(v_close_ids);
      END IF;

      -- 3. Pre-clear PM references on SURVIVING (suspended) communities and
      --    on any team_members that still point at the PM. These FKs are
      --    NO ACTION, so without nulling them the PM delete below would fail.
      IF v_req.pm_id IS NOT NULL THEN
        UPDATE public.communities
           SET property_manager_id = NULL
         WHERE property_manager_id = v_req.pm_id;

        UPDATE public.team_members
           SET property_manager_id = NULL
         WHERE property_manager_id = v_req.pm_id;

        -- 4. Hard-delete the PM row.
        --    deletion_requests.pm_id is ON DELETE SET NULL (audit row survives).
        --    transfer_requests.{incoming,outgoing}_pm_id is ON DELETE SET NULL.
        DELETE FROM public.property_managers
         WHERE id = v_req.pm_id;
      END IF;

      -- 5. The organization is intentionally NOT deleted. Suspended communities
      --    still reference it; the org survives to receive a new PM.

      -- 6. Stamp the request row + append the 'hard_deleted' audit entry.
      v_cron_audit := jsonb_build_object(
        'actor',    'cron',
        'actor_id', 'cron',
        'action',   'hard_deleted',
        'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
      UPDATE public.deletion_requests
         SET hard_deleted_at = now(),
             audit_log       = COALESCE(audit_log, '[]'::jsonb)
                              || jsonb_build_array(v_cron_audit)
       WHERE id = v_req.id;

      v_ids   := v_ids || v_req.id;
      v_count := v_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Per-request isolation: this iteration's mutations roll back. Log a
        -- warning (Vercel surfaces RAISE WARNING) and audit the failure on the
        -- request row in a fresh inner subtransaction so the failure note
        -- survives. The next nightly run retries (hard_deleted_at is still
        -- NULL); persistent failures will accumulate notes in audit_log.
        RAISE WARNING 'hard_delete_expired_offboarding: request % failed: %',
          v_req.id, SQLERRM;
        BEGIN
          v_err_audit := jsonb_build_object(
            'actor',    'cron',
            'actor_id', 'cron',
            'action',   'hard_delete_failed',
            'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'note',     SQLERRM
          );
          UPDATE public.deletion_requests
             SET audit_log = COALESCE(audit_log, '[]'::jsonb)
                              || jsonb_build_array(v_err_audit)
           WHERE id = v_req.id;
        EXCEPTION
          WHEN OTHERS THEN
            -- Even the failure-audit append failed; nothing more we can do.
            NULL;
        END;
        v_err_ids   := v_err_ids || v_req.id;
        v_err_count := v_err_count + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count, v_err_count, v_ids, v_err_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hard_delete_expired_offboarding()
  FROM anon, authenticated, public;

-- 3. Partial index supporting the cron query above.
CREATE INDEX IF NOT EXISTS deletion_requests_hard_delete_due_idx
  ON public.deletion_requests (soft_deleted_at)
  WHERE status = 'completed' AND hard_deleted_at IS NULL;
```

- [ ] **Step 2: Commit the migration file**

```bash
git add supabase/migrations/031_pm_offboarding_completion.sql
git commit -m "feat(offboarding): migration 031 — completion + hard-delete RPCs"
```

- [ ] **Step 3: MANUAL CHECKPOINT — apply migration 031 to the shared Supabase project**

Do **not** run `supabase db push` from this repo (the project is shared with the mobile app). The user must:
1. Open the Supabase Dashboard → SQL Editor for project `jytmdphkjphpaiuvhbaf`.
2. Paste the full contents of `supabase/migrations/031_pm_offboarding_completion.sql` and run it.
3. Confirm both functions exist and are locked down — run:
   ```sql
   SELECT proname FROM pg_proc
   WHERE proname IN ('complete_pm_offboarding', 'hard_delete_expired_offboarding');
   ```
   Expected: both rows returned.

The implementing agent must pause here and ask the user to confirm the migration was applied before proceeding to Task 10 (the e2e suite will fail without it). Tasks 5–9 do not require the migration to be applied (they only reference the RPCs by string name).

---

### Task 5: `completeOffboarding` server action

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/finalize/actions.ts`

Verification is `tsc` + `lint` here; behavior is covered by Task 10.

- [ ] **Step 1: Create the server action**

Create `app/(dashboard)/dashboard/account/offboarding/finalize/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { appendAudit } from "@/lib/offboarding/audit";
import { buildStripeAnonymization } from "@/lib/offboarding/completion";
import { dispositionLabel } from "@/lib/offboarding/disposition";
import { sendDeletionComplete } from "@/lib/offboarding/email-senders";
import type { CommunityDisposition } from "@/lib/offboarding/types";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Gate 5 — PM-initiated account closure. Sequenced around the atomic
 * `complete_pm_offboarding` RPC: external calls (email, Stripe) run before the
 * commit point because they need pre-wipe data; auth-user deletion runs after,
 * because by then status is already 'completed' and a failure is recoverable.
 *
 * Deliberately does NOT call revalidatePath — an RSC refetch of /finalize would
 * trip the layout guard the instant status becomes 'completed'. FinalConfirmation
 * swaps to Screen 6 client-side and signs the user out.
 */
export async function completeOffboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, full_name, email, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) return { ok: false, error: "Profile not found" };

  const admin = createAdminClient();

  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, org_id, status, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { ok: false, error: "No account closure in progress" };

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  // Load the org's communities for the email summary + Stripe anonymization.
  const { data: communities } = await admin
    .from("communities")
    .select("id, name, community_code, stripe_customer_id")
    .eq("organization_id", pm.organization_id);
  const communityRows = communities ?? [];

  // appendAudit must never abort the wipe — swallow its failures everywhere.
  const safeAudit = (
    action: string,
    actor: "system" | "pm",
    actorId: string,
    note: string,
  ) =>
    appendAudit(admin, "deletion_requests", req.id, {
      actor,
      actor_id: actorId,
      action,
      note,
    }).catch((err) => {
      console.warn(`[offboarding] audit append failed (${action})`, err);
    });

  // ---- Step 1: final confirmation email (best-effort, pre-commit) ----
  const hardDeleteDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const communityLines = communityRows.map((c) => {
    const d = dispositions.find((x) => x.community_id === c.id);
    const label = d ? dispositionLabel(d.action) : "No disposition recorded";
    return `${c.name ?? c.community_code ?? "Community"} — ${label}`;
  });
  try {
    await sendDeletionComplete({
      to: pm.email,
      pmFirstName: pm.full_name?.split(" ")[0] ?? "",
      communityLines,
      hardDeleteDate: hardDeleteDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
    await safeAudit("final_email_sent", "system", "system", `recipient=${pm.email}`);
  } catch (err) {
    console.warn("[offboarding] final email send failed", err);
    await safeAudit(
      "final_email_failed",
      "system",
      "system",
      err instanceof Error ? err.message : String(err),
    );
  }

  // ---- Step 2: Stripe customer anonymization (best-effort, pre-commit) ----
  const customerIds = Array.from(
    new Set(
      communityRows
        .map((c) => c.stripe_customer_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  for (const customerId of customerIds) {
    try {
      const anon = buildStripeAnonymization(pm.id, req.id);
      await getStripe().customers.update(customerId, {
        name: anon.name,
        email: anon.email,
        metadata: anon.metadata,
      });
      await safeAudit("stripe_anonymized", "system", "stripe", `customer=${customerId}`);
    } catch (err) {
      console.warn("[offboarding] stripe customer anonymization failed", {
        customerId,
        err,
      });
      await safeAudit(
        "stripe_anonymize_failed",
        "system",
        "stripe",
        `customer=${customerId}; ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---- Step 3: atomic DB wipe (THE COMMIT POINT) ----
  const { data: rpcRows, error: rpcError } = await admin.rpc(
    "complete_pm_offboarding",
    {
      p_request_id: req.id,
      p_audit: {
        actor: "pm",
        actor_id: user.id,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "fields=full_name,phone,avatar_url,company_name,email",
      },
    },
  );
  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }
  if (!rpcRows || (rpcRows as unknown[]).length === 0) {
    // RPC found no 'approved' row — already completed or a concurrent run.
    return { ok: false, error: "This request is no longer pending closure." };
  }

  // ---- Step 4: delete the auth user (best-effort, post-commit) ----
  // Status is already 'completed'; a failure here is recoverable (the row can
  // be cleaned up later) and the layout guard bounces any residual login.
  try {
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
    await safeAudit("auth_deleted", "system", "system", `auth_user=${user.id}`);
  } catch (err) {
    console.warn("[offboarding] auth user deletion failed", err);
    await safeAudit(
      "auth_delete_failed",
      "system",
      "system",
      err instanceof Error ? err.message : String(err),
    );
  }

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS — no type errors, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/account/offboarding/finalize/actions.ts"
git commit -m "feat(offboarding): completeOffboarding server action (Gate 5 PII wipe)"
```

---

### Task 6: `FinalConfirmation` client component (Screen 5 buttons + Screen 6 swap)

**Files:**
- Create: `app/(dashboard)/dashboard/account/offboarding/finalize/FinalConfirmation.tsx`

- [ ] **Step 1: Create the client component**

Create `app/(dashboard)/dashboard/account/offboarding/finalize/FinalConfirmation.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelDeletionRequest } from "@/app/(dashboard)/dashboard/account/actions";
import { createClient } from "@/lib/supabase/client";
import { completeOffboarding } from "./actions";

// Two-tap window for the destructive confirm. The second tap must land within
// this window or the button disarms — no accidental closures.
const ARM_WINDOW_MS = 4000;

interface FinalConfirmationProps {
  requestId: string;
}

export function FinalConfirmation({ requestId }: FinalConfirmationProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirm" | "complete">("confirm");
  const [armed, setArmed] = useState(false);
  const [working, setWorking] = useState<"close" | "cancel" | null>(null);

  async function handleClose() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), ARM_WINDOW_MS);
      return;
    }
    setWorking("close");
    const result = await completeOffboarding();
    if (!result.ok) {
      setWorking(null);
      setArmed(false);
      toast.error(result.error);
      return;
    }
    setWorking(null);
    // Screen 6 is a client-side state swap — NOT a navigation. Status is now
    // 'completed', so any route change would be redirected by the layout guard.
    setPhase("complete");
  }

  async function handleCancel() {
    setWorking("cancel");
    const result = await cancelDeletionRequest(requestId);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Your account closure has been cancelled.");
    router.push("/dashboard/account");
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  if (phase === "complete") {
    return (
      <section
        className="rounded-2xl border p-6 space-y-4 text-center"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Your account has been closed
        </h2>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Thank you for using Neighborlyy.
        </p>
        <ul
          className="text-sm space-y-1 text-left inline-block"
          style={{ color: "var(--nly-text-secondary)" }}
        >
          <li>✓ Communities handed off</li>
          <li>✓ Billing cancelled</li>
          <li>✓ Your personal data has been wiped</li>
        </ul>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          A confirmation has been sent to your email. Your community data will be
          permanently deleted in 30 days.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-10 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--nly-brand)" }}
        >
          Close this window
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <button
        type="button"
        onClick={handleCancel}
        disabled={working !== null}
        className="flex-1 h-10 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: "var(--nly-border)",
          color: "var(--nly-text-secondary)",
          backgroundColor: "transparent",
        }}
      >
        {working === "cancel" ? "Cancelling..." : "Cancel — I changed my mind"}
      </button>
      <button
        type="button"
        onClick={handleClose}
        disabled={working !== null}
        className="flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--nly-error)" }}
      >
        {working === "close"
          ? "Closing..."
          : armed
            ? "Tap again to confirm"
            : "Close my account"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/account/offboarding/finalize/FinalConfirmation.tsx"
git commit -m "feat(offboarding): FinalConfirmation component — two-tap close + Screen 6 swap"
```

---

### Task 7: Screen 5 — replace the `/finalize` stub

**Files:**
- Modify: `app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx` (full replacement)

- [ ] **Step 1: Replace the page**

Replace the entire contents of `app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispositionLabel } from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";
import { FinalConfirmation } from "./FinalConfirmation";

// Screen 5 — final confirmation before the PII wipe. The offboarding layout
// guard already restricts this route to status='approved'; the redirects below
// are belt-and-suspenders (and mirror the prior stub).
export default async function FinalizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) redirect("/dashboard/account");

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  const { data: communities } = await admin
    .from("communities")
    .select("id, name, community_code, stripe_cancel_at")
    .eq("organization_id", pm.organization_id);
  const communityRows = communities ?? [];

  const communitySummary = communityRows.map((c) => {
    const d = dispositions.find((x) => x.community_id === c.id);
    return {
      id: c.id,
      name: c.name ?? c.community_code ?? "Community",
      label: d ? dispositionLabel(d.action) : "No disposition recorded",
    };
  });

  const cancellingCommunity = communityRows.find((c) => c.stripe_cancel_at);
  const billingLine = cancellingCommunity?.stripe_cancel_at
    ? `Subscription cancelled, effective ${new Date(
        cancellingCommunity.stripe_cancel_at,
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`
    : "No active subscription";

  const sectionStyle = {
    backgroundColor: "var(--nly-surface)",
    borderColor: "var(--nly-border)",
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Your account is ready to be closed
        </h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Here&apos;s a summary of what will happen.
        </p>
      </div>

      <section className="rounded-2xl border p-5 space-y-4" style={sectionStyle}>
        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Communities
          </h2>
          <ul
            className="text-sm space-y-1"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            {communitySummary.length === 0 ? (
              <li>No communities required handoff.</li>
            ) : (
              communitySummary.map((c) => (
                <li key={c.id}>
                  {c.name} — {c.label}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Billing
          </h2>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            {billingLine}
          </p>
        </div>

        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Your data
          </h2>
          <ul
            className="text-sm space-y-1"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            <li>Your name, email, and phone will be wiped.</li>
            <li>Your login will be disabled immediately.</li>
            <li>Your residents&apos; data is fully preserved.</li>
            <li>A permanent compliance record of this process is kept.</li>
          </ul>
        </div>
      </section>

      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        You have 30 days to request a data export after closure — contact
        support@neighborlyy.com.
      </p>

      <FinalConfirmation requestId={req.id} />

      <div className="text-center">
        <Link
          href="/dashboard/account"
          className="text-xs underline"
          style={{ color: "var(--nly-text-tertiary)" }}
        >
          Return to account settings
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS — the build confirms the server/client component split (`FinalConfirmation` is `"use client"`, the page is a server component) is valid.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/account/offboarding/finalize/page.tsx"
git commit -m "feat(offboarding): Screen 5 — final confirmation summary replaces the /finalize stub"
```

---

### Task 8: Cron route + `vercel.json`

**Files:**
- Create: `app/api/cron/offboarding-hard-delete/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create the cron route handler**

Create `app/api/cron/offboarding-hard-delete/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Gate 6 — daily hard delete. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
// automatically when the CRON_SECRET env var is set on the project.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  // Constant-time comparison — `!==` short-circuits on the first differing
  // byte and would leak timing info on a globally-reachable endpoint whose
  // successful bypass triggers an irreversible bulk hard-delete.
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Vercel Cron sets this header automatically on its scheduled invocations.
  // We don't reject on its absence (the secret check is the source of truth
  // for auth), but log it in production so unexpected callers are visible.
  if (
    process.env.NODE_ENV === "production" &&
    req.headers.get("x-vercel-cron") !== "1"
  ) {
    console.warn(
      "[cron:offboarding-hard-delete] authorized request missing x-vercel-cron header",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hard_delete_expired_offboarding");
  if (error) {
    console.error("[cron:offboarding-hard-delete] rpc failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The RPC returns a single row { processed, errored, request_ids, errored_ids }.
  const row = Array.isArray(data) ? data[0] : data;
  const processed = row?.processed ?? 0;
  const errored = row?.errored ?? 0;
  const requestIds = row?.request_ids ?? [];
  const erroredIds = row?.errored_ids ?? [];

  if (errored > 0) {
    console.warn(
      `[cron:offboarding-hard-delete] processed=${processed} errored=${errored}`,
      { request_ids: requestIds, errored_ids: erroredIds },
    );
  } else {
    console.info(
      `[cron:offboarding-hard-delete] processed=${processed} errored=0`,
      { request_ids: requestIds },
    );
  }

  // ok=false when any per-request iteration errored — the cron itself succeeded
  // (RPC returned cleanly), but the operator should know some requests need
  // attention. Vercel cron treats any 2xx as success; the body carries the
  // detail.
  return NextResponse.json({
    ok: errored === 0,
    processed,
    errored,
    request_ids: requestIds,
    errored_ids: erroredIds,
  });
}
```

- [ ] **Step 2: Create `vercel.json`**

Create `vercel.json` at the repo root:

```json
{
  "crons": [
    {
      "path": "/api/cron/offboarding-hard-delete",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/api/cron/offboarding-hard-delete/route.ts" vercel.json
git commit -m "feat(offboarding): Gate 6 cron route + daily vercel.json schedule"
```

---

### Task 9: Remove the dead legacy `deleteAccount` path

**Files:**
- Modify: `app/(dashboard)/dashboard/account/actions.ts`

`deleteAccount` and `getTeamMembersForTransfer` in this file have **no callers** — `DeleteAccountDialog.tsx` (despite the name) is the Phase 2 intent modal that calls `submitDeletionRequest`, not the legacy path.

- [ ] **Step 1: Confirm nothing references the dead exports**

Run:
```bash
grep -rn "deleteAccount\|getTeamMembersForTransfer" --include="*.ts" --include="*.tsx" app components lib | grep -v "account/actions.ts"
```
Expected: **no output**. If anything appears, stop — that caller must be repointed or removed first, and this task's scope has changed.

- [ ] **Step 2: Remove the two dead exports**

In `app/(dashboard)/dashboard/account/actions.ts`:
- Delete the entire `deleteAccount` function, including its `@deprecated` JSDoc block immediately above it (starts at the `/**` line, ends at the closing `}` of `deleteAccount`).
- Delete the entire `getTeamMembersForTransfer` function.

Leave everything else in the file (`updateProfile`, `changePassword`, and all the offboarding actions `submitDeletionRequest`, `cancelDeletionRequest`, `setCorporationContactEmail`, `getActiveDeletionRequest`, `resendCorpApprovalEmail`, `getCorporationContactEmail`) untouched.

- [ ] **Step 3: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS — confirms no dangling references.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/account/actions.ts"
git commit -m "chore(offboarding): remove dead legacy deleteAccount + getTeamMembersForTransfer"
```

---

### Task 10: End-to-end suite

**Files:**
- Create: `tests/e2e/offboarding-phase4.spec.ts`

**Requires migration 031 applied (Task 4, Step 3).** Confirm with the user before starting.

This suite has three independently-cleaned concerns. **Why it is structured this way:** `completeOffboarding` deletes the auth user, so it can never be run through the browser against the shared test user (`e2e-test@miyora.com`) — that would break every other test. So:
- The **Screen 5 UI** is driven in the browser as the shared user, but only up to *arming* the two-tap button (never the second tap — that would wipe the shared PM).
- The **actual wipe** is verified by calling the `complete_pm_offboarding` RPC directly against a **throwaway PM** (its own throwaway auth user), with no browser involved.
- The **cron** is verified by calling the `hard_delete_expired_offboarding` RPC via the cron route, against throwaway `completed` requests.

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/offboarding-phase4.spec.ts`:

```ts
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_USER } from "../fixtures/test-data";

// ---------------------------------------------------------------------------
// Phase 4 e2e — PM offboarding completion (Gate 5 wipe) + Gate 6 cron.
//
// Three concerns, each self-cleaning:
//   A. Screen 5 renders + the two-tap close button arms. Driven in the browser
//      as the shared test user. We NEVER tap the second time — completeOffboarding
//      deletes the auth user, which would break the shared session for all
//      other specs.
//   B. complete_pm_offboarding RPC against a throwaway PM (its own throwaway
//      auth user). Verifies the atomic wipe without a browser.
//   C. hard_delete_expired_offboarding via the cron route, against throwaway
//      'completed' requests with backdated soft_deleted_at.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

let admin: SupabaseClient | null = null;
if (supabaseUrl && serviceRoleKey) {
  admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const rand = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// --- Concern A: Screen 5 render + two-tap arm (shared user, browser) --------
test.describe("Phase 4 — Screen 5 (final confirmation)", () => {
  let pmId: string;
  let orgId: string;
  let communityId: string;
  let requestId: string;
  let priorOrgId: string | null = null;

  test.beforeAll(() => {
    test.skip(
      !admin,
      "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env",
    );
  });

  test.beforeEach(async () => {
    if (!admin) return;

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const authUser = usersPage?.users?.find((u) => u.email === TEST_USER.email);
    if (!authUser) throw new Error(`Test auth user not found (${TEST_USER.email}).`);

    const { data: pm } = await admin
      .from("property_managers")
      .select("id, organization_id")
      .eq("user_id", authUser.id)
      .single();
    if (!pm) throw new Error("Test property_manager row not found.");
    pmId = pm.id;
    priorOrgId = pm.organization_id;

    const suffix = rand();
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Screen5 Org ${suffix}`, type: "individual" })
      .select("id")
      .single();
    orgId = org!.id;

    await admin
      .from("property_managers")
      .update({ organization_id: orgId })
      .eq("id", pmId);

    const { data: community } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Phase4 Community ${suffix}`,
        building_name: `Phase4 Building ${suffix}`,
        community_code: `P4${suffix}`,
        admin_code: `AD${suffix}`,
      })
      .select("id")
      .single();
    communityId = community!.id;

    // Seed a deletion request already at the Phase 4 entry point: status
    // 'approved' with a recorded 'suspend' disposition for the community.
    const { data: req } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "approved",
        stripe_resolved_at: new Date().toISOString(),
        community_disposition: [
          {
            community_id: communityId,
            action: "suspend",
            set_at: new Date().toISOString(),
          },
        ],
        audit_log: [],
      })
      .select("id")
      .single();
    requestId = req!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    await admin.from("deletion_requests").delete().eq("id", requestId);
    await admin.from("communities").delete().eq("id", communityId);
    await admin
      .from("property_managers")
      .update({ organization_id: priorOrgId })
      .eq("id", pmId);
    await admin.from("organizations").delete().eq("id", orgId);
  });

  test("renders the summary and arms the two-tap close button", async ({ page }) => {
    await page.goto("/dashboard/account/offboarding/finalize");

    await expect(
      page.getByRole("heading", { name: /ready to be closed/i }),
    ).toBeVisible();
    await expect(page.getByText("Communities")).toBeVisible();
    await expect(page.getByText("Billing")).toBeVisible();
    await expect(page.getByText("Your data")).toBeVisible();
    await expect(page.getByText(/Suspended/)).toBeVisible();

    const closeButton = page.getByRole("button", { name: "Close my account" });
    await expect(closeButton).toBeVisible();

    // First tap arms the button. We deliberately do NOT tap again — the second
    // tap would run completeOffboarding and delete the shared test auth user.
    await closeButton.click();
    await expect(
      page.getByRole("button", { name: "Tap again to confirm" }),
    ).toBeVisible();
  });
});

// --- Concern B: complete_pm_offboarding RPC (throwaway PM, no browser) ------
test.describe("Phase 4 — complete_pm_offboarding RPC", () => {
  let throwawayUserId: string;
  let pmId: string;
  let orgId: string;
  let closeCommunityId: string;
  let suspendCommunityId: string;
  let requestId: string;

  test.beforeAll(() => {
    test.skip(!admin, "Requires Supabase service-role env vars");
  });

  test.beforeEach(async () => {
    if (!admin) return;
    const suffix = rand();

    // A real throwaway auth user — property_managers.user_id is a NOT NULL FK
    // to auth.users, so we cannot fake it.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: `phase4-rpc-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(`Failed to create throwaway user: ${createErr?.message}`);
    }
    throwawayUserId = created.user.id;

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `Phase4 RPC Org ${suffix}`, type: "individual" })
      .select("id")
      .single();
    orgId = org!.id;

    const { data: pm } = await admin
      .from("property_managers")
      .insert({
        user_id: throwawayUserId,
        full_name: "Throwaway PM",
        email: `phase4-rpc-${suffix}@miyora.com`,
        phone: "555-0100",
        company_name: "Throwaway Co",
        organization_id: orgId,
      })
      .select("id")
      .single();
    pmId = pm!.id;

    const { data: closeComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Close Community ${suffix}`,
        building_name: `Close Bldg ${suffix}`,
        community_code: `PC${suffix}`,
        admin_code: `CC${suffix}`,
      })
      .select("id")
      .single();
    closeCommunityId = closeComm!.id;

    const { data: suspendComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Suspend Community ${suffix}`,
        building_name: `Suspend Bldg ${suffix}`,
        community_code: `PS${suffix}`,
        admin_code: `SC${suffix}`,
      })
      .select("id")
      .single();
    suspendCommunityId = suspendComm!.id;

    const { data: req } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "approved",
        stripe_resolved_at: new Date().toISOString(),
        community_disposition: [
          {
            community_id: closeCommunityId,
            action: "close",
            set_at: new Date().toISOString(),
          },
          {
            community_id: suspendCommunityId,
            action: "suspend",
            set_at: new Date().toISOString(),
          },
        ],
        audit_log: [],
      })
      .select("id")
      .single();
    requestId = req!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    await admin.from("deletion_requests").delete().eq("id", requestId);
    await admin.from("communities").delete().eq("organization_id", orgId);
    await admin.from("property_managers").delete().eq("id", pmId);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(throwawayUserId);
  });

  test("atomically wipes PII, marks org deleted, soft-deletes only closed communities", async () => {
    if (!admin) return;

    const { data: rpcRows, error } = await admin.rpc("complete_pm_offboarding", {
      p_request_id: requestId,
      p_audit: {
        actor: "pm",
        actor_id: throwawayUserId,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "e2e",
      },
    });
    expect(error).toBeNull();
    expect(Array.isArray(rpcRows) ? rpcRows.length : 0).toBe(1);

    const { data: pm } = await admin
      .from("property_managers")
      .select("full_name, email, phone, company_name, avatar_url")
      .eq("id", pmId)
      .single();
    expect(pm!.full_name).toBe("[deleted]");
    expect(pm!.email).toBe(`[deleted]-${pmId}`);
    expect(pm!.phone).toBeNull();
    expect(pm!.company_name).toBeNull();
    expect(pm!.avatar_url).toBeNull();

    const { data: org } = await admin
      .from("organizations")
      .select("status, deleted_at")
      .eq("id", orgId)
      .single();
    expect(org!.status).toBe("deleted");
    expect(org!.deleted_at).not.toBeNull();

    const { data: closeComm } = await admin
      .from("communities")
      .select("deleted_at")
      .eq("id", closeCommunityId)
      .single();
    expect(closeComm!.deleted_at).not.toBeNull();

    const { data: suspendComm } = await admin
      .from("communities")
      .select("deleted_at")
      .eq("id", suspendCommunityId)
      .single();
    expect(suspendComm!.deleted_at).toBeNull();

    const { data: reqAfter } = await admin
      .from("deletion_requests")
      .select("status, pii_wiped_at, soft_deleted_at, audit_log")
      .eq("id", requestId)
      .single();
    expect(reqAfter!.status).toBe("completed");
    expect(reqAfter!.pii_wiped_at).not.toBeNull();
    expect(reqAfter!.soft_deleted_at).not.toBeNull();
    expect(reqAfter!.audit_log.some((e: { action: string }) => e.action === "pii_wiped")).toBe(true);
  });

  test("is a no-op when the request is not 'approved'", async () => {
    if (!admin) return;
    await admin
      .from("deletion_requests")
      .update({ status: "completed" })
      .eq("id", requestId);

    const { data: rpcRows, error } = await admin.rpc("complete_pm_offboarding", {
      p_request_id: requestId,
      p_audit: {
        actor: "pm",
        actor_id: throwawayUserId,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "e2e",
      },
    });
    expect(error).toBeNull();
    expect(Array.isArray(rpcRows) ? rpcRows.length : 0).toBe(0);

    // PM PII untouched because the guard short-circuited.
    const { data: pm } = await admin
      .from("property_managers")
      .select("full_name")
      .eq("id", pmId)
      .single();
    expect(pm!.full_name).toBe("Throwaway PM");
  });
});

// --- Concern C: hard_delete_expired_offboarding via the cron route ----------
test.describe("Phase 4 — Gate 6 cron hard delete", () => {
  let dueUserId: string;
  let dueOrgId: string;
  let dueCommunityId: string;
  let dueRequestId: string;
  let freshRequestId: string;
  let freshOrgId: string;
  let freshUserId: string;
  let freshPmId: string;

  test.beforeAll(() => {
    test.skip(!admin || !cronSecret, "Requires Supabase service-role + CRON_SECRET env vars");
  });

  test.beforeEach(async () => {
    if (!admin) return;
    const suffix = rand();

    // --- A request whose 30-day window has elapsed (should be hard-deleted) ---
    const { data: dueUser } = await admin.auth.admin.createUser({
      email: `phase4-cron-due-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    dueUserId = dueUser!.user!.id;

    const { data: dueOrg } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Cron Due Org ${suffix}`, type: "individual", status: "deleted", deleted_at: new Date().toISOString() })
      .select("id")
      .single();
    dueOrgId = dueOrg!.id;

    const { data: duePm } = await admin
      .from("property_managers")
      .insert({
        user_id: dueUserId,
        full_name: "[deleted]",
        email: `[deleted]-cron-due-${suffix}`,
        organization_id: dueOrgId,
      })
      .select("id")
      .single();

    const { data: dueComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: duePm!.id,
        organization_id: dueOrgId,
        name: `Cron Due Community ${suffix}`,
        building_name: `Cron Due Bldg ${suffix}`,
        community_code: `CD${suffix}`,
        admin_code: `DD${suffix}`,
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    dueCommunityId = dueComm!.id;

    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dueReq } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: duePm!.id,
        org_id: dueOrgId,
        reason: "test",
        status: "completed",
        stripe_resolved_at: thirtyOneDaysAgo,
        pii_wiped_at: thirtyOneDaysAgo,
        soft_deleted_at: thirtyOneDaysAgo,
        community_disposition: [],
        audit_log: [],
      })
      .select("id")
      .single();
    dueRequestId = dueReq!.id;

    // --- A recently-completed request (should be LEFT ALONE) ---
    const { data: freshUser } = await admin.auth.admin.createUser({
      email: `phase4-cron-fresh-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    freshUserId = freshUser!.user!.id;

    const { data: freshOrg } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Cron Fresh Org ${suffix}`, type: "individual", status: "deleted", deleted_at: new Date().toISOString() })
      .select("id")
      .single();
    freshOrgId = freshOrg!.id;

    const { data: freshPm } = await admin
      .from("property_managers")
      .insert({
        user_id: freshUserId,
        full_name: "[deleted]",
        email: `[deleted]-cron-fresh-${suffix}`,
        organization_id: freshOrgId,
      })
      .select("id")
      .single();
    freshPmId = freshPm!.id;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: freshReq } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: freshPmId,
        org_id: freshOrgId,
        reason: "test",
        status: "completed",
        stripe_resolved_at: fiveDaysAgo,
        pii_wiped_at: fiveDaysAgo,
        soft_deleted_at: fiveDaysAgo,
        community_disposition: [],
        audit_log: [],
      })
      .select("id")
      .single();
    freshRequestId = freshReq!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    // Both requests are retained rows; delete them + any surviving FK rows.
    await admin.from("deletion_requests").delete().eq("id", dueRequestId);
    await admin.from("deletion_requests").delete().eq("id", freshRequestId);
    await admin.from("communities").delete().eq("organization_id", dueOrgId);
    await admin.from("communities").delete().eq("organization_id", freshOrgId);
    await admin.from("property_managers").delete().eq("organization_id", dueOrgId);
    await admin.from("property_managers").delete().eq("id", freshPmId);
    await admin.from("organizations").delete().eq("id", dueOrgId);
    await admin.from("organizations").delete().eq("id", freshOrgId);
    await admin.auth.admin.deleteUser(dueUserId);
    await admin.auth.admin.deleteUser(freshUserId);
  });

  test("rejects requests without a valid CRON_SECRET", async () => {
    const ctx = await playwrightRequest.newContext({ baseURL });
    const res = await ctx.get("/api/cron/offboarding-hard-delete");
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("hard-deletes only requests past the 30-day window", async () => {
    if (!admin) return;
    const ctx = await playwrightRequest.newContext({ baseURL });
    const res = await ctx.get("/api/cron/offboarding-hard-delete", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.request_ids).toContain(dueRequestId);
    expect(body.request_ids).not.toContain(freshRequestId);
    await ctx.dispose();

    // The due request: FK rows gone, request row retained with hard_deleted_at set.
    const { data: dueOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("id", dueOrgId)
      .maybeSingle();
    expect(dueOrg).toBeNull();

    const { data: dueComm } = await admin
      .from("communities")
      .select("id")
      .eq("id", dueCommunityId)
      .maybeSingle();
    expect(dueComm).toBeNull();

    const { data: dueReqAfter } = await admin
      .from("deletion_requests")
      .select("hard_deleted_at, audit_log")
      .eq("id", dueRequestId)
      .single();
    expect(dueReqAfter!.hard_deleted_at).not.toBeNull();
    expect(dueReqAfter!.audit_log.some((e: { action: string }) => e.action === "hard_deleted")).toBe(true);

    // The fresh request: completely untouched.
    const { data: freshOrgAfter } = await admin
      .from("organizations")
      .select("id")
      .eq("id", freshOrgId)
      .maybeSingle();
    expect(freshOrgAfter).not.toBeNull();

    const { data: freshReqAfter } = await admin
      .from("deletion_requests")
      .select("hard_deleted_at")
      .eq("id", freshRequestId)
      .single();
    expect(freshReqAfter!.hard_deleted_at).toBeNull();
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Make sure the dev server is running (`npm run dev` in another terminal) or that `PLAYWRIGHT_BASE_URL` points at a deployed preview, and that `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`.

Run: `npm run test:e2e -- offboarding-phase4`
Expected: PASS — all five tests across the three describe blocks green. (If `complete_pm_offboarding` / `hard_delete_expired_offboarding` errors appear, migration 031 was not applied — return to Task 4 Step 3.)

- [ ] **Step 3: Run the full unit + e2e suite for regressions**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS — Phase 4 tests plus all pre-existing Phase 3 / onboarding tests still green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/offboarding-phase4.spec.ts
git commit -m "test(offboarding): Phase 4 e2e — Screen 5, completion RPC, cron hard delete"
```

---

## Self-Review

**1. Spec coverage:**
- Gate 5 PII wipe → Task 4 (`complete_pm_offboarding`) + Task 5 (`completeOffboarding` action). ✓
- Screen 5 → Task 7. ✓
- Screen 6 (client state swap) → Task 6. ✓
- Final email (best-effort) → Task 3 + Task 5 Step 1. ✓
- Stripe customer anonymization (best-effort) → Task 2 + Task 5 Step 2. ✓
- Auth user deletion (post-commit, best-effort) → Task 5 Step 4. ✓
- Gate 6 cron hard delete → Task 4 (`hard_delete_expired_offboarding`) + Task 8. ✓
- `vercel.json` daily schedule → Task 8. ✓
- Layout guard unchanged, verified → Task 10 Concern A (only `approved` reaches `/finalize`; the spec notes no code change needed). ✓
- Legacy `deleteAccount` removal → Task 9. ✓
- `email` NOT NULL UNIQUE / `full_name` NOT NULL adaptation → Task 4 SQL + spec amended. ✓
- Migration apply constraint (SQL editor, not `db push`) → Task 4 Step 3. ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to"/"add error handling" — every step has complete code or exact commands. ✓

**3. Type consistency:**
- `dispositionLabel(action: DispositionAction)` — defined Task 1, used in Tasks 5 & 7. ✓
- `buildStripeAnonymization(pmId, deletionRequestId, now?)` returning `{ name, email, metadata }` — defined Task 2, used in Task 5. ✓
- `deletionComplete(input)` / `sendDeletionComplete(args)` — `communityLines: string[]`, `hardDeleteDate: string` — defined Task 3, used in Task 5. ✓
- `completeOffboarding(): Promise<ActionResult>` — defined Task 5, used in Task 6. ✓
- `FinalConfirmation({ requestId })` — defined Task 6, used in Task 7 (`<FinalConfirmation requestId={req.id} />`). ✓
- RPC names `complete_pm_offboarding` / `hard_delete_expired_offboarding` and param names `p_request_id` / `p_audit` — consistent across Tasks 4, 5, 8, 10. ✓
- RPC return shape `{ request_id, pm_id, org_id }` and `{ processed, request_ids }` — consistent between Task 4 (SQL) and Tasks 5/8/10 (callers). ✓

---

## Execution Notes

- Tasks 1–3 are independent and fully TDD'd; 5–9 each depend on earlier helpers/components as noted; 10 depends on all of 1–9 **and** the migration being applied (Task 4 Step 3).
- The hard human gate is Task 4 Step 3 — the implementing agent must stop and get user confirmation that migration 031 is live before running Task 10.
- Per the user's standing rule and request, a `code-review` subagent reviews each task's diff before the next task begins.
