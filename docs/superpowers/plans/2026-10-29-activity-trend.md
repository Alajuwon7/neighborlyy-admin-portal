# Activity Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly stacked "took part / quietly active" chart on the community Insights tab, backed by a new server-side daily activity log, with the PM's events and alerts marked.

**Architecture:** A Miyora migration adds `public.resident_activity_days`, filled by a trigger on the existing `profiles.last_active` heartbeat (no app release), plus one shared SQL helper for action signals, a weekly read RPC, and an updated `get_active_resident_count`. The portal merges that RPC with `community_digests` (took part) in a pure, unit-tested helper and renders a Recharts stacked bar chart with event/alert markers.

**Tech Stack:** Postgres/Supabase (plpgsql, RLS), Next.js 16 App Router (server components), Recharts, node:test via `npm run test:unit`.

**Spec:** `docs/superpowers/specs/2026-10-27-activity-trend-design.md` (read it first; this plan argues from it).

## Global Constraints

- Two repos: SQL work in `/Users/AlajuwonThomas/Developer/Miyora` (branch `feat/activity-trend` off `master`); portal work in `/Users/AlajuwonThomas/Developer/neighborlyy-admin-portal` (branch `feat/activity-trend`, already holds the spec).
- **Never** run `supabase db push` or `supabase migration repair` from either repo. The owner applies the migration in the Supabase SQL editor (shared prod project).
- Residents only: `role = 'resident' AND NOT exclude_from_leaderboard`, applied when a log row is written. Weekly log counts never join today's roster.
- Weeks: ISO Monday–Sunday, UTC (`lastWeeks` in `lib/insights.ts`, same as the digest).
- Residents who hid their online status are never counted for browsing (they send no heartbeat — do not add any other open signal).
- Every new SQL function: `SECURITY DEFINER` only where it must read past RLS, `SET search_path TO 'public'`, caller check identical to `get_active_resident_count` (`internal.auth_user_is_admin_in(code) OR internal.auth_user_manages_community(code) OR platform owner`), `REVOKE ... FROM public, anon` + `GRANT EXECUTE ... TO authenticated`.
- No resident-level data leaves the database: RPCs return counts only. `resident_activity_days` has RLS on and **no** policies.
- Colours: took part `#d95926`, quietly active `#16A3B3` at reduced opacity, event marker neutral (`var(--nly-text-secondary)`), alert marker `#E8C547`; red stays reserved for status.
- Copy: slices are "Took part" and "Quietly active"; headline pattern `"{active} residents active last week · {pct}% of {residents} · {tookPart} took part"`; untracked note `"App-open tracking started {d Mon yyyy}; earlier weeks show taking part only."`
- Lint must stay clean (react-hooks v6 rules are errors). Never surface raw `error.message` to users.

## Review Focus

1. **Weeks before tracking started** — bar shows only the orange slice and no "0 quietly active" in hover or figcaption. (Task 3 test `untracked weeks have null quiet`.)
2. **Live action count below the frozen digest** (content hard-deleted after the week closed) — bar total never shorter than "took part". (Task 3 test `active never below tookPart`.)
3. **A US-evening event on Sunday** (e.g. Sun 23:30 EDT = Mon 03:30 UTC) — marker lands in the UTC week, same as the digest. (Task 3 test `markers bucket by UTC week`.)
4. **Residents count of 0** or a community with no digests — no `NaN%`/`Infinity%`; percentage shows `—`, chart shows the existing empty state. (Task 3 test `pct is null when no residents`; Task 4 empty state.)
5. **Heartbeat every 60s** — at most one log write per resident per UTC day, and admins/founder never logged. (Task 1 verification script checks 2 and 3.)

---

### Task 1: Activity log table, trigger and anonymise-on-delete (Miyora)

**Files:**
- Create: `supabase/migrations/20261029120000_resident_activity_days.sql`
- Create: `supabase/tests/20261029_activity_days_check.sql` (manual verification; runs inside `BEGIN … ROLLBACK`)

**Interfaces:**
- Produces: table `public.resident_activity_days(user_id uuid NOT NULL, community_code text NOT NULL, day date NOT NULL, PRIMARY KEY (user_id, day))`, index `(community_code, day)`; table `internal.activity_log_meta(started_on date NOT NULL)` with exactly one row (`current_date` at apply time, UTC).
- Produces: trigger functions `internal.log_resident_activity_day()` and `internal.anonymise_activity_days()`.

