# UX Enhancements: Onboarding Polish + Real-Time Dashboard

**Date:** 2026-04-08
**Status:** Approved
**Scope:** 3 phases across onboarding flow, dashboard experience, and premium command center

---

## Problem

The admin portal is functional but static. Property managers log in, see numbers, and click through pages — but the dashboard doesn't guide them, reward them, or feel alive. Onboarding collects data but doesn't help users fill it faster or feel confident about their choices. There's no sense of what's happening in their communities right now.

## Goals

1. Make onboarding faster and more confidence-building through smart shortcuts and social proof
2. Make the dashboard feel like a friendly assistant that surfaces what matters
3. Add ambient life indicators so the portal feels responsive and aware
4. Create a premium Command Center as a revenue-driving upsell for Business/Enterprise tiers

---

## Phase 1: Smart Nudges & Ambient Awareness

**Priority:** Highest — immediate dashboard impact, no onboarding flow changes needed.

### 1.1 Smart Nudge Cards

Dismissible action cards shown below the summary cards on the dashboard. Max 3 visible at a time. Friendly assistant tone.

**Nudge types (computed server-side from real data):**

| Trigger | Nudge | Action Link |
|---------|-------|-------------|
| Pending residents > 0 | "You've got {n} new residents waiting! Timely approvals make a great first impression." | → Pending approvals page |
| No events in 7+ days | "It's been {n} days since your last event. Communities with weekly events keep residents 40% more engaged." | → Create event |
| Resident milestone (25, 50, 100) | "🎉 {community} just hit {n} residents! Consider posting a welcome message to celebrate." | → Create post |
| No posts in 7+ days | "Your residents haven't heard from you in a while. A quick update goes a long way!" | → Create post |
| Rainy/cold weather forecast | "Rainy weekend ahead in {city}. Great time for an indoor community event!" | → Create event |
| Holiday/long weekend approaching | "Long weekend ahead — schedule something fun for your community!" | → Create event |

**Implementation details:**
- New server function `computeNudges(pm, communities)` in `lib/nudges.ts`
- Queries: pending residents count, last event date, resident count milestones, last post date
- Weather: free API (OpenWeatherMap or similar) using community city/state
- Rendered as a client component `NudgeCards` with dismiss (localStorage persistence)
- Each nudge has: emoji icon, title, subtitle with stat, action link, dismiss button
- Staggered entrance animation via motion

### 1.2 Ambient Awareness

**Header enhancements:**
- Time-of-day + day-of-week greeting: "Happy Friday morning, Alajuwon! 👋" / "Winding down, Alajuwon — here's your evening recap"
- Active resident indicator: "{n} residents active today" with green pulse dot (computed from profiles with recent `last_active` or similar)
- Already partially implemented (time-based greeting exists) — enhance with day-of-week and resident count

**Summary card upgrades:**
- Trend indicator: "↑ 12% vs last week" or "↓ 3% vs last week" with green/red color
- Requires tracking historical counts (new `analytics_snapshots` table or computed from existing data)
- Animate value changes with motion number counter

**Activity feed upgrades:**
- Group items by time: "Today", "Yesterday", "This Week"
- Inline quick-action buttons: "Approve" on pending residents, "View" on events
- "New activity" indicator that slides in when new items arrive (poll every 30s or Supabase Realtime)

---

## Phase 2: Guided Onboarding

**Priority:** High — improves conversion and first impression.

### 2.1 Smart Shortcuts (Step 2: Property Info)

**URL auto-fill:**
- New optional field at top of Step 2: "Got a website? Paste it and we'll fill in the details"
- On paste/blur, call a server action that fetches the URL and extracts:
  - Property name (from `<title>` or `<meta og:title>`)
  - Address (from structured data, `<address>` tags, or meta tags)
  - Unit count (from page content heuristics)
- Pre-fills fields, user can edit. Shows "Auto-filled from website ✓" badge
- Graceful fallback: if extraction fails, just proceed with manual entry

**Address autocomplete:**
- Google Places Autocomplete on the street address field
- Auto-fills city, state, zip_code from selected place
- Requires Google Maps API key (new env var `NEXT_PUBLIC_GOOGLE_PLACES_KEY`)

**Smart defaults by property type:**
- When property type is selected in Step 2, store it for Step 4
- Step 4 (Amenities): pre-select relevant amenities based on property type:
  - `apartment` → pool, fitness center, clubhouse, parking, laundry
  - `student` → game room, study lounge, computer lab, bike storage
  - `senior` → garden, library, wellness center, community kitchen
  - `condo` → pool, fitness center, concierge, rooftop

### 2.2 Social Proof Tips

Contextual tip component shown below each step's form fields. Friendly tone, data-backed.

