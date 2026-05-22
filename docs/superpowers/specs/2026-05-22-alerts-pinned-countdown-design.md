# Alerts: PM edit/delete + pinned countdown — Design

**Date:** 2026-05-22
**Status:** Approved (pending spec review)
**Scope:** `neighborlyy-admin-portal` (Miyora admin portal) only. No mobile-repo changes.

## Goal

Let property managers (PMs) edit and delete community alerts from the portal, and
make a pinned alert's timer behave the way mobile already does: pin it for a
chosen duration, show a live countdown, and have it disappear for residents when
the time is up. The portal retains expired alerts as history.

## Current state

- **Table `alerts`** (shared with mobile): `id, community_code, title, message,
  priority ('urgent'|'high'|'medium'|'low'), valid_until (timestamptz, null),
  is_active (bool), is_pinned (bool), pin_expires_at (timestamptz, null),
  created_by (FK profiles.id, null for PMs), created_at`.
- **DB write access:** migration `033_alerts_pm_write_rls.sql` already grants PMs
  `INSERT/UPDATE/DELETE` scoped to managed communities. No new migration needed.
- **Portal create** (`components/community/CreateAlertDialog.tsx` +
  `app/(dashboard)/dashboard/communities/[id]/alerts/actions.ts`): sets `title,
  message, priority, is_active=true, is_pinned (checkbox), valid_until` — but
  **never sets `pin_expires_at`**, so the "pin for a duration" concept doesn't
  exist in the portal.
- **Portal list** (`alerts/page.tsx`): lists every alert ever sent, ordered by
  `created_at`, ignoring `valid_until`/`is_pinned`/`pin_expires_at`. No countdown,
  no edit/delete, no expiry handling.
- **⚠️ Timezone bug:** the "Expires" `datetime-local` value (e.g.
  `2026-05-22T19:00`, no offset) is written straight to a `timestamptz` column,
  which Postgres interprets as **UTC** — so a PM in EDT picking 7pm actually
  expires it at 3pm EDT (4h early). `EventFormDialog` avoids this by converting to
  ISO first; `createAlert` does not.

### Mobile reference (the behavior we mirror)

- Mobile pins by **duration** (`'3h','6h','12h','1d','2d','3d','1w'`):
  `is_pinned = !!pinDuration`, `pin_expires_at = now + duration`
  (`src/services/alert.service.ts`).
- Residents only see active alerts: `useNotificationStore.ts` queries
  `.or('valid_until.is.null,valid_until.gte.now')`. **Expiry for residents is
  already enforced** by this query filter — keyed on `valid_until`, not
  `is_active`. No cron, no mobile change needed.
- Mobile auto-unpins lazily on read (`getActiveAlerts` flips `is_pinned=false`
  where `pin_expires_at < now`, and treats pin-expired as unpinned client-side).
- Mobile's own guidance (memory: surveys) is that the pin timer and the expiry
  timer **should be set from the same duration**, or residents "see mismatched
  countdown text."

## Key decisions

