# Admin Notification System — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Database triggers + admin portal UI for actionable notifications

---

## Overview

A production-grade notification system that alerts property managers when residents take actions that need attention. Uses PostgreSQL triggers to generate notifications automatically — zero mobile app changes required.

### Notification Types (Launch)

| Type | Trigger | Action needed |
|------|---------|---------------|
| `pending_resident` | Resident signs up with `status = 'pending'` | Approve or deny |
| `event_rsvp` | Resident RSVPs to a community event | Awareness / planning |
| `facility_reservation` | Resident books a facility | Confirm or manage |
| `help_request` | Resident submits a help request | Respond / assist |

### Out of Scope (Phase 2+)

- Post/comment notifications (unless admin is @mentioned)
- DM/messaging notifications
- Push notifications (browser or mobile)
- Supabase Realtime / WebSocket subscriptions

---

## Architecture

```
Mobile App                    Supabase Database                     Admin Portal
───────────                   ──────────────────                    ────────────
INSERT INTO profiles     ──►  AFTER INSERT trigger  ──►            admin_notifications
INSERT INTO event_rsvps  ──►  fn_notify_admin()     ──►            (read by admin portal)
INSERT INTO reservations ──►  fn_notify_admin()     ──►
INSERT INTO help_requests──►  fn_notify_admin()     ──►
```

**Key principle:** The mobile app writes to its existing tables as it always has. The database triggers handle notification creation. The admin portal reads from `admin_notifications`.

---

## Database Layer

### Table: `admin_notifications`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | uuid | PK, default gen_random_uuid() | Unique ID |
| `community_code` | text | NOT NULL | Links to community |
| `type` | text | NOT NULL, CHECK IN ('pending_resident', 'event_rsvp', 'facility_reservation', 'help_request') | Notification category |
| `title` | text | NOT NULL | Short display title |
| `body` | text | | Detail line |
| `actor_name` | text | | Resident who triggered it |
| `reference_id` | uuid | | Source row ID for deep linking |
| `reference_table` | text | | Source table name |
| `is_read` | boolean | NOT NULL, default false | Read state |
| `created_at` | timestamptz | NOT NULL, default now() | Creation time |

### Indexes

```sql
CREATE INDEX idx_admin_notif_unread ON admin_notifications (community_code, is_read, created_at DESC);
CREATE INDEX idx_admin_notif_timeline ON admin_notifications (community_code, created_at DESC);
```

### RLS

Enabled. Property managers can SELECT and UPDATE (is_read only) notifications for communities they manage. Same join pattern as existing policies: `community_code IN (SELECT community_code FROM communities WHERE property_manager_id IN (SELECT id FROM property_managers WHERE user_id = auth.uid()))`.

### GRANTs

```sql
GRANT ALL ON admin_notifications TO anon, authenticated, service_role;
```

### Trigger Function: `fn_notify_admin()`

A single reusable function attached to multiple tables. Uses `TG_TABLE_NAME` to determine notification type and extract relevant fields:

- **profiles** (only when `NEW.status = 'pending'`): title = "New join request", body = "{full_name} — Unit {unit_number}", actor_name = full_name
- **event_rsvps**: title = "New event RSVP", body = "{resident_name} responded to {event_title}", actor_name = resident_name. Requires a join to profiles and events to get names.
- **reservations** (only when `NEW.status = 'pending'`): title = "Reservation request", body = "{resident_name} — {facility_name}", actor_name = resident_name. Requires joins to profiles and facilities.
- **help_requests**: title = "Help request", body = "{resident_name} — {request_type}", actor_name = resident_name

### Triggers

```sql
-- Profiles: only fire for pending status
CREATE TRIGGER trg_notify_pending_resident
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

-- Event RSVPs: fire on every insert
CREATE TRIGGER trg_notify_event_rsvp
  AFTER INSERT ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_admin();

-- Reservations: only fire for pending status
CREATE TRIGGER trg_notify_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_notify_admin();

-- Help requests: fire on every insert
CREATE TRIGGER trg_notify_help_request
  AFTER INSERT ON help_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_admin();
```

---

## Admin Portal UI

### Bell Icon Dropdown (Header)

