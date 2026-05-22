# Alerts: PM edit/delete + pinned countdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PMs edit/delete community alerts in the portal and pin an alert for a chosen duration with a live countdown that disappears for residents when the time is up.

**Architecture:** Pure date/duration helpers in `lib/alerts.ts` (unit-tested). A shared `AlertFormFields` form body powers both the create dialog and a new per-row edit dialog. A client `AlertsList` derives effective pinned/expired state at render time (no cron) and ticks a live countdown. Server actions `createAlert`/`updateAlert`/`deleteAlert` write `is_pinned`/`pin_expires_at`/`valid_until` (DB write access already granted by migration 033). Picking a duration ties pin + expiry to the same UTC instant, which fixes the existing timezone bug.

**Tech Stack:** Next.js 16 (App Router, server actions), React client components, `@base-ui/react` Select, Supabase JS, sonner toasts. Unit tests: `node:test` + `node:assert/strict` run via `npm run test:unit`.

**Spec:** `docs/superpowers/specs/2026-05-22-alerts-pinned-countdown-design.md`

**Conventions to follow (existing repo patterns):**
- Form submit handlers: `try { … } catch (err) { console.error(...); toast.error("Something went wrong. Please try again."); } finally { setLoading(false); }`. Never surface raw `error.message`.
- Form controls inside dialogs use the form-variant Select (`variant="form"`) and `--nly-input-*` tokens via `inputStyle`.
- Server actions return `{ error: string }` or `{ success: true }`, auth-guard with `supabase.auth.getUser()`, and `revalidatePath` the alerts route.
- `created_by` is left null for PM-authored alerts (PMs aren't in `profiles`).
- This Next.js version differs from training data; mirror the imports/patterns already in `app/(dashboard)/dashboard/communities/[id]/alerts/actions.ts` and `components/community/EventCardActions.tsx` — do not introduce new Next APIs.

**Note on testing scope:** Only `lib/alerts.ts` is unit-tested (pure logic). The repo has no React component test harness; components and server actions are verified by `npx tsc --noEmit`, `npx eslint`, `npm run build`, and the manual checklist in Task 8. Do not scaffold a new component test framework.

---

### Task 1: Pure helpers in `lib/alerts.ts` (TDD)

**Files:**
- Create: `lib/alerts.ts`
- Test: `tests/unit/alerts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/alerts.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_DURATIONS,
  PRIORITIES,
  durationToTimestamps,
  getAlertState,
  formatCountdown,
} from "../../lib/alerts";

const NOW = Date.UTC(2026, 4, 22, 16, 0, 0); // 2026-05-22T16:00:00Z

test("ALERT_DURATIONS has the mobile-matching set", () => {
  assert.deepEqual(
    ALERT_DURATIONS.map((d) => d.value),
    ["3h", "6h", "12h", "1d", "2d", "3d", "1w"]
  );
  assert.equal(ALERT_DURATIONS.find((d) => d.value === "3h")?.ms, 3 * 3600000);
  assert.equal(ALERT_DURATIONS.find((d) => d.value === "1w")?.ms, 7 * 86400000);
});

test("PRIORITIES lists urgent/high/medium/low", () => {
  assert.deepEqual(
    PRIORITIES.map((p) => p.value),
    ["urgent", "high", "medium", "low"]
  );
});

test("durationToTimestamps('off') clears pin + expiry", () => {
  assert.deepEqual(durationToTimestamps("off", NOW), {
    is_pinned: false,
    pin_expires_at: null,
    valid_until: null,
  });
});

test("durationToTimestamps('') is treated as off", () => {
  assert.deepEqual(durationToTimestamps("", NOW), {
    is_pinned: false,
    pin_expires_at: null,
    valid_until: null,
  });
});

test("durationToTimestamps('3h') ties pin_expires_at and valid_until to now+3h UTC", () => {
  const r = durationToTimestamps("3h", NOW);
  const expected = new Date(NOW + 3 * 3600000).toISOString();
  assert.equal(r.is_pinned, true);
  assert.equal(r.pin_expires_at, expected);
  assert.equal(r.valid_until, expected);
});

test("getAlertState: future pin_expires_at => pinned, not expired, msLeft>0", () => {
  const future = new Date(NOW + 2 * 3600000).toISOString();
  const s = getAlertState(
    { is_pinned: true, pin_expires_at: future, valid_until: future },
    NOW
  );
  assert.equal(s.isPinned, true);
  assert.equal(s.isExpired, false);
  assert.equal(s.msLeft, 2 * 3600000);
});

test("getAlertState: past valid_until => expired, not pinned", () => {
  const past = new Date(NOW - 3600000).toISOString();
  const s = getAlertState(
    { is_pinned: true, pin_expires_at: past, valid_until: past },
    NOW
  );
  assert.equal(s.isPinned, false);
  assert.equal(s.isExpired, true);
});

test("getAlertState: standing alert (nulls) => not pinned, not expired", () => {
  const s = getAlertState(
    { is_pinned: false, pin_expires_at: null, valid_until: null },
    NOW
  );
  assert.equal(s.isPinned, false);
  assert.equal(s.isExpired, false);
  assert.equal(s.msLeft, null);
});

test("formatCountdown formats days/hours/minutes", () => {
  assert.equal(formatCountdown(2 * 86400000 + 3 * 3600000), "2d 3h left");
  assert.equal(formatCountdown(3 * 3600000 + 45 * 60000), "3h 45m left");
  assert.equal(formatCountdown(12 * 60000), "12m left");
  assert.equal(formatCountdown(30000), "<1m left");
  assert.equal(formatCountdown(0), "expired");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/alerts.test.ts`
(or `node --import tsx --test --test-reporter=spec tests/unit/alerts.test.ts`)
Expected: FAIL — `Cannot find module '../../lib/alerts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/alerts.ts`:

```ts
export const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "var(--nly-alert-urgent)" },
  { value: "high", label: "High", color: "var(--nly-alert-high)" },
  { value: "medium", label: "Medium", color: "var(--nly-alert-medium)" },
  { value: "low", label: "Low", color: "var(--nly-alert-low)" },
] as const;

export const ALERT_DURATIONS = [
  { value: "3h", label: "3 hours", ms: 3 * 3600000 },
  { value: "6h", label: "6 hours", ms: 6 * 3600000 },
  { value: "12h", label: "12 hours", ms: 12 * 3600000 },
  { value: "1d", label: "1 day", ms: 86400000 },
  { value: "2d", label: "2 days", ms: 2 * 86400000 },
  { value: "3d", label: "3 days", ms: 3 * 86400000 },
  { value: "1w", label: "1 week", ms: 7 * 86400000 },
] as const;

export type AlertTimestamps = {
  is_pinned: boolean;
  pin_expires_at: string | null;
  valid_until: string | null;
};

/**
 * Resolve a duration selection to the alert's pin + expiry columns.
 * "off"/"" => standing alert (no pin, no expiry). A known duration ties
 * pin_expires_at and valid_until to the same UTC instant (now + duration),
 * which both drives the countdown and removes the alert for residents on time.
 * Unknown values are treated as "off".
 */
export function durationToTimestamps(
  value: string,
  now: number = Date.now()
): AlertTimestamps {
  const match = ALERT_DURATIONS.find((d) => d.value === value);
  if (!match) {
    return { is_pinned: false, pin_expires_at: null, valid_until: null };
  }
  const at = new Date(now + match.ms).toISOString();
  return { is_pinned: true, pin_expires_at: at, valid_until: at };
}

export type AlertStateInput = {
  is_pinned?: boolean | null;
  pin_expires_at?: string | null;
  valid_until?: string | null;
};

/**
 * Effective alert state, derived from timestamps (not the stored is_pinned flag,
 * which can go stale once pin_expires_at passes). msLeft is the time remaining
 * until the pin/expiry, or null for a standing alert.
 */
export function getAlertState(
  alert: AlertStateInput,
  now: number = Date.now()
): { isPinned: boolean; isExpired: boolean; msLeft: number | null } {
  const expiryTs = alert.valid_until ? new Date(alert.valid_until).getTime() : null;
  const pinTs = alert.pin_expires_at
    ? new Date(alert.pin_expires_at).getTime()
    : null;

  const isExpired = expiryTs !== null && expiryTs <= now;
  const isPinned = !isExpired && pinTs !== null && pinTs > now;
  const refTs = pinTs ?? expiryTs;
  const msLeft = refTs === null ? null : Math.max(0, refTs - now);

  return { isPinned, isExpired, msLeft };
}

/** Human-readable remaining time, e.g. "2d 3h left", "12m left", "<1m left". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "<1m left";
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/alerts.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/alerts.ts tests/unit/alerts.test.ts
git commit -m "feat(alerts): duration/countdown helpers with unit tests"
```

---

### Task 2: Server actions — update/delete + duration-aware create

**Files:**
- Modify: `app/(dashboard)/dashboard/communities/[id]/alerts/actions.ts`

- [ ] **Step 1: Replace the file contents**

The current `createAlert` reads a `valid_until` datetime string and an `is_pinned`
checkbox. Replace with a `pin_duration`-driven version and add `updateAlert` /
`deleteAlert`. Full new file:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { durationToTimestamps } from "@/lib/alerts";

type Priority = "urgent" | "high" | "medium" | "low";

export async function createAlert(
  formData: FormData,
  communityCode: string,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const priority = formData.get("priority") as string;
  const pinDuration = (formData.get("pin_duration") as string) || "off";

  if (!title || !message || !priority) {
    return { error: "Title, message, and priority are required" };
  }

  const { is_pinned, pin_expires_at, valid_until } =
    durationToTimestamps(pinDuration);

  // created_by FKs to profiles.id; PMs live in property_managers, not profiles,
  // so we leave it null for PM-authored community alerts.
  const { error } = await supabase.from("alerts").insert({
    community_code: communityCode,
    title,
    message,
    priority: priority as Priority,
    is_active: true,
    is_pinned,
    pin_expires_at,
    valid_until,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}

export async function updateAlert(
  alertId: string,
  formData: FormData,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const priority = formData.get("priority") as string;
  const pinDuration = (formData.get("pin_duration") as string) || "keep";

  if (!title || !message || !priority) {
    return { error: "Title, message, and priority are required" };
  }

  const updates: Record<string, unknown> = {
    title,
    message,
    priority: priority as Priority,
  };

  // "keep" leaves the pin/expiry timestamps untouched; anything else
  // (a duration or "off") reschedules them.
  if (pinDuration !== "keep") {
    Object.assign(updates, durationToTimestamps(pinDuration));
  }

  const { error } = await supabase
    .from("alerts")
    .update(updates)
    .eq("id", alertId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}

export async function deleteAlert(alertId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("alerts").delete().eq("id", alertId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"`
Expected: no errors referencing `alerts/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/communities/[id]/alerts/actions.ts"
git commit -m "feat(alerts): duration-aware createAlert + add updateAlert/deleteAlert"
```

---

### Task 3: Shared `AlertFormFields` form body

**Files:**
- Create: `components/community/AlertFormFields.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, ALERT_DURATIONS } from "@/lib/alerts";

const inputStyle = {
  backgroundColor: "var(--nly-input-bg)",
  borderColor: "var(--nly-input-border)",
  color: "var(--nly-text-primary)",
};

/**
 * Shared title/message/priority/duration fields for the create and edit alert
 * dialogs. Submits via `name` attributes into the surrounding <form>.
 * - create: duration select defaults to "off" (standing alert).
 * - edit: duration select adds a leading "Keep current" option (default) so an
 *   edit can leave the existing pin/expiry untouched.
 */
export function AlertFormFields({
  mode,
  defaultValues,
}: {
  mode: "create" | "edit";
  defaultValues?: { title?: string; message?: string; priority?: string };
}) {
  const priorityItems = Object.fromEntries(
    PRIORITIES.map((p) => [p.value, p.label])
  );

  const durationItems: Record<string, string> = {
    ...(mode === "edit" ? { keep: "Keep current" } : {}),
    off: mode === "edit" ? "Remove pin & expiry" : "No expiry (standing)",
    ...Object.fromEntries(ALERT_DURATIONS.map((d) => [d.value, d.label])),
  };
  const durationDefault = mode === "edit" ? "keep" : "off";

  return (
    <>
      <div className="space-y-2">
        <Label style={{ color: "var(--nly-text-secondary)" }}>Title</Label>
        <Input
          name="title"
          required
          defaultValue={defaultValues?.title}
          placeholder="Alert title"
          className="border"
          style={inputStyle}
        />
      </div>

      <div className="space-y-2">
        <Label style={{ color: "var(--nly-text-secondary)" }}>Message</Label>
        <Textarea
          name="message"
          required
          defaultValue={defaultValues?.message}
          placeholder="Alert message..."
          className="border min-h-[100px]"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label style={{ color: "var(--nly-text-secondary)" }}>Priority</Label>
          <Select
            name="priority"
            required
            defaultValue={defaultValues?.priority}
            items={priorityItems}
          >
            <SelectTrigger variant="form">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent variant="form">
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value} variant="form">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label style={{ color: "var(--nly-text-secondary)" }}>
            Show pinned for
          </Label>
          <Select name="pin_duration" defaultValue={durationDefault} items={durationItems}>
            <SelectTrigger variant="form">
              <SelectValue placeholder="No expiry" />
            </SelectTrigger>
            <SelectContent variant="form">
              {Object.entries(durationItems).map(([value, label]) => (
                <SelectItem key={value} value={value} variant="form">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Pinned alerts show a countdown, then disappear for residents.
          </p>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"`
Expected: no errors referencing `AlertFormFields.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/community/AlertFormFields.tsx
git commit -m "feat(alerts): shared AlertFormFields with duration selector"
```

---

### Task 4: Rewrite `CreateAlertDialog` to use the shared fields

**Files:**
- Modify: `components/community/CreateAlertDialog.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { AlertFormFields } from "@/components/community/AlertFormFields";
import { createAlert } from "@/app/(dashboard)/dashboard/communities/[id]/alerts/actions";
import { toast } from "sonner";

export function CreateAlertDialog({
  communityCode,
  communityId,
}: {
  communityCode: string;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const result = await createAlert(formData, communityCode, communityId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Alert sent — visible to residents in the app");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to send alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        <Bell size={16} />
        Send Alert
      </DialogTrigger>
      <DialogContent
        className="border sm:max-w-md"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
            Send Community Alert
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          Residents will see this alert in the mobile app immediately.
        </p>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <AlertFormFields mode="create" />
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {loading ? "Sending..." : "Send Alert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"` then
`npx eslint components/community/CreateAlertDialog.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/community/CreateAlertDialog.tsx
git commit -m "feat(alerts): create dialog uses shared fields + pin duration"
```

---

### Task 5: `AlertRowActions` (edit + delete per row)

**Files:**
- Create: `components/community/AlertRowActions.tsx`

Mirrors `components/community/EventCardActions.tsx` (icon buttons + edit dialog +
delete confirm), using the shared `AlertFormFields` in edit mode.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertFormFields } from "@/components/community/AlertFormFields";
import {
  updateAlert,
  deleteAlert,
} from "@/app/(dashboard)/dashboard/communities/[id]/alerts/actions";
import { toast } from "sonner";

interface AlertRowActionsProps {
  alert: {
    id: string;
    title: string;
    message: string;
    priority: string;
  };
  communityId: string;
}

export function AlertRowActions({ alert, communityId }: AlertRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleEdit(formData: FormData) {
    setEditLoading(true);
    try {
      const result = await updateAlert(alert.id, formData, communityId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Alert updated");
        setEditOpen(false);
      }
    } catch (err) {
      console.error("Failed to update alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${alert.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const result = await deleteAlert(alert.id, communityId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Alert deleted");
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setEditOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-tertiary)",
          }}
          title="Edit alert"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-8 h-8 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-tertiary)",
          }}
          title="Delete alert"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="border sm:max-w-md"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
              Edit Alert
            </DialogTitle>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4 mt-2">
            <AlertFormFields
              mode="edit"
              defaultValues={{
                title: alert.title,
                message: alert.message,
                priority: alert.priority,
              }}
            />
            <Button
              type="submit"
              disabled={editLoading}
              className="w-full text-white"
              style={{ backgroundColor: "var(--nly-brand)" }}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"` then
`npx eslint components/community/AlertRowActions.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/community/AlertRowActions.tsx
git commit -m "feat(alerts): per-row edit/delete actions"
```

---

### Task 6: `AlertsList` (sections + live countdown)

**Files:**
- Create: `components/community/AlertsList.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAlertState, formatCountdown, PRIORITIES } from "@/lib/alerts";
import { AlertRowActions } from "@/components/community/AlertRowActions";

interface Alert {
  id: string;
  title: string;
  message: string;
  priority: string;
  is_pinned: boolean | null;
  pin_expires_at: string | null;
  valid_until: string | null;
  created_at: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: "var(--nly-alert-urgent)", bg: "rgba(239, 68, 68, 0.1)", label: "Urgent" },
  high: { color: "var(--nly-alert-high)", bg: "rgba(249, 115, 22, 0.1)", label: "High" },
  medium: { color: "var(--nly-alert-medium)", bg: "rgba(245, 158, 11, 0.1)", label: "Medium" },
  low: { color: "var(--nly-alert-low)", bg: "rgba(6, 182, 212, 0.1)", label: "Low" },
};

const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p.value, PRIORITIES.length - i])
);

export function AlertsList({
  alerts,
  communityId,
}: {
  alerts: Alert[];
  communityId: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const pinned: Alert[] = [];
  const active: Alert[] = [];
  const past: Alert[] = [];

  for (const a of alerts) {
    const state = getAlertState(a, now);
    if (state.isExpired) past.push(a);
    else if (state.isPinned) pinned.push(a);
    else active.push(a);
  }

  pinned.sort(
    (a, b) =>
      new Date(a.pin_expires_at ?? 0).getTime() -
      new Date(b.pin_expires_at ?? 0).getTime()
  );
  active.sort(
    (a, b) =>
      (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.valid_until ?? b.created_at).getTime() -
      new Date(a.valid_until ?? a.created_at).getTime()
  );

  function Row({ alert, expired }: { alert: Alert; expired?: boolean }) {
    const cfg = PRIORITY_CONFIG[alert.priority] ?? PRIORITY_CONFIG.low;
    const state = getAlertState(alert, now);
    return (
      <div
        className="px-5 py-4 flex items-start justify-between gap-3"
        style={{ borderColor: "var(--nly-divider)", opacity: expired ? 0.55 : 1 }}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
              {alert.title}
            </h4>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
            {state.isPinned && state.msLeft !== null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "rgba(47, 196, 211, 0.12)", color: "var(--nly-brand)" }}
              >
                📌 Pinned · {formatCountdown(state.msLeft)}
              </span>
            )}
          </div>
          <p className="text-xs line-clamp-2" style={{ color: "var(--nly-text-secondary)" }}>
            {alert.message}
          </p>
        </div>
        <AlertRowActions alert={alert} communityId={communityId} />
      </div>
    );
  }

  function Section({ label, items, expired }: { label: string; items: Alert[]; expired?: boolean }) {
    if (items.length === 0) return null;
    return (
      <div
        className="rounded-2xl border divide-y overflow-hidden"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <div
          className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--nly-text-tertiary)", borderColor: "var(--nly-divider)" }}
        >
          {label}
        </div>
        {items.map((a) => (
          <Row key={a.id} alert={a} expired={expired} />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div
        className="rounded-2xl border p-12 text-center"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          No alerts have been sent yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section label="Pinned" items={pinned} />
      <Section label="Active" items={active} />
      <Section label="Past alerts" items={past} expired />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"` then
`npx eslint components/community/AlertsList.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/community/AlertsList.tsx
git commit -m "feat(alerts): client list with sections + live countdown"
```

---

### Task 7: Wire `AlertsList` into the alerts page

**Files:**
- Modify: `app/(dashboard)/dashboard/communities/[id]/alerts/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { getCommunityWithAuth } from "@/lib/queries";
import { CreateAlertDialog } from "@/components/community/CreateAlertDialog";
import { AlertsList } from "@/components/community/AlertsList";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: alertsRaw } = await supabase
    .from("alerts")
    .select(
      "id, title, message, priority, is_pinned, pin_expires_at, valid_until, created_at"
    )
    .eq("community_code", community.community_code)
    .order("created_at", { ascending: false });

  const alerts =
    (alertsRaw as {
      id: string;
      title: string;
      message: string;
      priority: string;
      is_pinned: boolean | null;
      pin_expires_at: string | null;
      valid_until: string | null;
      created_at: string;
    }[]) ?? [];

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            Alerts
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {alerts.length} {alerts.length === 1 ? "alert" : "alerts"} sent
          </p>
        </div>
        <CreateAlertDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      <AlertsList alerts={alerts} communityId={id} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"` then
`npx eslint "app/(dashboard)/dashboard/communities/[id]/alerts/page.tsx"`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/communities/[id]/alerts/page.tsx"
git commit -m "feat(alerts): render AlertsList (sections, countdown, edit/delete)"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm run test:unit`
Expected: all tests pass, including `tests/unit/alerts.test.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "sentry-example"`
Expected: no output (clean).

- [ ] **Step 3: Lint**

Run: `npx eslint $(git diff --name-only HEAD~6 -- '*.ts' '*.tsx')`
Expected: clean (a pre-existing `<img>` warning in events/page.tsx is unrelated and acceptable).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual checklist (dev server, logged-in PM at a community's Alerts tab)**

```
[ ] Send Alert → "Show pinned for: 3h" → appears under "Pinned" with "📌 Pinned · 2h 59m left" ticking down.
[ ] Send Alert → "No expiry (standing)" → appears under "Active", no countdown.
[ ] Edit a pinned alert → change title, "Keep current" → title updates, countdown unchanged.
[ ] Edit → "Remove pin & expiry" → moves to Active.
[ ] Delete an alert → row disappears, "Alert deleted" toast.
[ ] In Supabase, confirm a 3h pin wrote pin_expires_at == valid_until ≈ now+3h UTC (no timezone skew).
[ ] (Optional) Set a 1-minute test pin via a temporary ALERT_DURATIONS entry, watch it move Pinned → Past after expiry; revert the temp entry.
```

- [ ] **Step 6: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "test(alerts): verify pinned countdown + edit/delete flow" || echo "nothing to commit"
```

---

## Self-Review notes

- **Spec coverage:** edit/delete (Tasks 2,5,7) ✓; pin duration + tied expiry (Tasks 1,2,3) ✓; countdown + sections + history (Task 6) ✓; timezone fix (Task 1 `durationToTimestamps`, datetime-local field removed in Task 4) ✓; no migration/cron ✓; residents unaffected (no mobile changes) ✓.
- **Legacy data:** alerts created before this change have `pin_expires_at = null`, so `getAlertState` treats them as not-pinned; if they have an old (possibly tz-skewed) `valid_until`, they sort into Active/Past by that value. Acceptable — no backfill in scope.
- **Type consistency:** `durationToTimestamps`, `getAlertState`, `formatCountdown`, `ALERT_DURATIONS`, `PRIORITIES` names match across `lib/alerts.ts`, its test, `AlertFormFields`, and `AlertsList`. Server actions read `pin_duration`; `AlertFormFields` Select uses `name="pin_duration"`. Edit "keep"/"off" handled in `updateAlert`.
