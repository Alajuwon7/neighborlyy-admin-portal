# Activity Trend — Design

Date: 2026-10-27 · Repos: Miyora (mobile + shared Supabase) and neighborlyy-admin-portal (Miyora PM portal)

## Why

A property manager wants to know **how much activity is going on inside their community**, week by
week. The chart does two jobs:

1. **Early warning.** A drop in quiet activity is the first sign residents are drifting away, weeks
   before complaints or move-outs. The PM's response is to give people a reason to come back (an
   event, a useful post, a Weekly Summary suggestion).
2. **Proof their effort works.** The PM sees the bump after their own events and alerts and can show
   it to a regional director or owner. (A later cross-community "super admin" view will reuse this
   data as percentages — not in scope here.)

Today this can't be charted: the only "opened the app" signal is `profiles.last_active`, which stores
the latest timestamp only, so re-running a past week undercounts everyone who has opened the app
since. The portal's weekly chart therefore shows only the digest's "took part" count.

## What counts (decided with the owner)

- **Active** in a week = the resident opened the app at all that week (quiet browsing counts), **or**
  did anything that counts as taking part.
- **Took part** = the existing Weekly Summary definition (`community_digests.active_residents`,
  computed by `internal.compute_community_metrics`). Unchanged.
- **Quietly active** = active − took part.
- Residents who turned off "Show my online status" never send the presence heartbeat. **They are not
  counted as quietly active; they only count when they take part.** No app change to collect opens
  separately. (Owner decision.)
- Residents only, same rule as every other metric: `role = 'resident'` and not
  `exclude_from_leaderboard` (no management accounts, no founder account).
- Weeks are ISO Monday–Sunday in UTC, same as the Weekly Summary.

## How it looks (decided with the owner: mockup "B, refined")

On the community **Insights** tab, replacing today's "took part by week" chart (`WeeklyTookPartChart`):

- One **stacked bar per completed week**: bottom slice "Took part" (orange `#d95926`), top slice
  "Quietly active" (brand `#16A3B3`, lighter). Full bar = active.
- **Counts on the bars; share of residents in the headline and hover**, e.g.
  "30 residents active last week · 70% of 43 · 11 took part". Hover per slice: week, count, %.
- **Markers for the PM's own actions:** events (◆ white/neutral) and alerts (◆ yellow `#E8C547`) under
  the week they happened, with a faint dashed guide line up through that week's bar. Hover shows the
  title(s). An event is placed by `event_date`; an alert by `created_at`.