- [ ] **Step 1: Write the verification script** `supabase/tests/20261029_activity_days_check.sql`. Wrapped in `BEGIN; … ROLLBACK;`, it picks one TREND1 resident (`role='resident' AND NOT exclude_from_leaderboard`) and one admin, then `RAISE EXCEPTION` on any failed check:
  1. `UPDATE profiles SET last_active = now()` on the resident → exactly 1 row for `(id, current_date)` with `community_code = 'TREND1'`.
  2. Second update to `now() + interval '1 minute'` → still exactly 1 row (no duplicate, no error).
  3. Same update on the admin and on the `exclude_from_leaderboard` profile → 0 rows for them.
  4. Anonymise on delete: assert the `BEFORE DELETE` trigger exists on `profiles` (`pg_trigger`). Then, inside a `BEGIN … EXCEPTION` sub-block, `DELETE FROM profiles WHERE id = <resident>` and assert the resident's log rows still exist, none have the old `user_id`, and they all share one new `user_id`. If FKs block the delete, catch it and `RAISE NOTICE 'skipped: delete check (FK)'` instead of failing.
  5. `SELECT count(*) FROM internal.activity_log_meta` = 1.
  Ends with `RAISE NOTICE 'activity_days checks passed';` before `ROLLBACK`.

- [ ] **Step 2: Write the migration.** Table + index + `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (no policies) + `REVOKE ALL … FROM anon, authenticated`. `internal.activity_log_meta` with `INSERT … VALUES ((now() AT TIME ZONE 'utc')::date)`.
  - `internal.log_resident_activity_day()`: `AFTER UPDATE OF last_active ON public.profiles FOR EACH ROW WHEN (NEW.last_active IS NOT NULL AND (OLD.last_active IS NULL OR (OLD.last_active AT TIME ZONE 'utc')::date <> (NEW.last_active AT TIME ZONE 'utc')::date))`; body inserts `(NEW.id, NEW.community_code, (NEW.last_active AT TIME ZONE 'utc')::date)` only when `NEW.role = 'resident' AND NOT NEW.exclude_from_leaderboard AND NEW.community_code IS NOT NULL`, `ON CONFLICT DO NOTHING`. `SECURITY DEFINER` (the heartbeat runs as the resident, who has no rights on the table).
  - `internal.anonymise_activity_days()`: `BEFORE DELETE ON public.profiles`; one `v_new uuid := gen_random_uuid()`; `UPDATE public.resident_activity_days SET user_id = v_new WHERE user_id = OLD.id`; `RETURN OLD`. `SECURITY DEFINER`.
  - Header comment: why (spec "Why"), the owner decisions (hidden-status, anonymise on delete), "apply via SQL editor".

- [ ] **Step 3: Owner applies the migration in the Supabase SQL editor, then runs the verification script there.** Expected: `NOTICE: activity_days checks passed` and nothing persisted (ROLLBACK). Stop and report if any check raises.

- [ ] **Step 4: Commit (Miyora)**

```bash
git add supabase/migrations/20261029120000_resident_activity_days.sql supabase/tests/20261029_activity_days_check.sql
git commit -m "feat(insights): daily resident activity log from the presence heartbeat"
```

### Task 2: Shared action signals, weekly RPC, tile RPC update (Miyora)

**Files:**
- Create: `supabase/migrations/20261029120100_weekly_active_residents.sql`
- Modify: `supabase/tests/20261029_activity_days_check.sql` (append RPC checks)

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `internal.resident_action_user_ids(p_community_code text, p_start timestamptz, p_end timestamptz) RETURNS SETOF uuid` — union of: posts, comments (both `COALESCE(is_hidden,false)=false`), help_requests, reservations, marketplace_items, post_likes (via posts), event_rsvps (via events), survey_responses (via surveys, as `compute_community_metrics` scopes it), connection_requests (`author_id`); each `created_at >= p_start AND created_at < p_end`; filtered to ids whose **current** profile is `role='resident' AND NOT exclude_from_leaderboard`.
- Produces: `public.get_weekly_active_residents(p_community_code text, p_week_starts date[]) RETURNS TABLE(week_start date, active integer, tracked boolean)` — per input Monday `w`: `active` = count distinct of (log `user_id` where `community_code = p_community_code AND day BETWEEN w AND w + 6`) ∪ `internal.resident_action_user_ids(code, w::timestamptz, (w + 7)::timestamptz)`; `tracked` = `w + 6 >= (SELECT started_on FROM internal.activity_log_meta)`. Caller check per Global Constraints; raise `'Not authenticated'` when `auth.uid()` is null.
- Produces: `public.get_active_resident_count` (same signature/return) whose `signals` CTE = existing `profiles.last_active BETWEEN p_start AND p_end` branch ∪ log users with `day BETWEEN p_start::date AND p_end::date` ∪ `internal.resident_action_user_ids(p_community_code, p_start, p_end)`; roster join kept as today.

- [ ] **Step 1: Append RPC checks to the verification script** (still in the same `BEGIN … ROLLBACK`): `set_config('request.jwt.claims', json_build_object('sub', <a TREND1 property manager auth id>, 'role','authenticated')::text, true)` + `SET LOCAL ROLE authenticated`, then assert:
  - `get_weekly_active_residents('TREND1', ARRAY[<this Monday>])` returns 1 row, `tracked = true`, `active >= 1` (the resident logged in check 1).
  - For last week's Monday the row exists and `active >= 0` (no comparison with the digest: live action counts can shrink after content is deleted).
  - A Monday before `started_on` returns `tracked = false`.
  - `get_active_resident_count('TREND1', now() - interval '30 days', now())` returns without error (the owner compares it with the pre-migration value by hand in Step 3).
  - As `anon` (`RESET ROLE; SET LOCAL ROLE anon`) the weekly RPC raises.

- [ ] **Step 2: Write the migration** with the three functions above. `resident_action_user_ids` is `STABLE`, lives in `internal` (not exposed to PostgREST), no caller check of its own (callers check). Header comment links the spec's "One definition of active".

- [ ] **Step 3: Owner records today's tile value** (Insights → Active residents, 30 days, TREND1), applies the migration in the SQL editor, runs the script. Expected: `NOTICE: activity_days checks passed`; tile value afterwards ≥ recorded value.

- [ ] **Step 4: Commit (Miyora)**

```bash
git add supabase/migrations/20261029120100_weekly_active_residents.sql supabase/tests/20261029_activity_days_check.sql
git commit -m "feat(insights): weekly active residents RPC; active count adds the activity log"
```

### Task 3: Week merge and marker helpers (portal)

**Files:**
- Create: `lib/activity-trend.ts`
- Test: `tests/unit/activity-trend.test.ts`

**Interfaces:**
- Consumes: `WeekWindow` from `lib/insights.ts`.
- Produces:
  - `type ActivityWeek = { weekStart: string /* YYYY-MM-DD */; label: string; tookPart: number | null; quiet: number | null; active: number | null; tracked: boolean; pctActive: number | null; pctTookPart: number | null; markers: Marker[] }`
  - `type Marker = { kind: "event" | "alert"; title: string }`
  - `type WeeklyActiveRow = { week_start: string; active: number; tracked: boolean }`
  - `mergeActivityWeeks(weeks: WeekWindow[], tookPart: Map<string, number>, activeRows: WeeklyActiveRow[], residents: number, markers: { kind: Marker["kind"]; title: string; at: string /* ISO */ }[]): ActivityWeek[]`
  - `activityHeadline(week: ActivityWeek | undefined, residents: number): string | null`
  - `trackingNote(startedOn: string | null): string | null` (null when every shown week is tracked — caller decides; this just formats the copy from Global Constraints)

- [ ] **Step 1: Write failing tests** in `tests/unit/activity-trend.test.ts` (node:test, `assert/strict`, style of `tests/unit/insights.test.ts`), using `lastWeeks(new Date(Date.UTC(2026, 9, 29, 15)), 4).slice(0, -1)` as weeks:
  - `quiet is active minus tookPart`: tookPart 11, active 30 → `{ tookPart: 11, quiet: 19, active: 30 }`.
  - `active never below tookPart`: tookPart 14, active 12 → `active 14, quiet 0`.
  - `untracked weeks have null quiet`: tracked false, active 9, tookPart 9 → `quiet null, active 9, tracked false`.
  - `missing digest`: no tookPart entry, tracked, active 7 → `tookPart null, quiet 7, active 7`.
  - `pct uses residents and rounds`: residents 43, active 30, tookPart 11 → `pctActive 70, pctTookPart 26`.
  - `pct is null when no residents`: residents 0 → both pct `null`.
  - `markers bucket by UTC week`: event `at: "2026-10-26T03:30:00Z"` (Sun 23:30 EDT) lands in week `2026-10-26`, not `2026-10-19`; two events in one week → `markers.length === 2`; alert keeps `kind: "alert"`; marker outside all weeks is dropped.
  - `headline`: `activityHeadline({active:30,tookPart:11,pctActive:70,…}, 43)` → `"30 residents active last week · 70% of 43 · 11 took part"`; untracked week → `"11 residents took part last week"`; undefined → `null`.
  - `trackingNote("2026-10-29")` → `"App-open tracking started 29 Oct 2026; earlier weeks show taking part only."`

- [ ] **Step 2: Run** `npm run test:unit` — Expected: the new file FAILS (module not found).

- [ ] **Step 3: Implement** `lib/activity-trend.ts`. Pure, no Supabase imports; week key = `start.toISOString().slice(0,10)`; marker bucket = the week whose `[start, start+7d)` contains `at`; `Math.round` for percentages.

- [ ] **Step 4: Run** `npm run test:unit` — Expected: all tests PASS (78 existing + new).

- [ ] **Step 5: Commit**

```bash
git add lib/activity-trend.ts tests/unit/activity-trend.test.ts
git commit -m "feat(insights): merge weekly activity, took part and PM markers"
```

### Task 4: Stacked activity chart (portal)

**Files:**
- Modify: `components/insights/InsightsCharts.tsx` (replace `WeeklyTookPartChart`, `WeeklyPoint`, `describeWeekly`)

**Interfaces:**
- Consumes: `ActivityWeek` from Task 3.
- Produces: `export function WeeklyActivityChart({ data }: { data: ActivityWeek[] })`.

- [ ] **Step 1: Implement** `WeeklyActivityChart`: Recharts `BarChart` with two `Bar`s sharing `stackId="a"` — `tookPart` (`#d95926`, bottom) and `quiet` (`#16A3B3`, `fillOpacity 0.55`, top, rounded top corners); a faint dashed `ReferenceLine x={label}` for each week with markers (alert colour if any alert, else neutral); a custom `XAxis` tick that draws ◆ glyphs under marked weeks (alert `#E8C547`, event neutral). Custom tooltip: week label, "{active} active ({pctActive}% of residents)", "{tookPart} took part", "{quiet} quietly active" or "Quiet activity not tracked yet" when `!tracked`, then marker titles. Keep `figure` + `sr-only figcaption` (text lists each week's numbers and markers; untracked weeks say "took part only"); no `role="img"`. Empty `data` → reuse today's empty-state copy. Legend row above the chart: Took part · Quietly active · ◆ Your event · ◆ Your alert.

