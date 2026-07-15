# Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Miyora admin dashboard actionable — clickable stat cards with weekly deltas, a quick-actions row, inline resident approvals, a genuinely live activity feed, and a correct multi-trial countdown.

**Architecture:** Reuse existing server data-fetching in `dashboard/page.tsx`; add two small presentational/interactive client components; extend `SummaryCard` and `ActivityFeed` in place; add one pure helper to `lib/trial-days.ts`. No DB migrations — all reads/mutations use existing tables and the `approve_pending_user` / `deny_pending_user` RPCs via the existing `approveResident`/`denyResident` server actions.

**Tech Stack:** Next.js (App Router, `force-dynamic`), React client components, `motion/react`, Supabase (`@/lib/supabase/{server,client}`), `sonner` toasts, `date-fns`, `lucide-react`, Tailwind + `--nly-*` design tokens. Tests: `node --test` via `tsx` (`npm run test:unit`, files in `tests/unit/*.test.ts`).

## Global Constraints

- Product name in UI copy is **Miyora**.
- Brand color is cyan `#2FC4D3` = `var(--nly-brand)`; use semantic `--nly-*` tokens, never hard-coded hex.
- Never surface raw `error.message` to users — friendly toast copy only (form-conventions).
- `approveResident(id, communityId)` and `denyResident(id, communityId, reason?)` **return** `{ error: string } | { success: true }` — they do NOT throw; check `.error`.
- react-hooks v6: set-state-in-effect and ref-in-effect are lint ERRORS. Effects may hold subscriptions and call `router.refresh()`, but must not call a state setter directly in the effect body.
- Build does not fail on lint, but `npm run lint` must stay clean (0 errors).
- No new npm dependencies.

---

### Task 1: `soonestTrialDaysLeft` helper (pure logic, TDD)

**Files:**
- Modify: `lib/trial-days.ts`
- Test: `tests/unit/trial-days.test.ts` (create)

**Interfaces:**
- Consumes: existing `trialDaysLeft` (unchanged).
- Produces: `soonestTrialDaysLeft(communities: { status: string; trial_ends_at: string | null }[], now?: Date): number | null` — the fewest calendar-days-left among communities whose `status === "trial"` and `trial_ends_at` is set, clamped at 0; `null` when none are on trial.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trial-days.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { soonestTrialDaysLeft } from "../../lib/trial-days";

const NOW = new Date("2026-07-15T12:00:00Z");

test("returns null when no community is on trial", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "active", trial_ends_at: "2026-07-20T12:00:00Z" }],
      NOW,
    ),
    null,
  );
});

test("returns the fewest days left among trialing communities", () => {
  const days = soonestTrialDaysLeft(
    [
      { status: "trial", trial_ends_at: "2026-07-25T12:00:00Z" }, // 10
      { status: "trial", trial_ends_at: "2026-07-18T12:00:00Z" }, // 3  <- soonest
      { status: "active", trial_ends_at: "2026-07-16T12:00:00Z" }, // ignored
    ],
    NOW,
  );
  assert.equal(days, 3);
});

test("ignores trialing communities with null trial_ends_at", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "trial", trial_ends_at: null }],
      NOW,
    ),
    null,
  );
});

