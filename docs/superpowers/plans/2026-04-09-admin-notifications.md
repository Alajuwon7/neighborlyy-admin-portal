# Admin Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PostgreSQL trigger-based notification system that alerts property managers when residents take actions needing attention (join requests, RSVPs, reservations, help requests), with a bell dropdown and full notifications page in the admin portal.

**Architecture:** Database triggers on existing mobile app tables automatically insert rows into a new `admin_notifications` table. The admin portal reads from this table to power a bell icon dropdown (quick glance, last 8) and a dedicated `/dashboard/notifications` page (full timeline with filters). No mobile app changes required.

**Tech Stack:** PostgreSQL triggers, Supabase RLS, Next.js 16 App Router (server components + server actions), Lucide icons, motion/react, sonner, date-fns

**Spec:** `docs/superpowers/specs/2026-04-09-admin-notifications-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/011_admin_notifications.sql` | Table, indexes, RLS, GRANTs, trigger function, triggers |
| `lib/notifications.ts` | Shared types, constants (icon/color map, type labels), deep link resolver |
| `app/(dashboard)/dashboard/notifications/actions.ts` | Server actions: getRecentNotifications, markNotificationRead, markAllNotificationsRead |
| `components/dashboard/NotificationRow.tsx` | Shared notification row component (used in dropdown + page) |
| `components/dashboard/NotificationDropdown.tsx` | Bell icon with badge + dropdown panel |
| `app/(dashboard)/dashboard/notifications/page.tsx` | Full notifications page with filters and pagination |
| `types/database.types.ts` | Add admin_notifications table types (modify) |
| `components/dashboard/Header.tsx` | Replace bell icon with NotificationDropdown (modify) |
| `app/(dashboard)/dashboard/page.tsx` | Pass notification count instead of pendingCount to Header (modify) |
| `components/dashboard/Sidebar.tsx` | Add Notifications nav item (modify) |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/011_admin_notifications.sql`

This migration is run manually in the Supabase SQL Editor (no Docker locally).

- [ ] **Step 1: Write the migration SQL**

```sql
-- =====================================================
-- Migration 011: Admin Notifications System
-- =====================================================
-- Creates admin_notifications table with triggers on
-- profiles, event_rsvps, reservations, help_requests
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_code text NOT NULL,
  type text NOT NULL CHECK (type IN ('pending_resident', 'event_rsvp', 'facility_reservation', 'help_request')),
  title text NOT NULL,
  body text,
  actor_name text,
  reference_id uuid,
  reference_table text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_notif_unread
  ON admin_notifications (community_code, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notif_timeline
  ON admin_notifications (community_code, created_at DESC);

-- 3. GRANTs (required for tables created via raw SQL)
GRANT ALL ON admin_notifications TO anon, authenticated, service_role;

-- 4. Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- SELECT: property managers can read notifications for their communities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'pm_read_notifications'
  ) THEN
    CREATE POLICY "pm_read_notifications"
      ON admin_notifications FOR SELECT
      USING (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      );
  END IF;
END $$;

-- UPDATE: property managers can mark notifications as read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'pm_update_notifications'
  ) THEN
    CREATE POLICY "pm_update_notifications"
      ON admin_notifications FOR UPDATE
      USING (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      )
      WITH CHECK (
        community_code IN (
          SELECT c.community_code FROM communities c
          WHERE c.property_manager_id IN (
            SELECT pm.id FROM property_managers pm WHERE pm.user_id = auth.uid()
          )
          OR c.organization_id IN (
            SELECT pm.organization_id FROM property_managers pm
            WHERE pm.user_id = auth.uid() AND pm.organization_id IS NOT NULL
          )
        )
      );
  END IF;
END $$;

-- INSERT: allow service_role and triggers to insert (triggers run as table owner)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_notifications'
    AND policyname = 'service_insert_notifications'
  ) THEN
    CREATE POLICY "service_insert_notifications"
      ON admin_notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 6. Trigger function
