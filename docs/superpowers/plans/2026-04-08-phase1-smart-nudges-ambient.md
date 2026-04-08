# Phase 1: Smart Nudges & Ambient Awareness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard feel alive with smart, dismissible nudge cards and ambient awareness indicators (enhanced greetings, active residents, trend data, time-grouped activity feed).

**Architecture:** Server-side nudge computation in `lib/nudges.ts` queries real community data and returns actionable cards. Dashboard page passes nudge data to a new `NudgeCards` client component. Header and SummaryCard receive enhanced props for ambient awareness. ActivityFeed gains time grouping and inline quick-actions.

**Tech Stack:** Next.js 16 server components, motion/react for animations, Supabase queries, date-fns for time calculations

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/nudges.ts` (create) | Server-side nudge computation — queries pending residents, last event, resident milestones |
| `components/dashboard/NudgeCards.tsx` (create) | Client component rendering dismissible nudge cards with motion animations |
| `components/dashboard/Header.tsx` (modify) | Add activeResidents prop, enhanced day-of-week greeting |
| `components/dashboard/SummaryCard.tsx` (modify) | Already has trend prop — no changes needed |
| `components/dashboard/ActivityFeed.tsx` (modify) | Add time grouping headers, inline action buttons |
| `components/dashboard/Sidebar.tsx` (modify) | Add Command Center nav item (locked for lower tiers) |
| `app/(dashboard)/dashboard/page.tsx` (modify) | Fetch nudge data, pass to NudgeCards, enhance greeting, pass trend data |

---

### Task 1: Create Nudge Computation Engine

**Files:**
- Create: `lib/nudges.ts`

- [ ] **Step 1: Create `lib/nudges.ts` with nudge types and computation logic**

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface Nudge {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
  color: string;
}

export async function computeNudges(
  supabase: SupabaseClient,
  communityIds: string[],
  communityNames: Map<string, string>,
  communityCity?: string | null,
): Promise<Nudge[]> {
  const nudges: Nudge[] = [];

  if (communityIds.length === 0) return nudges;

  // 1. Check pending residents
  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("community_code", await getCommunityCodesForIds(supabase, communityIds))
    .eq("status", "pending");

  if (pendingCount && pendingCount > 0) {
    nudges.push({
      id: "pending-residents",
      icon: "👋",
      title: `You've got ${pendingCount} new resident${pendingCount > 1 ? "s" : ""} waiting!`,
      subtitle: "Timely approvals make a great first impression.",
      actionLabel: "Review now",
      actionHref: `/dashboard/communities/${communityIds[0]}/pending`,
      color: "var(--nly-warning)",
    });
  }

  // 2. Check last event date
  const { data: lastEvent } = await supabase
    .from("events")
    .select("event_date")
    .in("community_code", await getCommunityCodesForIds(supabase, communityIds))
    .order("event_date", { ascending: false })
    .limit(1)
    .single();

  if (lastEvent?.event_date) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastEvent.event_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= 7) {
      nudges.push({
        id: "event-gap",
        icon: "📅",
        title: `It's been ${daysSince} days since your last event`,
        subtitle: "Communities with weekly events keep residents 40% more engaged.",
        actionLabel: "Create one",
        actionHref: `/dashboard/communities/${communityIds[0]}/events`,
        color: "var(--nly-accent)",
      });
    }
  } else {
    nudges.push({
      id: "no-events",
      icon: "📅",
      title: "No events yet — your residents are waiting!",
      subtitle: "A simple meetup or announcement gets the ball rolling.",
      actionLabel: "Create your first event",
      actionHref: `/dashboard/communities/${communityIds[0]}/events`,
      color: "var(--nly-accent)",
    });
  }

  // 3. Check resident milestones
  for (const cId of communityIds) {
    const codes = await getCommunityCodesForIds(supabase, [cId]);
    const { count: residentCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("community_code", codes)
      .eq("status", "approved");

    if (residentCount) {
      const milestones = [100, 50, 25];
      for (const m of milestones) {
        if (residentCount >= m && residentCount < m + 5) {
          const name = communityNames.get(cId) ?? "Your community";
          nudges.push({
            id: `milestone-${cId}-${m}`,
            icon: "🎉",
            title: `${name} just hit ${m} residents!`,
            subtitle: "Nice milestone! Consider posting a welcome message to celebrate.",
            actionLabel: "Post an update",
            actionHref: `/dashboard/feed`,
            color: "var(--nly-success)",
          });
          break;
        }
      }
    }
  }

  // 4. Day-of-week contextual nudge
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5) {
    nudges.push({
      id: "friday-nudge",
      icon: "🎯",
      title: "Happy Friday! Plan something for the weekend?",
      subtitle: "Weekend events get 2x more RSVPs than weekday ones.",
      actionLabel: "Create an event",
      actionHref: `/dashboard/communities/${communityIds[0]}/events`,
      color: "var(--nly-brand)",
    });
  }

  return nudges.slice(0, 3); // Max 3 nudges
}

