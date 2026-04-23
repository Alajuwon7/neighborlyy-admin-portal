# Realtime Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Realtime subscriptions so the notification badge updates instantly and a toast appears when new notifications arrive.

**Architecture:** A `useRealtimeNotifications` hook subscribes to `postgres_changes` INSERT events on the `admin_notifications` table, one channel per community code. The hook manages a live unread count and exposes new notifications via callback. The Header component uses the hook and passes live data to the NotificationDropdown.

**Tech Stack:** Supabase Realtime (via `@supabase/ssr` browser client), React hooks, sonner toasts

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/useRealtimeNotifications.ts` | Create | Supabase Realtime subscription hook |
| `components/dashboard/Header.tsx` | Modify | Use hook, pass live unread count + new notifications to dropdown |
| `components/dashboard/NotificationDropdown.tsx` | Modify | Accept + display realtime notifications when dropdown is open |

---

### Task 1: Create `useRealtimeNotifications` hook

**Files:**
- Create: `hooks/useRealtimeNotifications.ts`

- [ ] **Step 1: Create the hook file**

```ts
// hooks/useRealtimeNotifications.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminNotification } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notifications";
import { toast } from "sonner";

interface UseRealtimeNotificationsOptions {
  communityCodes: string[];
  initialCount: number;
  onNewNotification?: (notification: AdminNotification) => void;
}