CREATE OR REPLACE FUNCTION fn_notify_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
  v_body text;
  v_actor text;
  v_type text;
  v_community_code text;
  v_reference_id uuid;
  v_profile_name text;
  v_event_title text;
  v_facility_name text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    v_type := 'pending_resident';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    v_actor := NEW.full_name;
    v_title := 'New join request';
    v_body := NEW.full_name || COALESCE(' — Unit ' || NEW.unit_number, '');

  ELSIF TG_TABLE_NAME = 'event_rsvps' THEN
    v_type := 'event_rsvp';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    -- Look up resident name
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    -- Look up event title
    SELECT title INTO v_event_title
      FROM events WHERE id = NEW.event_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'New event RSVP';
    v_body := v_actor || ' responded to ' || COALESCE(v_event_title, 'an event');

  ELSIF TG_TABLE_NAME = 'reservations' THEN
    v_type := 'facility_reservation';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    -- Look up resident name
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    -- Look up facility name
    SELECT name INTO v_facility_name
      FROM facilities WHERE id = NEW.facility_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'Reservation request';
    v_body := v_actor || ' — ' || COALESCE(v_facility_name, 'a facility');

  ELSIF TG_TABLE_NAME = 'help_requests' THEN
    v_type := 'help_request';
    v_community_code := NEW.community_code;
    v_reference_id := NEW.id;
    -- Look up resident name
    SELECT full_name INTO v_profile_name
      FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    v_actor := COALESCE(v_profile_name, 'A resident');
    v_title := 'Help request';
    -- Dynamically get description column (schema varies)
    v_body := v_actor;
    BEGIN
      EXECUTE format('SELECT ($1).%I', 'request_type') INTO v_facility_name USING NEW;
      IF v_facility_name IS NOT NULL THEN
        v_body := v_actor || ' — ' || v_facility_name;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      -- Column doesn't exist, use actor name only
      NULL;
    END;

  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (community_code, type, title, body, actor_name, reference_id, reference_table)
  VALUES (v_community_code, v_type, v_title, v_body, v_actor, v_reference_id, TG_TABLE_NAME);

  RETURN NEW;
END;
$$;

-- 7. Attach triggers

-- Profiles: only pending status
DROP TRIGGER IF EXISTS trg_notify_pending_resident ON profiles;
CREATE TRIGGER trg_notify_pending_resident
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

-- Reservations: only pending status
DROP TRIGGER IF EXISTS trg_notify_reservation ON reservations;
CREATE TRIGGER trg_notify_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

-- Event RSVPs: if table exists (created by mobile app)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_rsvps') THEN
    DROP TRIGGER IF EXISTS trg_notify_event_rsvp ON event_rsvps;
    CREATE TRIGGER trg_notify_event_rsvp
      AFTER INSERT ON event_rsvps
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_admin();
  END IF;
END $$;

-- Help requests: if table exists (created by mobile app)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'help_requests') THEN
    DROP TRIGGER IF EXISTS trg_notify_help_request ON help_requests;
    CREATE TRIGGER trg_notify_help_request
      AFTER INSERT ON help_requests
      FOR EACH ROW
      EXECUTE FUNCTION fn_notify_admin();
  END IF;
END $$;