- [ ] **Step 2: Verify** `npx tsc --noEmit` and `npx eslint components/insights/InsightsCharts.tsx` — Expected: no output / clean.

- [ ] **Step 3: Commit**

```bash
git add components/insights/InsightsCharts.tsx
git commit -m "feat(insights): stacked took-part / quietly-active weekly chart"
```

### Task 5: Wire the Insights page (portal)

**Files:**
- Modify: `app/(dashboard)/dashboard/communities/[id]/insights/page.tsx` (data loads near lines 111–160, weekly merge near 182–193, panel near 276–284)

**Interfaces:**
- Consumes: `get_weekly_active_residents` (Task 2), `mergeActivityWeeks` / `activityHeadline` / `trackingNote` (Task 3), `WeeklyActivityChart` (Task 4).

- [ ] **Step 1: Add three reads to the existing `Promise.all`:** `supabase.rpc("get_weekly_active_residents", { p_community_code: code, p_week_starts: weeks.map(w => isoDate(w.start)) })`; events `id, title, event_date` with `event_date` in `[weeks[0].start, weeks.at(-1).end)` and `.eq("community_code", code)`; alerts `id, title, created_at` in the same range. Add their errors to `loadError`. Tracking start = earliest `week_start` with `tracked` true (null if none untracked → no note).