export function useRealtimeNotifications({
  communityCodes,
  initialCount,
  onNewNotification,
}: UseRealtimeNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const supabaseRef = useRef(createClient());
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    setUnreadCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (communityCodes.length === 0) return;

    const supabase = supabaseRef.current;
    const channels = communityCodes.map((code) =>
      supabase
        .channel(`notif-${code}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "admin_notifications",
            filter: `community_code=eq.${code}`,
          },
          (payload) => {
            const notification = payload.new as AdminNotification;
            setUnreadCount((prev) => prev + 1);

            const meta = NOTIFICATION_META[notification.type];
            toast(notification.title, {
              description: meta?.label,
              duration: 5000,
            });

            callbackRef.current?.(notification);
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [communityCodes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const decrementCount = useCallback((amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, decrementCount, resetCount };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `useRealtimeNotifications`

- [ ] **Step 3: Commit**

```bash
git add hooks/useRealtimeNotifications.ts
git commit -m "feat: add useRealtimeNotifications hook for live badge + toast"
```

---

### Task 2: Integrate hook into Header component

**Files:**
- Modify: `components/dashboard/Header.tsx`

- [ ] **Step 1: Add hook import and usage to Header**

At the top of `components/dashboard/Header.tsx`, add the import:

```ts
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useState, useCallback } from "react";
import type { AdminNotification } from "@/lib/notifications";
```

Inside the `Header` component function, before the return statement, add:

```ts
const [latestNotification, setLatestNotification] = useState<AdminNotification | null>(null);

const handleNewNotification = useCallback((notification: AdminNotification) => {
  setLatestNotification(notification);
}, []);

const { unreadCount, decrementCount, resetCount } = useRealtimeNotifications({
  communityCodes,
  initialCount: notificationCount,
  onNewNotification: handleNewNotification,
});
```

- [ ] **Step 2: Update NotificationDropdown props in Header's return**

Replace the existing `<NotificationDropdown>` usage (around line 117-122):

From:
```tsx
<NotificationDropdown
  communityCodes={communityCodes}
  communityMap={communityMap}
  communityNameMap={communityNameMap}
  unreadCount={notificationCount}
/>
```

To:
```tsx
<NotificationDropdown
  communityCodes={communityCodes}
  communityMap={communityMap}
  communityNameMap={communityNameMap}
  unreadCount={unreadCount}
  latestNotification={latestNotification}
  onNotificationRead={decrementCount}
  onAllRead={resetCount}
/>
```

- [ ] **Step 3: Remove unused `Bell` import**

The `Bell` import on line 3 is only used in the fallback button (line 130). Keep it since it's still used there.

- [ ] **Step 4: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors about missing props on NotificationDropdown (expected — we'll fix in Task 3)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Header.tsx
git commit -m "feat: wire useRealtimeNotifications into Header"
```

---

### Task 3: Update NotificationDropdown to accept realtime notifications

**Files:**
- Modify: `components/dashboard/NotificationDropdown.tsx`

- [ ] **Step 1: Update the props interface**

In `components/dashboard/NotificationDropdown.tsx`, update the interface (around line 17-22):

From:
```ts
interface NotificationDropdownProps {
  communityCodes: string[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  unreadCount: number;
}
```

To:
```ts
interface NotificationDropdownProps {
  communityCodes: string[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  unreadCount: number;
  latestNotification?: AdminNotification | null;
  onNotificationRead?: (amount?: number) => void;
  onAllRead?: () => void;
}
```

- [ ] **Step 2: Destructure new props**

Update the destructuring (around line 24-29):

From:
```ts
export function NotificationDropdown({
  communityCodes,
  communityMap,
  communityNameMap,
  unreadCount,
}: NotificationDropdownProps) {
```

To:
```ts
export function NotificationDropdown({
  communityCodes,
  communityMap,
  communityNameMap,
  unreadCount,
  latestNotification,
  onNotificationRead,
  onAllRead,
}: NotificationDropdownProps) {
```

- [ ] **Step 3: Add effect to prepend realtime notifications**

After the existing `useEffect` for click-outside (after line 45), add:

```ts
useEffect(() => {
  if (latestNotification && open) {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === latestNotification.id)) return prev;
      return [latestNotification, ...prev].slice(0, 8);
    });
  }
}, [latestNotification, open]);
```

- [ ] **Step 4: Wire up onNotificationRead in handleClickNotification**

In the `handleClickNotification` function (around line 57-68), add the callback after marking as read:

From:
```ts
async function handleClickNotification(notification: AdminNotification) {
  if (!notification.is_read) {
    await markNotificationRead(notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
    );
  }
```

To:
```ts
async function handleClickNotification(notification: AdminNotification) {
  if (!notification.is_read) {
    await markNotificationRead(notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
    );
    onNotificationRead?.();
  }
```

- [ ] **Step 5: Wire up onAllRead in handleMarkAllRead**

In the `handleMarkAllRead` function (around line 70-74), add the callback:

From:
```ts
async function handleMarkAllRead() {
  await markAllNotificationsRead(communityCodes);
  setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  toast.success("All notifications marked as read");
}
```

To:
```ts
async function handleMarkAllRead() {
  await markAllNotificationsRead(communityCodes);
  setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  onAllRead?.();
  toast.success("All notifications marked as read");
}
```

- [ ] **Step 6: Verify the full build passes**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/NotificationDropdown.tsx
git commit -m "feat: NotificationDropdown accepts realtime notifications"
```

---

### Task 4: Enable Supabase Realtime on admin_notifications table

**Files:**
- Create: `supabase/migrations/012_enable_realtime.sql`

- [ ] **Step 1: Create the migration file**

Supabase Realtime requires the table to be added to the `supabase_realtime` publication. Create the migration:

```sql
-- =====================================================
-- Migration 012: Enable Realtime on admin_notifications
-- =====================================================
-- Adds admin_notifications to the supabase_realtime
-- publication so clients can subscribe to changes.
-- Run in Supabase SQL Editor
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Copy the SQL above and run it in the Supabase SQL Editor at your project dashboard. This enables Realtime for the `admin_notifications` table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_enable_realtime.sql
git commit -m "feat: enable Supabase Realtime on admin_notifications"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Run the full build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 2: Start the dev server and test manually**

Run: `npm run dev`

1. Open the admin portal in two browser tabs
2. In Tab 1, log in as a property manager
3. In Tab 2 (or via Supabase SQL Editor), insert a test notification:

```sql
INSERT INTO admin_notifications (community_code, type, title, body, actor_name)
VALUES ('YOUR_COMMUNITY_CODE', 'pending_resident', 'Test: New join request from Jane Doe', 'Jane Doe wants to join', 'Jane Doe');
```

4. Verify in Tab 1:
   - The bell badge count increments
   - A sonner toast appears with "Test: New join request from Jane Doe"
   - If the dropdown is open, the notification appears at the top

- [ ] **Step 3: Final commit with all changes**

```bash
git add -A
git commit -m "feat: realtime notifications via Supabase Realtime"
```