-- 8. Verification
SELECT 'admin_notifications table' AS item, count(*) AS rows FROM admin_notifications
UNION ALL
SELECT 'triggers', count(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_notify_%'
UNION ALL
SELECT 'policies', count(*) FROM pg_policies WHERE tablename = 'admin_notifications';
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Copy the SQL above, paste into Supabase SQL Editor, and run. Verify output shows the table, triggers, and policies created.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/011_admin_notifications.sql
git commit -m "feat: add admin_notifications table with triggers"
```

---

### Task 2: TypeScript Types and Shared Constants

**Files:**
- Modify: `types/database.types.ts`
- Create: `lib/notifications.ts`

- [ ] **Step 1: Add admin_notifications type to database.types.ts**

Add inside `Tables` (after `analytics_events`):

```typescript
      admin_notifications: {
        Row: {
          id: string;
          community_code: string;
          type: "pending_resident" | "event_rsvp" | "facility_reservation" | "help_request";
          title: string;
          body: string | null;
          actor_name: string | null;
          reference_id: string | null;
          reference_table: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_code: string;
          type: "pending_resident" | "event_rsvp" | "facility_reservation" | "help_request";
          title: string;
          body?: string | null;
          actor_name?: string | null;
          reference_id?: string | null;
          reference_table?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
      };
```

- [ ] **Step 2: Create lib/notifications.ts**

```typescript
export type NotificationType =
  | "pending_resident"
  | "event_rsvp"
  | "facility_reservation"
  | "help_request";

export interface AdminNotification {
  id: string;
  community_code: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actor_name: string | null;
  reference_id: string | null;
  reference_table: string | null;
  is_read: boolean;
  created_at: string;
}

export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; icon: string; color: string }
> = {
  pending_resident: { label: "Residents", icon: "UserPlus", color: "var(--nly-warning)" },
  event_rsvp: { label: "RSVPs", icon: "CalendarCheck", color: "var(--nly-accent)" },
  facility_reservation: { label: "Reservations", icon: "ClipboardList", color: "var(--nly-brand)" },
  help_request: { label: "Help Requests", icon: "HelpCircle", color: "var(--nly-info, #06b6d4)" },
};

export const NOTIFICATION_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending_resident", label: "Residents" },
  { value: "event_rsvp", label: "RSVPs" },
  { value: "facility_reservation", label: "Reservations" },
  { value: "help_request", label: "Help Requests" },
] as const;

/**
 * Resolve a notification to a deep link URL.
 * communityMap: community_code → community id
 */