- [ ] **Step 2: Replace the weekly merge** with `mergeActivityWeeks(weeks, tookPartByWeek, rpcRows, residentCount, markers)`; keep the existing "trim leading weeks with no data" behaviour (drop leading weeks where `tookPart === null && active === null`).

- [ ] **Step 3: Replace the panel:** title `"Resident activity, by week"`; subtitle `"Took part = posted, commented, asked for help, RSVPed, answered a survey or used Connect (same as the Weekly Summary) · Quietly active = opened the app, liked, booked or listed something · last {TREND_WEEKS} completed weeks"`; headline line from `activityHeadline` (last element of the merged weeks); `<WeeklyActivityChart data={…} />`; tracking note under the chart when non-null.

- [ ] **Step 4: Verify** `npx tsc --noEmit`, `npx eslint "app/(dashboard)/dashboard/communities/[id]/insights/page.tsx"`, `npm run test:unit`, `npm run build` — Expected: all clean/PASS, build succeeds.

- [ ] **Step 5: Verify in the browser** (`npm run dev`, sign in as a TREND1 PM, open Insights): bars render, weeks before tracking show orange only with the note, a marker appears under the week of the 11/01 event, hover shows counts and %, tile "Active residents" ≥ the value recorded in Task 2 Step 3.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/communities/[id]/insights/page.tsx"
git commit -m "feat(insights): resident activity chart on the Insights tab"
```

### Task 6: Ship

- [ ] **Step 1:** Whole-branch code review (both repos) before merging.
- [ ] **Step 2:** Merge Miyora `feat/activity-trend` → `master` and push (migrations already applied in Tasks 1–2).
- [ ] **Step 3:** Merge portal `feat/activity-trend` → `main`, push, `vercel --prod` (owner approves the deploy).
- [ ] **Step 4:** Update memory `project_resident_insights.md`: log live since `<started_on>`, tile = log ∪ last_active ∪ actions, chart definitions.