- **Trigger:** Click on bell icon in Header component
- **Content:** Up to 8 most recent notifications
- **Each row:** Type icon (color-coded), title, body, relative timestamp, unread blue dot
- **Actions:**
  - Click notification → mark as read + navigate to deep link
  - "Mark all as read" button at top
  - "View all notifications →" link at bottom → `/dashboard/notifications`
- **Fetch strategy:** Server action called on dropdown open (not on every render)

### Notifications Page (`/dashboard/notifications`)

- **Route:** `app/(dashboard)/dashboard/notifications/page.tsx`
- **Server component** with `force-dynamic`
- **Filter tabs:** All | Residents | RSVPs | Reservations | Help Requests
  - Uses search params: `?filter=pending_resident`
- **Each row:** Type icon, title, body, community name, relative timestamp, read/unread styling
- **Click row:** Mark as read + navigate to source
- **Bulk action:** "Mark all as read" button
- **Refresh:** RefreshButton component (already exists)
- **Pagination:** 20 per page, "Load more" button

### Notification Type Styling

| Type | Icon (Lucide) | Color variable |
|------|---------------|----------------|
| `pending_resident` | UserPlus | `--nly-warning` |
| `event_rsvp` | CalendarCheck | `--nly-accent` |
| `facility_reservation` | ClipboardList | `--nly-brand` |
| `help_request` | HelpCircle | `--nly-info` |

### Deep Links

| Type | Destination |
|------|-------------|
| `pending_resident` | `/dashboard/communities/[id]/pending` |
| `event_rsvp` | `/dashboard/communities/[id]/events` |
| `facility_reservation` | `/dashboard/communities/[id]/facilities` |
| `help_request` | `/dashboard/communities/[id]` |

Community `[id]` is resolved by looking up `community_code` → `communities.id`.

---

## Data Flow & Integration

### Unread Count (Layout Level)

- Fetched once in `app/(dashboard)/layout.tsx` per page load
- Query: `SELECT count(*) FROM admin_notifications WHERE community_code IN (...) AND is_read = false`
- Passed to `Header` as `notificationCount` prop
- Replaces current `pendingCount` prop on Header

### Server Actions

```typescript
// Fetch recent notifications for dropdown
getRecentNotifications(communityCodes: string[], limit: number): Promise<Notification[]>

// Mark single notification as read
markNotificationRead(id: string): Promise<void>

// Mark all notifications as read for given communities
markAllNotificationsRead(communityCodes: string[]): Promise<void>
```

All actions call `revalidatePath` to refresh the unread count.

### Changes to Existing Code

| File | Change |
|------|--------|
| `components/dashboard/Header.tsx` | Replace bell button with dropdown trigger, `pendingCount` → `notificationCount` |
| `app/(dashboard)/layout.tsx` | Add notification count query, pass to Header |
| `app/(dashboard)/dashboard/page.tsx` | Remove redundant pendingCount from Header (handled by layout) |
| `types/database.types.ts` | Add `admin_notifications` table types |

### What Doesn't Change

- Mobile app — zero changes
- Existing activity feed — remains a history view
- Existing RefreshButton — reused
- Existing RLS policies — unchanged

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/011_admin_notifications.sql` | Table, indexes, RLS, trigger function, triggers, GRANTs |
| `app/(dashboard)/dashboard/notifications/page.tsx` | Full notifications page |
| `app/(dashboard)/dashboard/notifications/actions.ts` | Server actions (mark read, fetch) |
| `components/dashboard/NotificationDropdown.tsx` | Bell icon dropdown component |
| `components/dashboard/NotificationRow.tsx` | Shared notification row (used in dropdown + page) |
| `lib/notifications.ts` | Shared types and constants (icon map, deep link resolver) |

---

## Future Considerations (not in this spec)

- **Supabase Realtime:** Layer WebSocket listener on same `admin_notifications` table for instant push (Phase 3, after Vercel migration)
- **@mention notifications:** Parse post/comment content for mentions, create notification with `type = 'mention'`
- **Email digest:** Daily/weekly summary of unread notifications via Supabase Edge Functions
- **Browser push:** Service worker for notifications when admin portal isn't open