export function getNotificationHref(
  notification: AdminNotification,
  communityMap: Map<string, string>,
): string {
  const communityId = communityMap.get(notification.community_code);
  if (!communityId) return "/dashboard/communities";

  switch (notification.type) {
    case "pending_resident":
      return `/dashboard/communities/${communityId}/pending`;
    case "event_rsvp":
      return `/dashboard/communities/${communityId}/events`;
    case "facility_reservation":
      return `/dashboard/communities/${communityId}/facilities`;
    case "help_request":
      return `/dashboard/communities/${communityId}`;
    default:
      return `/dashboard/communities/${communityId}`;
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add types/database.types.ts lib/notifications.ts
git commit -m "feat: add notification types and shared constants"
```

---

### Task 3: Server Actions

**Files:**
- Create: `app/(dashboard)/dashboard/notifications/actions.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AdminNotification } from "@/lib/notifications";

export async function getNotificationCount(
  communityCodes: string[],
): Promise<number> {
  if (communityCodes.length === 0) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .in("community_code", communityCodes)
    .eq("is_read", false);
  return count ?? 0;
}

export async function getRecentNotifications(
  communityCodes: string[],
  limit = 8,
): Promise<AdminNotification[]> {
  if (communityCodes.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminNotification[];
}

export async function getNotifications(
  communityCodes: string[],
  filter: string | null,
  offset = 0,
  limit = 20,
): Promise<{ notifications: AdminNotification[]; total: number }> {
  if (communityCodes.length === 0) return { notifications: [], total: 0 };
  const supabase = await createClient();

  let query = supabase
    .from("admin_notifications")
    .select("*", { count: "exact" })
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter && filter !== "all") {
    query = query.eq("type", filter);
  }

  const { data, count } = await query;
  return {
    notifications: (data ?? []) as AdminNotification[],
    total: count ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", id);
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsRead(
  communityCodes: string[],
): Promise<void> {
  if (communityCodes.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .in("community_code", communityCodes)
    .eq("is_read", false);
  revalidatePath("/dashboard", "layout");
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/notifications/actions.ts
git commit -m "feat: add notification server actions"
```

---

### Task 4: NotificationRow Component

**Files:**
- Create: `components/dashboard/NotificationRow.tsx`

- [ ] **Step 1: Create the shared notification row component**

```typescript
"use client";

import { formatDistanceToNow } from "date-fns";
import { UserPlus, CalendarCheck, ClipboardList, HelpCircle } from "lucide-react";
import type { AdminNotification, NotificationType } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notifications";

const ICON_MAP: Record<NotificationType, React.ComponentType<{ size?: number }>> = {
  pending_resident: UserPlus,
  event_rsvp: CalendarCheck,
  facility_reservation: ClipboardList,
  help_request: HelpCircle,
};

interface NotificationRowProps {
  notification: AdminNotification;
  communityName?: string;
  showCommunity?: boolean;
  onClick?: () => void;
}

export function NotificationRow({
  notification,
  communityName,
  showCommunity = false,
  onClick,
}: NotificationRowProps) {
  const meta = NOTIFICATION_META[notification.type];
  const Icon = ICON_MAP[notification.type];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--nly-surface-hover)] group"
      style={{
        backgroundColor: notification.is_read ? "transparent" : "rgba(120, 166, 200, 0.04)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
      >
        <Icon size={15} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{
            color: "var(--nly-text-primary)",
            fontWeight: notification.is_read ? 400 : 500,
          }}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            {notification.body}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--nly-text-placeholder)" }}>
          {showCommunity && communityName && (
            <span className="mr-1.5">{communityName} &middot;</span>
          )}
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {!notification.is_read && (
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-2"
          style={{
            backgroundColor: "var(--nly-accent)",
            boxShadow: "0 0 6px rgba(120, 166, 200, 0.4)",
          }}
        />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/NotificationRow.tsx
git commit -m "feat: add shared NotificationRow component"
```

---

### Task 5: NotificationDropdown Component

**Files:**
- Create: `components/dashboard/NotificationDropdown.tsx`

- [ ] **Step 1: Create the dropdown component**

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { NotificationRow } from "@/components/dashboard/NotificationRow";
import { getNotificationHref } from "@/lib/notifications";
import type { AdminNotification } from "@/lib/notifications";
import {
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/dashboard/notifications/actions";

interface NotificationDropdownProps {
  communityCodes: string[];
  communityMap: Record<string, string>; // code → id
  communityNameMap: Record<string, string>; // code → name
  unreadCount: number;
}

export function NotificationDropdown({
  communityCodes,
  communityMap,
  communityNameMap,
  unreadCount,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      const data = await getRecentNotifications(communityCodes, 8);
      setNotifications(data);
      setLoading(false);
    }
  }

  async function handleClickNotification(notification: AdminNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }
    setOpen(false);
    const map = new Map(Object.entries(communityMap));
    const href = getNotificationHref(notification, map);
    router.push(href);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(communityCodes);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger */}
      <motion.button
        onClick={handleOpen}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
        style={{ color: "var(--nly-text-secondary)" }}
        whileHover={{ scale: 1.05, backgroundColor: "var(--nly-surface-hover)" }}
        whileTap={{ scale: 0.95 }}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "No new notifications"}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
            style={{
              backgroundColor: "var(--nly-error)",
              boxShadow: "0 0 8px rgba(239, 68, 68, 0.4)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-12 w-[380px] max-h-[480px] rounded-xl border shadow-lg overflow-hidden z-50"
            style={{
              backgroundColor: "var(--nly-surface)",
              borderColor: "var(--nly-border)",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--nly-border)" }}
            >
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--nly-text-primary)" }}
              >
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: "var(--nly-accent)" }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[370px] divide-y" style={{ borderColor: "var(--nly-divider)" }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)", width: "70%" }} />
                      <div className="h-2 rounded w-20 nly-shimmer" style={{ backgroundColor: "var(--nly-surface-hover)" }} />
                    </div>
                  </div>
                ))
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    communityName={communityNameMap[n.community_code]}
                    showCommunity={communityCodes.length > 1}
                    onClick={() => handleClickNotification(n)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2.5 border-t text-center"
              style={{ borderColor: "var(--nly-border)" }}
            >
              <a
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--nly-accent)" }}
              >
                View all notifications &rarr;
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/NotificationDropdown.tsx
git commit -m "feat: add NotificationDropdown with bell badge"
```

---

### Task 6: Integrate NotificationDropdown into Header

**Files:**
- Modify: `components/dashboard/Header.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Update Header to accept notification props and render dropdown**

Replace the full `Header.tsx` content. Key changes:
- Replace `pendingCount` prop with `notificationCount`, `communityCodes`, `communityMap`, `communityNameMap`
- Replace the bell `<motion.a>` with `<NotificationDropdown>`

In `components/dashboard/Header.tsx`, replace the import section and interface:

```typescript
"use client";

import { Bell } from "lucide-react";
import { motion } from "motion/react";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";

interface HeaderProps {
  title: string;
  subtitle?: string;
  trialDaysLeft?: number | null;
  activeResidents?: number | null;
  notificationCount?: number;
  communityCodes?: string[];
  communityMap?: Record<string, string>;
  communityNameMap?: Record<string, string>;
}
```

Update the function signature:

```typescript
export function Header({
  title,
  subtitle,
  trialDaysLeft,
  activeResidents,
  notificationCount = 0,
  communityCodes = [],
  communityMap = {},
  communityNameMap = {},
}: HeaderProps) {
```

Replace the `{/* Notifications */}` section (the `<motion.a>` block) with:

```typescript
        {/* Notifications */}
        {communityCodes.length > 0 ? (
          <NotificationDropdown
            communityCodes={communityCodes}
            communityMap={communityMap}
            communityNameMap={communityNameMap}
            unreadCount={notificationCount}
          />
        ) : (
          <motion.button
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ color: "var(--nly-text-secondary)" }}
            whileHover={{ scale: 1.05, backgroundColor: "var(--nly-surface-hover)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell size={18} />
          </motion.button>
        )}
```

- [ ] **Step 2: Update dashboard page to pass notification data to Header**

In `app/(dashboard)/dashboard/page.tsx`:

Add import at top:
```typescript
import { getNotificationCount } from "@/app/(dashboard)/dashboard/notifications/actions";
```

After the existing `recentActivity` computation (before the greeting section), add:

```typescript
  // Notification count for bell badge
  const notificationCount = await getNotificationCount(communityCodes);

  // Build maps for notification deep links
  const communityMap: Record<string, string> = {};
  const communityNameMap: Record<string, string> = {};
  for (const c of communities) {
    communityMap[c.community_code] = c.id;
    communityNameMap[c.community_code] = c.name;
  }
```

Update the `<Header>` JSX to replace `pendingCount` with notification props:

```typescript
      <Header
        title={`${greeting}, ${firstName} 👋`}
        subtitle="Here's what's happening across your communities"
        trialDaysLeft={firstCommunity.status === "trial" ? trialDaysLeft : null}
        notificationCount={notificationCount}
        communityCodes={communityCodes}
        communityMap={communityMap}
        communityNameMap={communityNameMap}
      />
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/Header.tsx app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: integrate notification dropdown into header"
```

---

### Task 7: Notifications Page

**Files:**
- Create: `app/(dashboard)/dashboard/notifications/page.tsx`

- [ ] **Step 1: Create the notifications page**

```typescript
import { getAuthenticatedPM } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { NotificationList } from "@/components/dashboard/NotificationList";
import { getNotifications, getNotificationCount } from "./actions";
import { NOTIFICATION_FILTERS } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const filter = (typeof resolvedParams.filter === "string" ? resolvedParams.filter : null);

  const { pm } = await getAuthenticatedPM();
  const supabase = await createClient();

  // Get communities
  let commQuery = supabase
    .from("communities")
    .select("id, community_code, name");

  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }

  const { data: communitiesRaw } = await commQuery;
  const communities = (communitiesRaw as { id: string; community_code: string; name: string }[] | null) ?? [];

  if (communities.length === 0) redirect("/onboarding");

  const communityCodes = communities.map((c) => c.community_code);
  const communityMap: Record<string, string> = {};
  const communityNameMap: Record<string, string> = {};
  for (const c of communities) {
    communityMap[c.community_code] = c.id;
    communityNameMap[c.community_code] = c.name;
  }

  const notificationCount = await getNotificationCount(communityCodes);
  const { notifications, total } = await getNotifications(communityCodes, filter);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Notifications"
        subtitle={`${notificationCount} unread`}
        notificationCount={notificationCount}
        communityCodes={communityCodes}
        communityMap={communityMap}
        communityNameMap={communityNameMap}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            {NOTIFICATION_FILTERS.map((f) => (
              <a
                key={f.value}
                href={f.value === "all" ? "/dashboard/notifications" : `/dashboard/notifications?filter=${f.value}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor:
                    (filter ?? "all") === f.value
                      ? "rgba(230, 92, 79, 0.1)"
                      : "transparent",
                  color:
                    (filter ?? "all") === f.value
                      ? "var(--nly-brand)"
                      : "var(--nly-text-secondary)",
                  border: `1px solid ${(filter ?? "all") === f.value ? "var(--nly-brand)" : "var(--nly-border)"}`,
                }}
              >
                {f.label}
              </a>
            ))}
          </div>
          <RefreshButton />
        </div>

        <NotificationList
          notifications={notifications}
          total={total}
          communityCodes={communityCodes}
          communityMap={communityMap}
          communityNameMap={communityNameMap}
          filter={filter}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the NotificationList client component**

Create `components/dashboard/NotificationList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { NotificationRow } from "@/components/dashboard/NotificationRow";
import { getNotificationHref } from "@/lib/notifications";
import type { AdminNotification } from "@/lib/notifications";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/dashboard/notifications/actions";

interface NotificationListProps {
  notifications: AdminNotification[];
  total: number;
  communityCodes: string[];
  communityMap: Record<string, string>;
  communityNameMap: Record<string, string>;
  filter: string | null;
}

export function NotificationList({
  notifications: initialNotifications,
  total,
  communityCodes,
  communityMap,
  communityNameMap,
  filter,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const hasMore = notifications.length < total;

  async function handleClick(notification: AdminNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }
    const map = new Map(Object.entries(communityMap));
    const href = getNotificationHref(notification, map);
    router.push(href);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(communityCodes);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    const { notifications: more } = await getNotifications(
      communityCodes,
      filter,
      notifications.length,
      20,
    );
    setNotifications((prev) => [...prev, ...more]);
    setLoadingMore(false);
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {/* Bulk actions header */}
      {notifications.some((n) => !n.is_read) && (
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "var(--nly-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {total} notification{total !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--nly-accent)" }}
          >
            <CheckCheck size={13} />
            Mark all as read
          </button>
        </div>
      )}

      {/* Notification rows */}
      <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
        {notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
              No notifications yet. Activity will appear here as residents use the app.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              communityName={communityNameMap[n.community_code]}
              showCommunity={communityCodes.length > 1}
              onClick={() => handleClick(n)}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div
          className="px-4 py-3 border-t text-center"
          style={{ borderColor: "var(--nly-border)" }}
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--nly-accent)" }}
          >
            {loadingMore ? "Loading..." : `Load more (${total - notifications.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds, new `/dashboard/notifications` route appears in output

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/dashboard/notifications/page.tsx components/dashboard/NotificationList.tsx
git commit -m "feat: add notifications page with filters and pagination"
```

---

### Task 8: Add Notifications to Sidebar Navigation

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add Bell icon import and Notifications nav item**

In `components/dashboard/Sidebar.tsx`, add `Bell` to the lucide import:

```typescript
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  X,
  Zap,
  Lock,
  Bell,
} from "lucide-react";
```

Add a Notifications entry to `NAV_ITEMS` (after Account, before Command Center):

```typescript
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/communities", label: "Communities", icon: Building2 },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/account", label: "Account", icon: Settings },
  { href: "/dashboard/command-center", label: "Command Center", icon: Zap, premium: true },
] as const;
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Sidebar.tsx
git commit -m "feat: add Notifications to sidebar navigation"
```

---

### Task 9: Final Build Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build with `/dashboard/notifications` in route list

- [ ] **Step 2: Verify all notification routes exist**

Check that the build output includes:
- `ƒ /dashboard/notifications`

- [ ] **Step 3: Final commit with all changes**

If any unstaged files remain:

```bash
git status
git add -A
git commit -m "feat: admin notification system — triggers, dropdown, full page"
```