test("clamps already-ended trials to 0", () => {
  assert.equal(
    soonestTrialDaysLeft(
      [{ status: "trial", trial_ends_at: "2026-07-10T12:00:00Z" }],
      NOW,
    ),
    0,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- tests/unit/trial-days.test.ts`
(or `node --import tsx --test tests/unit/trial-days.test.ts`)
Expected: FAIL — `soonestTrialDaysLeft` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/trial-days.ts`:

```ts
import { differenceInCalendarDays } from "date-fns";

// ... existing trialDaysLeft above ...

/**
 * Fewest calendar-days-left among communities still on trial (the soonest to
 * expire), clamped at 0. Returns null when no community is on trial. Lets the
 * header show one honest countdown for a PM with several trials on different
 * clocks instead of arbitrarily using the first community.
 */
export function soonestTrialDaysLeft(
  communities: { status: string; trial_ends_at: string | null }[],
  now: Date = new Date(),
): number | null {
  const days = communities
    .filter((c) => c.status === "trial" && c.trial_ends_at)
    .map((c) =>
      Math.max(0, differenceInCalendarDays(new Date(c.trial_ends_at as string), now)),
    );
  return days.length ? Math.min(...days) : null;
}
```

Note: `differenceInCalendarDays` is already imported at the top of the file — do not add a duplicate import; reuse the existing one.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- tests/unit/trial-days.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/trial-days.ts tests/unit/trial-days.test.ts
git commit -m "feat(dashboard): soonestTrialDaysLeft helper for multi-trial PMs"
```

---

### Task 2: `SummaryCard` — clickable `href` + generalized `trend`

**Files:**
- Modify: `components/dashboard/SummaryCard.tsx`

**Interfaces:**
- Produces: `SummaryCard` props gain `href?: string` and change `trend` from `{ value: string; positive: boolean }` to `{ value: string; tone?: "positive" | "neutral" | "negative"; label?: string }`.

- [ ] **Step 1: Confirm no existing `trend` caller breaks**

Run: `grep -rn "trend=" app components --include="*.tsx"`
Expected: no output (no callers). If any appear, migrate them to the new shape in this task before proceeding.

- [ ] **Step 2: Add `href` and generalize `trend`**

In `components/dashboard/SummaryCard.tsx`:

Add the import at the top (after the existing imports):

```tsx
import Link from "next/link";
```

Change the props interface:

```tsx
interface SummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  trend?: { value: string; tone?: "positive" | "neutral" | "negative"; label?: string };
  footer?: ReactNode;
  accentColor?: string;
  index?: number;
  href?: string;
}
```

Add `href` to the destructured params:

```tsx
export function SummaryCard({
  label,
  value,
  subtext,
  icon,
  trend,
  footer,
  accentColor = "var(--nly-brand)",
  index = 0,
  href,
}: SummaryCardProps) {
```

Replace the `trend` render block (currently the `{trend && (...)}` at the bottom) with tone-aware rendering:

```tsx
      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold"
            style={{
              color:
                trend.tone === "negative"
                  ? "var(--nly-error)"
                  : trend.tone === "neutral"
                  ? "var(--nly-text-secondary)"
                  : "var(--nly-success)",
            }}
          >
            {trend.tone === "negative"
              ? "↓ "
              : trend.tone === "neutral"
              ? ""
              : "↑ "}
            {trend.value}
          </span>
          <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {trend.label ?? "vs last month"}
          </span>
        </div>
      )}
```

- [ ] **Step 3: Wrap the card in a Link when `href` is set**

The component currently `return`s a single `<motion.div ...>...</motion.div>`. Assign it to a const and conditionally wrap:

```tsx
  const card = (
    <motion.div
      ref={ref}
      /* ...all existing motion.div props and children unchanged... */
    >
      {/* ...existing children unchanged... */}
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nly-brand)]"
      >
        {card}
      </Link>
    );
  }
  return card;
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/SummaryCard.tsx
git commit -m "feat(dashboard): SummaryCard supports href + tone-aware trend"
```

---

### Task 3: Dashboard summary-card wiring — deltas, links, trial countdown

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `soonestTrialDaysLeft` (Task 1); `SummaryCard` `href`/`trend` (Task 2).
- Produces: dashboard passes `href` + weekly-delta `trend` to all four cards and an accurate trial countdown to `Header`.

- [ ] **Step 1: Import the trial helper**

At the top of `app/(dashboard)/dashboard/page.tsx`, update the trial-days import to include the new helper:

```tsx
import { trialDaysLeft as computeTrialDaysLeft, soonestTrialDaysLeft } from "@/lib/trial-days";
```

- [ ] **Step 2: Add the 7-day delta counts**

Immediately AFTER the existing `Promise.all` that destructures `eventCount, residentCount, pendingCount, alertCount` (the block using `{ count: "exact", head: true }`), add:

```tsx
  // Weekly momentum deltas (last 7 days). Communities delta is derived from
  // the already-fetched list (no extra query); residents/pending/alerts need
  // scoped count queries.
  const weekAgoIso = new Date(Date.now() - 7 * 864e5).toISOString();
  const newCommunitiesWk = communities.filter(
    (c) => c.created_at >= weekAgoIso,
  ).length;
  const [
    { count: newResidentsWk },
    { count: newPendingWk },
    { count: newAlertsWk },
  ] = await Promise.all([
    filterResidents(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("community_code", communityCodes)
        .gte("created_at", weekAgoIso),
    ),
    supabase
      .from("pending_users")
      .select("id", { count: "exact", head: true })
      .in("community_code", communityCodes)
      .eq("status", "pending")
      .gte("created_at", weekAgoIso),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .in("community_code", communityCodes)
      .gte("created_at", weekAgoIso),
  ]);