- **History:** quiet activity before the log's start date can't be recovered. Weeks before the start
  show the "took part" slice only, with a short note under the chart ("App-open tracking started
  <date>; earlier weeks show taking part only"). Weeks are never shown as "0 quietly active" when the
  truth is "not tracked".
- Keep the existing accessibility pattern on Insights charts (sr-only figcaption with the numbers; no
  `role="img"` conflict with Recharts `accessibilityLayer`).
- Mockup: `.superpowers/brainstorm/63779-1793122305/content/activity-chart-b-v2.html` (gitignored).

The existing **"Active residents" tile** (30 days / range, `get_active_resident_count`) switches its
app-open signal from `profiles.last_active` to the new log, so the tile and the chart use one
definition and the tile stops undercounting for past windows.

## How it's built (owner agreed to this outline)

### Data — Miyora repo, one migration

- New table `public.resident_activity_days(user_id uuid, community_code text, day date,
  primary key (user_id, day))` — one row per resident per UTC day they had the app open. Index on
  `(community_code, day)`.
- Filled by a trigger on `profiles` `AFTER UPDATE OF last_active`, so **no app release is needed**
  (the app already writes `last_active` about once a minute while foregrounded — `src/hooks/usePresence.ts`).
  The trigger only inserts when the new `last_active` falls on a different UTC day than the old one
  (or old is null), and only for `role = 'resident' AND NOT exclude_from_leaderboard`; it uses
  `ON CONFLICT DO NOTHING`. This keeps writes to about one per resident per day.
- Stores the `community_code` at the time of activity (a resident who moves communities keeps their
  history where it happened). The resident filter (`role`, `exclude_from_leaderboard`) is applied
  **when the row is written**; weekly counts read the log by `community_code` alone and must **not**
  join today's roster, or past bars would shrink when someone moves out.
- **Account deletion keeps history anonymously (owner decision).** No FK to `profiles`. When a
  profile is deleted, a trigger replaces that person's `user_id` in the log with one fresh random
  uuid (the same one for all their rows, so weekly distinct counts are unchanged). The rows hold no
  name or content, so nothing ties them back to the person. Note: their posts/comments etc. are
  hard-deleted by the app's services anyway, so action-based counts for past weeks can still shrink —
  covered by `active = max(active, took_part)` against the frozen digest.
- RLS on, **no policies** for clients — nobody reads rows directly. PMs only ever see weekly totals.
- New read RPC (SECURITY DEFINER, `search_path` pinned, same caller check as
  `get_active_resident_count`: `auth_user_is_admin_in` OR `auth_user_manages_community` OR platform
  owner) returning, for a community and a list/range of ISO weeks: `week_start`, `active` (distinct
  residents in the log that week ∪ every action signal — see "One definition of active" below), and
  whether the log covered that week.
- `get_active_resident_count`: **add** the log as a signal; **keep** the existing
  `profiles.last_active BETWEEN …` branch and all other signals. The union can only raise the count,
  so the tile never drops on launch day (the log starts empty) and past windows keep today's floor.
  Also used by mobile admin analytics (`src/services/analytics.service.ts`) — that screen improves
  with no app release.

### One definition of active

Weekly `active` and the tile both count a resident as active if any of these happened in the window:
an app-open day in the log; `profiles.last_active` in the window (tile only — meaningless for past
weeks, harmless for windows ending now); **or** any action from the union of the two existing lists —
the "took part" sources in `compute_community_metrics` (posts, comments, help requests, survey
responses, Connect requests, RSVPs) **plus** the tile's extra signals in `get_active_resident_count`
(post likes, facility reservations, marketplace listings). Keep each source's existing filters
(e.g. hidden posts/comments excluded as the tile does today). A resident who hid their online status
and only likes or books shows up as "quietly active": they acted, but not in a way the digest counts
as taking part. That is consistent with the owner's rule (hidden-status residents never count for
just browsing). Put the shared list in one SQL helper so the tile and weekly RPC can't drift.
- Apply via the Supabase SQL editor (shared project — never `supabase db push` / `migration repair`
  from the portal repo).

### Portal

- Insights page reads the new RPC for the trend weeks plus `community_digests` (took part) as today,
  plus the community's events and alerts in the chart's date range for markers.
- Replace `WeeklyTookPartChart` with the stacked chart. Keep `lib/insights.ts`-style pure helpers with
  unit tests for the week merge (active, took part, quiet, coverage).
- Copy: section title/subtitle updated to describe both slices; note for untracked weeks.

## Goals / non-goals / anti-goals

- **Goal:** an honest weekly trend of total activity vs taking part, with the PM's actions marked.
- **Non-goals:** per-resident activity views; daily granularity in the UI; cross-community comparison;
  dashboard home card; any mobile app release; backfilling history.
- **Anti-goals:** showing which resident was active on which day anywhere; counting residents who hid
  their online status as quiet browsers; a "quietly active" slice that is negative or a bar that is
  shorter than its "took part" slice; claiming "0 quietly active" for weeks that weren't tracked;
  the chart and the Weekly Summary disagreeing on "took part".

## Calls I made (owner can veto)

- "Active" = union of both existing action lists (see "One definition of active"), so likes,
  bookings and marketplace listings count as quiet activity.
- The tile adds the log rather than replacing `last_active`, so it never drops at launch.

- Table name, shape, and trigger approach above.
- Weekly `active` is computed live from the log + participation tables, while `took part` comes from
  the frozen digest. Because services hard-delete content, live participation can shrink after the
  digest froze; the chart uses `active = max(active, took_part)` so a bar is never shorter than its
  orange slice.
- Log retention: keep indefinitely for now (rows hold no content, only "active on this day");
  revisit with the super-admin work.
- Markers use events and alerts only (not posts or surveys by management).
- Partial coverage: the week in which tracking starts is shown as tracked (it may undercount slightly);
  the note names the start date.

## Left to the builder

Exact RPC name/signature and return shape, chart component structure (Recharts as used elsewhere on
Insights), marker overlap handling when several events share a week, empty states, and test layout.
