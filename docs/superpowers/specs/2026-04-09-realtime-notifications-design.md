# Realtime Notifications Design

## Problem

Notifications in the admin portal are only fetched on-demand (bell click or page load). Property managers have no way to know a new notification arrived without manually refreshing or clicking the bell.

## Solution

Use Supabase Realtime `postgres_changes` to subscribe to INSERTs on the `admin_notifications` table. When a new row appears, instantly update the unread badge count and show a toast.

## Approach

Supabase Realtime channel subscription from the browser client. No polling, no SSE, no new infrastructure.

## New Hook: `useRealtimeNotifications`

**File:** `hooks/useRealtimeNotifications.ts`

```ts
useRealtimeNotifications({
  communityCodes: string[],
  initialCount: number,
  onNewNotification?: (notification: AdminNotification) => void,
}) → { unreadCount: number }
```

**Behavior:**
- Creates a Supabase browser client via existing `createClient()`
- Subscribes to `postgres_changes` (event: `INSERT`) on `admin_notifications`
- One channel per community code (Supabase Realtime filters support `eq` not `in`; PMs typically manage 1-3 communities)
- On INSERT: increments `unreadCount` state, shows a sonner toast with the notification title, calls `onNewNotification` callback
- On unmount: removes all channels

## Integration Points

### Header (`components/dashboard/Header.tsx`)
- Import and call `useRealtimeNotifications` with `communityCodes` and the server-fetched `notificationCount` as `initialCount`
- Pass the live `unreadCount` to `NotificationDropdown` instead of the static prop
- Pass an `onNewNotification` callback to allow the dropdown to receive new notifications

### NotificationDropdown (`components/dashboard/NotificationDropdown.tsx`)
- Accept a `realtimeNotification` prop or callback
- When a new notification arrives while the dropdown is open, prepend it to the list

### Toast Format
- Uses existing `sonner` toast
- Message: notification title (e.g., "New join request from John Doe")
- Duration: default sonner duration

## Channel Filter

Each community code gets its own channel subscription:

```
supabase.channel(`notif-${communityCode}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'admin_notifications',
    filter: `community_code=eq.${communityCode}`
  }, handleInsert)
  .subscribe()
```

## Files Changed

| File | Change |
|------|--------|
| `hooks/useRealtimeNotifications.ts` | New hook |
| `components/dashboard/Header.tsx` | Use hook for live unread count |
| `components/dashboard/NotificationDropdown.tsx` | Display realtime notifications in dropdown |

## No Database Changes

The `admin_notifications` table, triggers, and RLS policies already exist. Supabase Realtime respects RLS by default for authenticated clients.

## Out of Scope

- Push notifications (browser or mobile)
- Sound effects
- Notification preferences/settings
- Realtime on the full notifications page (uses manual refresh)