```

- [ ] **Step 3: Add local helpers for link target + delta near the `return`**

Just before the `return (` of the component, add:

```tsx
  const single = communities.length === 1;
  const firstId = firstCommunity.id;

  // Only render a delta when there's actually movement (no "+0").
  const posDelta = (n: number | null, label: string) =>
    n && n > 0 ? { value: `+${n}`, tone: "positive" as const, label } : undefined;
  const neutralDelta = (n: number | null, label: string) =>
    n && n > 0 ? { value: `+${n}`, tone: "neutral" as const, label } : undefined;

  const soonestTrial = soonestTrialDaysLeft(communities);
```

- [ ] **Step 4: Pass `soonestTrial` to the Header**

Change the `Header` `trialDaysLeft` prop from the first-community-only expression to:

```tsx
        trialDaysLeft={soonestTrial}
```

(Remove the old `firstCommunity.status === "trial" ? trialDaysLeft : null` value. The unused `trialDaysLeft` const near the top may now be unused — if `npm run lint` flags it, delete that const and its computation.)

- [ ] **Step 5: Wire `href` + `trend` onto the four SummaryCards**

Add these props to each existing `<SummaryCard>` (keep all current props):

Active Communities:
```tsx
              href="/dashboard/communities"
              trend={posDelta(newCommunitiesWk, "new this week")}
```

Total Units:
```tsx
              href="/dashboard/communities"
              trend={posDelta(newResidentsWk, "residents this week")}
```

Pending Approvals:
```tsx
              href={
                single
                  ? `/dashboard/communities/${firstId}/pending`
                  : (pendingCount ?? 0) > 0
                  ? "#pending-approvals"
                  : "/dashboard/communities"
              }
              trend={neutralDelta(newPendingWk, "new this week")}
```

Open Alerts:
```tsx
              href={
                single
                  ? `/dashboard/communities/${firstId}/alerts`
                  : "/dashboard/communities"
              }
              trend={neutralDelta(newAlertsWk, "this week")}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. (If lint flags the now-unused `trialDaysLeft` const, delete it.)

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): clickable stat cards, weekly deltas, multi-trial countdown"
```

---

### Task 4: Quick-actions row

**Files:**
- Create: `components/dashboard/QuickActions.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Produces: `QuickActions({ singleCommunityId }: { singleCommunityId: string | null })` — a server component rendering three deep-linked pill buttons.

- [ ] **Step 1: Create the component**

Create `components/dashboard/QuickActions.tsx`:

```tsx
import Link from "next/link";
import { CalendarPlus, Megaphone, UserPlus } from "lucide-react";

export function QuickActions({
  singleCommunityId,
}: {
  singleCommunityId: string | null;
}) {
  const base = singleCommunityId
    ? `/dashboard/communities/${singleCommunityId}`
    : null;

  const actions = [
    {
      label: "Create event",
      icon: CalendarPlus,
      href: base ? `${base}/events` : "/dashboard/events",
    },
    {
      label: "Send alert",
      icon: Megaphone,
      href: base ? `${base}/alerts` : "/dashboard/communities",
    },
    {
      label: "Invite residents",
      icon: UserPlus,
      href: base ? `${base}/residents` : "/dashboard/communities",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
          style={{
            backgroundColor: "var(--nly-surface)",
            border: "1px solid var(--nly-border)",
            color: "var(--nly-text-primary)",
            boxShadow: "var(--nly-shadow-sm)",
          }}
        >
          <a.icon size={16} style={{ color: "var(--nly-brand)" }} />
          {a.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the dashboard**

In `app/(dashboard)/dashboard/page.tsx`, add the import:

```tsx
import { QuickActions } from "@/components/dashboard/QuickActions";
```

Directly AFTER the summary-cards `</DashboardSection>` (the section wrapping `data-tour="summary-cards"`) and BEFORE the smart-nudges section, add:

```tsx
        {/* Quick actions */}
        <DashboardSection delay={0.05}>
          <QuickActions singleCommunityId={single ? firstId : null} />
        </DashboardSection>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/QuickActions.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): quick-actions row (create event / send alert / invite)"
