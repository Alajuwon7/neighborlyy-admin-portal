# Dashboard Enhancements — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)
**Surface:** `app/(dashboard)/dashboard/page.tsx` and supporting components

## Goal

Turn the Miyora admin dashboard from a static status board into an actionable
control surface. Six enhancements ship together as one plan. No database
migrations — everything reuses existing tables, RPCs, and the established
realtime pattern.

## Context

The dashboard already renders:

- A `Header` (greeting, trial countdown, notification bell).
- Four `SummaryCard`s: Active Communities, Total Units (with occupancy bar),
  Pending Approvals, Open Alerts.
- `NudgeCards` (smart nudges).
- A side-by-side grid: "Your Communities" list + `ActivityFeed` ("Recent
  Activity", with a "Live" pulse).
- A getting-started checklist / onboarding modal for new users.

Key existing pieces we reuse:

- `SummaryCard` already has an **unused** `trend?: { value: string; positive:
  boolean }` prop rendered at the bottom of the card (hardcoded "vs last
  month" label). We generalize it rather than adding a new prop.
- `approveResident(pendingUserId, communityId)` and `denyResident(
  pendingUserId, communityId, reason?)` in
  `app/(dashboard)/dashboard/communities/[id]/pending/actions.ts` — reusable
  for inline approval. Both call the `approve_pending_user` RPC / deny path.
- `pending_users` columns: `id, full_name, email, unit_number, created_at,
  community_code, status`.
- `NotificationDropdown.tsx` establishes the Supabase realtime subscription
  pattern (browser client from `lib/supabase/client.ts`).
- Routing reality: event/alert creation and approvals are **per-community**
  routes (`/dashboard/communities/[id]/{events,alerts,pending,residents}`).
  There are aggregate landings at `/dashboard/events` and
  `/dashboard/communities`.

## Design

### 1. Actionable summary cards

`SummaryCard.tsx`: add an optional `href?: string`. When present, the card's
inner content is wrapped in a `next/link` `<Link>` so the whole card is
clickable; the existing motion/hover animation is preserved (wrap inside the
`motion.div`, not around it, so layout/animation is unchanged).

Wiring in `dashboard/page.tsx` (let `single = communities.length === 1`,
`firstId = firstCommunity.id`):

| Card | href |
|------|------|
| Active Communities | `/dashboard/communities` |
| Total Units | `/dashboard/communities` |
| Pending Approvals | `single ? /dashboard/communities/${firstId}/pending` : (`pendingCount > 0 ? #pending-approvals : /dashboard/communities`) |
| Open Alerts | `single ? /dashboard/communities/${firstId}/alerts : /dashboard/communities` |

The `#pending-approvals` anchor only exists when the inline panel renders
(pending > 0), so the multi-community fallback guards on `pendingCount`.

### 2. "This week" deltas

Generalize the existing `trend` prop:

```ts
trend?: { value: string; tone?: "positive" | "neutral" | "negative"; label?: string }
```

- `tone` drives color: positive → success/green with ↑, negative →
  error/red with ↓, neutral → tertiary text, no arrow. Default `positive`
  for backward compatibility.
- `label` replaces the hardcoded "vs last month". Default keeps "vs last
  month".

Back-compat: `trend` is currently unused by the dashboard. Implementation
first greps for any other `SummaryCard ... trend` caller. If none exist
(expected), the `positive: boolean` field is cleanly replaced by `tone`. If a
caller does exist, keep `positive` as a deprecated optional that maps to
`tone` so nothing breaks.

Four new count queries (`created_at >= now − 7 days`, `head: true`) folded
into the existing `Promise.all` block:

| Card | delta source | display | tone |
|------|-------------|---------|------|
| Active Communities | communities created in last 7d | "+N new this week" | positive (hidden if 0) |
| Total Units | residents joined last 7d (`filterResidents`) | "+N residents this week" | positive (hidden if 0) |
| Pending Approvals | pending_users created last 7d (status pending) | "+N new this week" | neutral |
| Open Alerts | alerts created last 7d | "+N this week" | neutral |

A delta of 0 renders nothing for the positive-tone cards (no "+0"). Neutral
cards may show "0 this week" or hide — hide when 0 for consistency.

The 7-day window is computed once server-side: `new Date(Date.now() - 7 *
864e5).toISOString()`.

### 3. Quick-actions row

New component `components/dashboard/QuickActions.tsx` — a horizontal row of
pill buttons rendered just below the summary cards' `DashboardSection` (its
own `DashboardSection`). Three actions, each a `<Link>`:

| Action | single community | multiple |
|--------|-----------------|----------|
| Create event | `/dashboard/communities/${firstId}/events` | `/dashboard/events` |
| Send alert | `/dashboard/communities/${firstId}/alerts` | `/dashboard/communities` |
| Invite residents | `/dashboard/communities/${firstId}/residents` | `/dashboard/communities` |

Props: `{ singleCommunityId: string | null }`. Styling: pill buttons with
lucide icons (CalendarPlus, Megaphone, UserPlus), brand accent border,
consistent with the design system tokens. Server component (no state).

### 4. Inline pending approvals

**Server** (`dashboard/page.tsx`): when `pendingCount > 0`, fetch the top 5
oldest pending residents across all communities:

```
pending_users
  .select("id, full_name, email, unit_number, created_at, community_code")
  .in("community_code", communityCodes)
  .eq("status", "pending")
  .order("created_at", { ascending: true })
  .limit(5)
```

Pass the rows plus `communityMap` (code → id) and `communityNameMap` to a new
client component.

**Client** (`components/dashboard/PendingApprovalsPanel.tsx`): a card with
`id="pending-approvals"` rendered in its own `DashboardSection` between the
summary cards and the communities/activity grid. Each row shows: resident
name, community name (when multi-community), unit number, and relative age
("2h ago"), with **Approve** and **Deny** buttons.

- Approve → `approveResident(row.id, communityMap[row.community_code])`.
- Deny → `denyResident(row.id, communityMap[row.community_code])` (no reason
  inline; reason is optional in the action).
- Local `useState` seeds from props; on success the row is removed
  optimistically, a `toast.success` fires, and `router.refresh()` re-pulls
  server counts/feed. Per-row `pending` state disables both buttons and shows
  a spinner/label during the mutation. On error: toast the friendly message,
  keep the row.
- When the list empties, the panel shows an "All caught up" state (it is not
  unmounted mid-session because the parent only conditionally renders it on
  the next server load).

### 5. Real live activity feed

`ActivityFeed.tsx` gains an optional `communityCodes?: string[]`. When
provided, a `useEffect`:

1. Creates a browser Supabase client (`lib/supabase/client.ts`).
2. Opens one realtime channel subscribing to `INSERT` on the activity source
   tables (profiles, events, alerts, help_requests, facility_reservations).
   No per-code server filter — subscribe broadly; the server re-scopes on
   refresh.
3. On any event, calls a **debounced** `router.refresh()` (~800ms) to re-pull
   the server-rebuilt `items`.
4. Cleans up: `supabase.removeChannel(channel)` and clears the debounce timer
   on unmount.

No `setState` inside the effect (keeps react-hooks v6 lint happy — only a
subscription + `router.refresh()`). The "Live" pulse stays. If
`communityCodes` is absent the feed behaves exactly as today.

### 6. Multi-community (lightweight)

In `dashboard/page.tsx`, replace the header's first-community-only trial
countdown with the **minimum days-left among communities still on trial**
(the soonest to expire):

```ts
const trialCommunities = communities.filter(c => c.status === "trial" && c.trial_ends_at);
const soonestTrialDaysLeft = trialCommunities.length
  ? Math.min(...trialCommunities.map(c => Math.max(0, computeTrialDaysLeft(c.trial_ends_at!))))
  : null;
```

Pass `soonestTrialDaysLeft` to `Header` (replacing the current
`firstCommunity.status === "trial" ? trialDaysLeft : null`). Activity and
nudges are already scoped by `communityCodes`; no global switcher this pass.

## Components touched / added

**Modified**
- `components/dashboard/SummaryCard.tsx` — `href`, generalized `trend`.
- `app/(dashboard)/dashboard/page.tsx` — delta queries, pending fetch, trial
  math, card wiring, render `QuickActions` + `PendingApprovalsPanel`, pass
  `communityCodes` to `ActivityFeed`.
- `components/dashboard/ActivityFeed.tsx` — realtime subscription.

**Added**
- `components/dashboard/QuickActions.tsx`
- `components/dashboard/PendingApprovalsPanel.tsx`

## Error handling

- Approve/Deny: wrap the server-action call in try/catch/finally, surface a
  friendly `toast` (never raw `error.message`), reset per-row `pending` in
  `finally`. Follows the project's form-conventions.
- Realtime: subscription failure is non-fatal — the manual RefreshButton and
  server render remain the source of truth; the effect swallows channel
  errors.
- Delta queries: on null/error counts, treat as 0 (delta hidden).

## Testing / verification

- `npx tsc --noEmit` and `npm run lint` clean.
- Manual: run the authed dev server; verify (a) each card navigates, (b)
  deltas render with a seeded recent row, (c) quick actions route correctly
  for single vs multi community, (d) approve/deny mutates and the panel + card
  count update, (e) a new insert in a source table refreshes the feed without
  a manual refresh, (f) a multi-trial PM sees the soonest countdown.

## Out of scope

- Sparklines / charted trends (deltas only this pass).
- A global community switcher that re-scopes every card.
- Any schema/RPC changes.