| Step | Tip |
|------|-----|
| 2 (Property Info) | "Properties with a website get 2x more resident signups" (if URL empty) |
| 3 (Branding) | "Most communities use their brand colors for a cohesive feel" |
| 4 (Amenities) | "Communities with 5+ amenities see 2x resident engagement" |
| 4 (Amenities) | "Similar {property_type} properties typically list 6-8 amenities" |
| 5 (Admin Access) | "Pro tip: Share this code in your welcome packet or lobby signage" |
| 6 (Billing) | "Best for properties with {unit_count} units" (on recommended plan) |
| 6 (Billing) | Personalized time estimate: "You'll be fully set up in ~2 minutes" |

**Implementation:** New `OnboardingTip` component — icon + text + subtle background, animated fade-in.

### 2.3 Auto-Extract Branding Colors (Step 3)

- If a website URL was provided in Step 2, attempt to extract dominant colors
- Server action fetches the page, extracts colors from CSS custom properties, meta theme-color, or dominant image colors
- Pre-fills primary_color and accent_color, user can override
- Shows "Extracted from your website ✓" badge
- Fallback: use current defaults if extraction fails

### 2.4 Transition Polish

- Animated step transitions: current step slides out left, new step slides in from right (motion)
- Step-completion micro-celebration: checkmark burst animation (CSS keyframes, not confetti)
- Estimated time remaining in step header: "~4 min left" counting down based on current step
- Progress bar animation already exists — enhance with smoother easing

---

## Phase 3: Command Center (Premium Upsell)

**Priority:** Medium — revenue driver, builds on Phase 1 + 2 foundation.
**Gated behind:** Business and Enterprise subscription tiers.

### 3.1 Command Center Page

New route: `/dashboard/command-center`

**For premium tiers (Business/Enterprise):**
- Unified real-time activity timeline across ALL communities in the organization
- Supabase Realtime subscriptions — instant updates, no polling
- Filterable by: community, event type (resident_joined, event_created, alert_sent, help_request, reservation), priority
- Inline quick-action buttons: approve residents, dismiss alerts, view events
- Time-grouped: "Just now", "Earlier today", "Yesterday"
- Search across activity items

**For lower tiers (Starter/Professional):**
- Sidebar nav item visible but shows a lock icon
- Clicking it shows a blurred preview of the command center with:
  - "Upgrade to Business" CTA button
  - Feature highlights: "See live activity across all your properties"
  - Social proof: "Used by 200+ property management companies"

### 3.2 Sidebar & Dashboard Upsell

- Sidebar: "Command Center" nav item with ⚡ icon, lock badge on lower tiers
- Dashboard: upsell card in the activity feed area for lower tiers: "See live activity across all your properties → Upgrade"

### 3.3 Technical: Supabase Realtime

- Subscribe to changes on: `communities`, `profiles` (new residents), `events`, `alerts`, `posts`
- Filter subscriptions by organization's community IDs
- Transform database changes into activity feed items client-side
- Graceful degradation: fall back to polling (30s) if Realtime connection drops

---

## Architecture Notes

### New files to create
- `lib/nudges.ts` — server-side nudge computation logic
- `components/dashboard/NudgeCards.tsx` — dismissible nudge card UI
- `components/onboarding/OnboardingTip.tsx` — social proof tip component
- `app/(dashboard)/dashboard/command-center/page.tsx` — premium command center
- `components/dashboard/CommandCenterUpsell.tsx` — blurred preview upsell

### Files to modify
- `app/(dashboard)/dashboard/page.tsx` — add NudgeCards, enhance header greeting, trend data
- `components/dashboard/Header.tsx` — active resident count, enhanced greeting
- `components/dashboard/SummaryCard.tsx` — trend indicator
- `components/dashboard/ActivityFeed.tsx` — time grouping, inline actions, live indicator
- `components/dashboard/Sidebar.tsx` — command center nav item
- `app/onboarding/page.tsx` — step transitions, time estimate
- `components/onboarding/Step1PropertyInfo.tsx` — URL auto-fill, address autocomplete
- `components/onboarding/Step2Branding.tsx` — color extraction
- `components/onboarding/Step3Facilities.tsx` — smart defaults by property type
- `components/onboarding/Step5Billing.tsx` — personalized recommendation

### New environment variables
- `NEXT_PUBLIC_GOOGLE_PLACES_KEY` — Google Places Autocomplete (Phase 2)
- `OPENWEATHERMAP_API_KEY` — weather-based nudges (Phase 1, optional)

### New database considerations
- Weather nudges: use community's city/state, cache weather data (avoid excessive API calls)
- Trend data: either query historical snapshots or compute from existing timestamps
- Command Center: Supabase Realtime subscriptions, no new tables needed

---

## Implementation Order

1. **Phase 1** — Smart Nudges + Ambient Awareness (1-2 sessions)
2. **Phase 2** — Guided Onboarding enhancements (1-2 sessions)
3. **Phase 3** — Command Center premium page (1 session)

Each phase is independently shippable. Phase 1 delivers the most visible improvement with the least risk.

---

## Out of Scope

- Live phone mockup preview during onboarding
- Welcome video at completion
- AI-generated community descriptions (consider for future)
- Push notifications (separate feature)
- Real-time filtering across all properties for non-premium tiers