```

---

### Task 5: Inline pending approvals panel

**Files:**
- Create: `components/dashboard/PendingApprovalsPanel.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `approveResident`/`denyResident` from `app/(dashboard)/dashboard/communities/[id]/pending/actions` (return `{ error } | { success }`).
- Produces: `PendingApprovalsPanel({ rows, communityMap, communityNameMap, showCommunity })`.

- [ ] **Step 1: Create the client component**

Create `components/dashboard/PendingApprovalsPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Check, X } from "lucide-react";
import {
  approveResident,
  denyResident,
} from "@/app/(dashboard)/dashboard/communities/[id]/pending/actions";

export interface PendingRow {
  id: string;
  full_name: string;
  email: string;
  unit_number: string | null;
  created_at: string;
  community_code: string;
}

interface Props {
  rows: PendingRow[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  showCommunity: boolean;
}

export function PendingApprovalsPanel({
  rows: initialRows,
  communityMap,
  communityNameMap,
  showCommunity,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<Record<string, "approve" | "deny">>({});
  const router = useRouter();

  async function act(row: PendingRow, kind: "approve" | "deny") {
    const communityId = communityMap[row.community_code];
    if (!communityId) {
      toast.error("Couldn't resolve this resident's community.");
      return;
    }
    setBusy((b) => ({ ...b, [row.id]: kind }));
    try {
      const res =
        kind === "approve"
          ? await approveResident(row.id, communityId)
          : await denyResident(row.id, communityId);
      if ("error" in res && res.error) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success(
        kind === "approve"
          ? `${row.full_name} approved`
          : `${row.full_name} denied`,
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[row.id];
        return next;
      });
    }
  }

  return (
    <div
      id="pending-approvals"
      className="rounded-2xl border scroll-mt-24"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--nly-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          Pending approvals
        </h3>
        <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          {rows.length} awaiting review
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            All caught up — no residents waiting for review.
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
          {rows.map((row) => {
            const state = busy[row.id];
            return (
              <div
                key={row.id}
                className="px-5 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    {row.full_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--nly-text-tertiary)" }}>
                    {showCommunity && (
                      <span className="mr-1.5">
                        {communityNameMap[row.community_code]} &middot;
                      </span>
                    )}
                    {row.unit_number ? `Unit ${row.unit_number} · ` : ""}
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => act(row, "approve")}
                  disabled={!!state}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
                >
                  <Check size={13} />
                  {state === "approve" ? "..." : "Approve"}
                </button>
                <button
                  onClick={() => act(row, "deny")}
                  disabled={!!state}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: "var(--nly-border)", color: "var(--nly-text-secondary)" }}
                >
                  <X size={13} />
                  {state === "deny" ? "..." : "Deny"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

Note: `--nly-brand-text` is the established readable-on-brand foreground token (used elsewhere for white-on-brand). If `npm run lint`/build has no token issues it is fine; it is a CSS var so it will not error at compile time.

- [ ] **Step 2: Fetch pending rows server-side + render the panel**

In `app/(dashboard)/dashboard/page.tsx`, add the import:

```tsx
import { PendingApprovalsPanel, type PendingRow } from "@/components/dashboard/PendingApprovalsPanel";
```

Add the fetch AFTER `pendingCount` is known (after the delta block from Task 3 is fine), guarded so it only runs when there's something to show:

```tsx
  let pendingRows: PendingRow[] = [];
  if ((pendingCount ?? 0) > 0) {
    const { data: pendingRaw } = await supabase
      .from("pending_users")
      .select("id, full_name, email, unit_number, created_at, community_code")
      .in("community_code", communityCodes)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);
    pendingRows = (pendingRaw as PendingRow[] | null) ?? [];
  }
```

Render the panel in its own section, placed AFTER the smart-nudges section and BEFORE the "Communities list + Activity feed" `DashboardSection`:

```tsx
        {/* Pending approvals (inline) */}
        {pendingRows.length > 0 && (
          <DashboardSection delay={0.15}>
            <PendingApprovalsPanel
              rows={pendingRows}
              communityMap={communityMap}
              communityNameMap={communityNameMap}
              showCommunity={communities.length > 1}
            />
          </DashboardSection>
        )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/PendingApprovalsPanel.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): inline pending-approvals panel with approve/deny"