async function getCommunityCodesForIds(
  supabase: SupabaseClient,
  communityIds: string[],
): Promise<string[]> {
  const { data } = await supabase
    .from("communities")
    .select("community_code")
    .in("id", communityIds);

  return (data ?? []).map((c: { community_code: string }) => c.community_code).filter(Boolean);
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/nudges.ts
git commit -m "feat: add server-side nudge computation engine"
```

---

### Task 2: Create NudgeCards Client Component

**Files:**
- Create: `components/dashboard/NudgeCards.tsx`

- [ ] **Step 1: Create the NudgeCards component with dismiss and animation**

```typescript
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Nudge } from "@/lib/nudges";

const DISMISSED_KEY = "nly-dismissed-nudges";

function getDismissedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismissNudge(id: string) {
  const dismissed = getDismissedIds();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}

export function NudgeCards({ nudges }: { nudges: Nudge[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissedIds());
  }, []);

  const visible = nudges.filter((n) => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    dismissNudge(id);
    setDismissed((prev) => [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence mode="popLayout">
        {visible.map((nudge, i) => (
          <motion.div
            key={nudge.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl border group"
            style={{
              backgroundColor: `color-mix(in srgb, ${nudge.color} 5%, var(--nly-surface))`,
              borderColor: `color-mix(in srgb, ${nudge.color} 12%, transparent)`,
            }}
          >
            <span className="text-xl mt-0.5 shrink-0">{nudge.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--nly-text-primary)" }}>
                {nudge.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                {nudge.subtitle}{" "}
                <a
                  href={nudge.actionHref}
                  className="font-medium transition-colors hover:underline"
                  style={{ color: "var(--nly-accent)" }}
                >
                  {nudge.actionLabel} →
                </a>
              </p>
            </div>
            <button
              onClick={() => handleDismiss(nudge.id)}
              className="opacity-0 group-hover:opacity-60 transition-opacity text-xs px-1.5 py-0.5 rounded"
              style={{ color: "var(--nly-text-tertiary)" }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/NudgeCards.tsx
git commit -m "feat: add NudgeCards component with dismiss and animation"
```

---

### Task 3: Enhance Header with Ambient Awareness

**Files:**
- Modify: `components/dashboard/Header.tsx`

- [ ] **Step 1: Add activeResidents prop and day-of-week greeting enhancement**

Update the HeaderProps interface to add `activeResidents`:

```typescript
interface HeaderProps {
  title: string;
  subtitle?: string;
  trialDaysLeft?: number | null;
  activeResidents?: number | null;
}
```

Add the `activeResidents` parameter to the function signature. Then, after the subtitle paragraph (after the `</motion.div>` that wraps the title/subtitle), add the active residents indicator inside the same `<motion.div>`:

In the right side `<div className="flex items-center gap-3">`, before the trial badge, add:

```tsx
{activeResidents != null && activeResidents > 0 && (
  <div
    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
    style={{
      backgroundColor: "rgba(16, 185, 129, 0.08)",
      color: "var(--nly-success)",
    }}
  >
    <span
      className="w-1.5 h-1.5 rounded-full"
      style={{
        backgroundColor: "var(--nly-success)",
        boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)",
        animation: "nly-glow-pulse 3s ease-in-out infinite",
      }}
    />
    {activeResidents} active today
  </div>
)}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Header.tsx
git commit -m "feat: add active residents indicator to header"
```

---

### Task 4: Enhance Activity Feed with Time Grouping

**Files:**
- Modify: `components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Add time grouping and inline action buttons**

Add a `groupByTime` helper function above the component:

```typescript
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";

function groupByTime(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  const today: ActivityItem[] = [];
  const yesterday: ActivityItem[] = [];
  const thisWeek: ActivityItem[] = [];
  const older: ActivityItem[] = [];

  for (const item of items) {
    const date = new Date(item.created_at);
    if (isToday(date)) today.push(item);
    else if (isYesterday(date)) yesterday.push(item);
    else if (isThisWeek(date)) thisWeek.push(item);
    else older.push(item);
  }

  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
  if (thisWeek.length > 0) groups.push({ label: "This Week", items: thisWeek });
  if (older.length > 0) groups.push({ label: "Earlier", items: older });

  return groups;
}
```

Update the ActivityItem interface to add an optional `actionHref`:

```typescript
export interface ActivityItem {
  id: string;
  type: "resident_joined" | "event_created" | "alert_sent" | "help_request" | "reservation";
  message: string;
  community_name?: string;
  created_at: string;
  actionHref?: string;
  actionLabel?: string;
}
```

Replace the items rendering block (the `items.map(...)` section) with grouped rendering:

```tsx
groupByTime(items).map((group) => (
  <div key={group.label}>
    <div
      className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--nly-text-tertiary)", backgroundColor: "rgba(233, 238, 244, 0.03)" }}
    >
      {group.label}
    </div>
    {group.items.map((item, i) => {
      const meta = ACTIVITY_ICONS[item.type];
      return (
        <motion.div
          key={item.id}
          className="px-5 py-3 flex items-start gap-3 transition-colors duration-200 hover:bg-[var(--nly-surface-hover)]"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug" style={{ color: "var(--nly-text-primary)" }}>
              {item.message}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
              {item.community_name && (
                <span className="mr-2">{item.community_name} &middot;</span>
              )}
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
          {item.actionHref && (
            <a
              href={item.actionHref}
              className="text-xs font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--nly-accent)" }}
            >
              {item.actionLabel ?? "View"} →
            </a>
          )}
        </motion.div>
      );
    })}
  </div>
))
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ActivityFeed.tsx
git commit -m "feat: add time grouping and inline actions to activity feed"
```

---

### Task 5: Add Command Center Nav Item to Sidebar

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add Command Center to NAV_ITEMS with lock icon for non-premium**

Add `Zap` and `Lock` to the lucide-react import:

```typescript
import {
  LayoutDashboard, Building2, Users, CreditCard, Settings,
  LogOut, ChevronRight, X, Zap, Lock,
} from "lucide-react";
```

Add Command Center to NAV_ITEMS array after the Account item:

```typescript
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/communities", label: "Communities", icon: Building2 },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/account", label: "Account", icon: Settings },
  { href: "/dashboard/command-center", label: "Command Center", icon: Zap, premium: true },
];
```

Update the NAV_ITEMS type and add a lock badge for premium items. In the nav item rendering, after the `<span className="flex-1">{item.label}</span>`, add:

```tsx
{item.premium && (
  <Lock size={11} style={{ color: "var(--nly-text-placeholder)" }} />
)}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/Sidebar.tsx
git commit -m "feat: add Command Center nav item with premium lock"
```

---

### Task 6: Wire Everything into the Dashboard Page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Import and call nudge computation, pass data to components**

Add imports at the top:

```typescript
import { computeNudges } from "@/lib/nudges";
import { NudgeCards } from "@/components/dashboard/NudgeCards";
```

After the existing data fetching (after `const activeCommunities = ...`), add nudge computation:

```typescript
// Compute smart nudges
const communityNames = new Map(communities.map((c) => [c.id, c.name]));
const nudges = await computeNudges(
  supabase,
  communities.map((c) => c.id),
  communityNames,
  firstCommunity ? (communities[0] as { city?: string | null }).city : null,
);
```

Enhance the greeting with day-of-week:

```typescript
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayOfWeek = new Date().getDay();
const dayName = dayNames[dayOfWeek];
const hour = new Date().getHours();
const greeting =
  dayOfWeek === 5
    ? "Happy Friday"
    : dayOfWeek === 0
    ? "Relaxing Sunday"
    : hour < 12
    ? "Good morning"
    : hour < 17
    ? "Good afternoon"
    : "Good evening";
```

In the JSX, add NudgeCards as a new DashboardSection after the summary cards section:

```tsx
{nudges.length > 0 && (
  <DashboardSection delay={0.1}>
    <NudgeCards nudges={nudges} />
  </DashboardSection>
)}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx lib/nudges.ts components/dashboard/NudgeCards.tsx
git commit -m "feat: wire smart nudges and ambient awareness into dashboard"
```

---

### Task 7: Full Build Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: All pages compile, no TypeScript errors

- [ ] **Step 2: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Phase 1 — smart nudges and ambient awareness dashboard"
```