1. **Tie the pin timer and the expiry to one duration.** A single "Show pinned
   for" control. Picking a duration sets `is_pinned=true` and
   `pin_expires_at = valid_until = now + duration`. When it passes, the alert
   un-pins **and** stops showing to residents. `Off` = standing alert
   (`is_pinned=false`, `pin_expires_at=null`, `valid_until=null`, stays until
   deleted). Rationale: matches the PM mental model ("pin for 3h, then it's
   gone"), avoids two confusing time fields, and enforces the
   same-duration rule mobile already depends on. The DB still receives both
   `pin_expires_at` and `valid_until`, so mobile stays fully compatible.
   - Accepted trade-off: no "pinned forever" and no "expires-but-never-pinned".
     Both are rare; can add a custom option later.
2. **Portal keeps expired alerts as history**, visually de-emphasized under a
   "Past alerts" divider (greyed, no countdown). Residents already stop seeing
   them via `valid_until`.
3. **No new migration, no cron.** Expiry is query-time on mobile (already works);
   the portal computes effective pinned/expired state at render time from
   `pin_expires_at` / `valid_until`. We do not write `is_pinned=false` lazily —
   residents key off `valid_until`, and the portal derives the effective state, so
   the stored flag going stale is harmless.
4. **Fix the timezone bug by construction.** Durations are computed as
   `new Date(Date.now() + ms).toISOString()` (correct UTC). The raw
   `datetime-local` "Expires" field is removed.

## Data flow

```
PM picks "Show pinned for: 3h"
  → durationToTimestamps('3h') = { is_pinned: true,
                                   pin_expires_at: now+3h ISO,
                                   valid_until:    now+3h ISO }
  → createAlert / updateAlert writes those columns
Residents (mobile, unchanged): query filters valid_until > now  → alert visible 3h
Portal list (client): computes effective state from pin_expires_at / valid_until,
  ticks a live countdown, moves the alert Pinned → Past when the time passes.
```

## Components

### New: `lib/alerts.ts` (shared helpers — single source of truth)
- `ALERT_DURATIONS`: ordered list `[{ value:'3h', label:'3 hours', ms }, …,
  { value:'1w', label:'1 week', ms }]`. (`Off` handled separately.)
- `durationToTimestamps(value: string | "off"): { is_pinned, pin_expires_at,
  valid_until }` — `off` → all unset; a duration → all set to `now+ms` ISO.
- `getAlertState(alert, now): { isPinned, isExpired, msLeft }` — effective state
  derived from `pin_expires_at`/`valid_until` vs `now` (does NOT trust stored
  `is_pinned` once `pin_expires_at` has passed).
- `formatCountdown(ms): string` — e.g. `"2h 45m left"`, `"12m left"`, `"<1m"`.
- `PRIORITIES` (moved here so create + edit share one list).

### New: `components/community/AlertFormFields.tsx` (shared form body)
Renders Title, Message, Priority (form-variant `Select`), and the
**"Show pinned for"** duration `Select` (`Off · 3h · 6h · 12h · 1d · 2d · 3d ·
1w`). Used by both create and edit dialogs so the duration logic lives in one
place. Uses the established form conventions (form-variant selects,
`--nly-input-*` tokens). Edit mode adds a leading **"Keep current"** option that
leaves the existing timestamps untouched.

### Modified: `components/community/CreateAlertDialog.tsx`
- Replace the `is_pinned` checkbox + `datetime-local` "Expires" with
  `<AlertFormFields>` (create mode).
- On submit, resolve the duration to timestamps client-side and pass to
  `createAlert`. Keep the existing try/catch + toast conventions.

### New: `components/community/AlertRowActions.tsx` (mirrors `EventCardActions`)
- Pencil (opens an edit dialog reusing `<AlertFormFields>` in edit mode) and
  Trash (delete with `confirm()`).
- try/catch + toast + loading state per project form conventions.

### New: `components/community/AlertsList.tsx` (client)
- Receives the full alert rows from the server page.
- Derives per-alert state via `getAlertState` against a `now` that updates on a
  `setInterval` (30s tick is enough for minute-resolution countdowns; pinned rows
  showing `<1h` may tick every 1s — implementation detail).
- Renders three groups: **Pinned** (top, with `📌 Pinned · {countdown}`),
  **Active** (no pin, not expired), **Past alerts** (expired; greyed, no
  countdown, divider label). Sort: pinned by `pin_expires_at` asc, then priority;
  active by `created_at` desc; past by `valid_until` desc.
- Each row renders `<AlertRowActions>`.

### Modified: `app/(dashboard)/dashboard/communities/[id]/alerts/page.tsx`
- Select all needed columns (`id, title, message, priority, is_pinned,
  pin_expires_at, valid_until, created_at`).
- Render `<AlertsList alerts={…} communityId={id} communityCode={…} />` instead
  of the inline list. Keep the header + `CreateAlertDialog`.

### Modified: `alerts/actions.ts`
- `createAlert`: accept resolved `is_pinned`, `pin_expires_at`, `valid_until`
  (timestamps computed client-side); keep `is_active: true`, `created_by` null.
- `updateAlert(alertId, fields, communityId)`: update `title, message, priority`
  and, when the duration field is not "Keep current", `is_pinned,
  pin_expires_at, valid_until`. `revalidatePath` the alerts route.
- `deleteAlert(alertId, communityId)`: delete + `revalidatePath`.
- All return `{ error }` / `{ success }` (existing shape); auth-guard like the
  current `createAlert`.

## Error handling
- Server actions follow project form conventions: return `{ error }` on failure,
  callers wrap in try/catch + friendly toast, reset loading in `finally`, never
  surface raw `error.message`.
- Validation: title, message, priority required (existing). Duration optional
  (defaults to `Off`).
- `getAlertState` guards null timestamps.

## Out of scope
- Mobile-repo changes (resident expiry already works).
- Standalone pin/unpin quick-toggle (handled via Edit).
- "Pinned forever" / "expires without pin" combinations.
- A new DB migration or cron (033 already covers RLS; expiry is query/render-time).

## Verification
- Typecheck + lint clean.
- Manual (dev server, logged-in PM):
  1. Create an alert pinned for the shortest testable duration → appears in
     **Pinned** with a ticking countdown.
  2. Wait for it to pass → moves to **Past alerts**, countdown gone.
  3. Edit an alert (change title + reschedule duration) → reflects immediately.
  4. Delete an alert → row removed, toast shown.
  5. Confirm `valid_until`/`pin_expires_at` stored as correct UTC (no tz skew).
- Cross-check: a pinned-for-duration alert is excluded from the mobile resident
  query once `valid_until` passes (query-filter already in place).