```

---

### Task 6: Realtime activity feed

**Files:**
- Modify: `components/dashboard/ActivityFeed.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: browser Supabase client from `@/lib/supabase/client` (`createClient`).
- Produces: `ActivityFeed` accepts an optional `communityCodes?: string[]`; when present it subscribes to realtime inserts and debounces `router.refresh()`.

- [ ] **Step 1: Verify the browser client export name**

Run: `grep -n "export" lib/supabase/client.ts`
Expected: a `createClient` (or `createBrowserClient`) export. Use whichever name it exports in Step 2 (the plan assumes `createClient`; adjust the import if it differs).

- [ ] **Step 2: Add the realtime subscription to ActivityFeed**

In `components/dashboard/ActivityFeed.tsx`, add imports (top of file, it is already `"use client"`):

```tsx
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
```

Extend the props interface:

```tsx
interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  communityCodes?: string[];
}
```

Update the signature:

```tsx
export function ActivityFeed({ items, loading, communityCodes }: ActivityFeedProps) {
```

Add this effect as the FIRST statement inside the component body (before the `return`). It subscribes to inserts on the activity source tables and debounces a router refresh — no state setter is called in the effect, satisfying the react-hooks lint rule:

```tsx
  const router = useRouter();
  const codesKey = (communityCodes ?? []).join(",");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!codesKey) return;
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 800);
    };
    const channel = supabase.channel("dashboard-activity");
    for (const table of [
      "profiles",
      "events",
      "alerts",
      "help_requests",
      "facility_reservations",
    ]) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [codesKey, router]);
```

Note: `codesKey` (a string) is the effect dependency rather than the `communityCodes` array, so a new array identity each render does not re-subscribe. The subscription is intentionally broad (no per-code filter); the server re-scopes to the PM's communities on refresh.

- [ ] **Step 3: Pass `communityCodes` from the dashboard**

In `app/(dashboard)/dashboard/page.tsx`, update the `ActivityFeed` render:

```tsx
              <ActivityFeed items={recentActivity} communityCodes={communityCodes} />
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. In particular, confirm no `react-hooks/set-state-in-effect` error (the effect only schedules `router.refresh()`).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ActivityFeed.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): live activity feed via Supabase realtime + debounced refresh"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck, lint, unit tests**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run test:unit
```
Expected: all clean; unit tests green (including the new `trial-days.test.ts`).

- [ ] **Step 2: Manual smoke on the authed dev server**

Run: `npm run dev`, log in as a PM, open `/dashboard`. Verify:
- Each summary card navigates (Active Communities/Total Units → communities; Pending/Alerts → the community sub-page for a single-community PM, or the anchor/communities list for a multi-community PM).
- Weekly deltas render only when a matching row was created in the last 7 days; no "+0".
- Quick-actions buttons route correctly for a single-community vs multi-community PM.
- With a pending resident present, the inline panel shows; Approve and Deny mutate, toast, remove the row, and the "Pending Approvals" count updates.
- Inserting a row into a source table (e.g. a new pending user or alert) refreshes the activity feed within ~1s without a manual refresh.
- A PM with two trials on different clocks sees the soonest countdown in the header.

- [ ] **Step 3: Use the `verify` skill (optional but recommended)**

Drive the pending-approval flow end-to-end with the project `verify` skill to confirm the mutation + refresh behavior against a real session.

---

## Self-Review Notes

- **Spec coverage:** #1 actionable cards → Task 3 (href) + Task 2 (prop). #2 inline approvals → Task 5. #3 quick actions → Task 4. #4 deltas → Task 2 (trend) + Task 3 (queries). #5 realtime feed → Task 6. #6 multi-trial countdown → Task 1 + Task 3 Step 4. All six covered.
- **Type consistency:** `soonestTrialDaysLeft` signature identical in Task 1 and Task 3. `trend` shape identical in Task 2 and Task 3. `PendingRow` defined in Task 5 component and imported (not re-declared) in the page. `approveResident`/`denyResident` return `{ error } | { success }` — checked via `"error" in res && res.error`, matching the actual actions.
- **Ordering:** helper (1) → card component (2) → card wiring (3) → quick actions (4) → approvals (5) → realtime (6) → verify (7). Each task is independently typecheck/lint-clean and committable.
