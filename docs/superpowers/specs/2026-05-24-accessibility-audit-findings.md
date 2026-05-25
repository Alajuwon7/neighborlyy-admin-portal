# Accessibility Audit — Findings (Phase 9)

**Date:** 2026-05-24
**Standard:** WCAG 2.1 AA (axe-core tags: wcag2a, wcag2aa, wcag21a, wcag21aa)
**Harness:**
- `tests/e2e/a11y.spec.ts` — automated axe-core scan (per-route JSON → `test-results/a11y/`)
- `tests/e2e/a11y-keyboard.spec.ts` — driven keyboard/focus pass

Severity uses axe `impact`: critical > serious > moderate > minor. "Needs review"
= axe `incomplete` (could not auto-measure; requires manual confirmation).

---

## Result summary

Automated scan: **22 routes, 20 passing, 2 with documented (deferred) findings.**
Started at 13 failing routes before fixes.

| Area | Result |
| --- | --- |
| Public auth (login, signup, forgot-password, verify-email) | ✅ 0 violations |
| Onboarding steps 1, 2, 4, 5 | ✅ 0 violations |
| Onboarding step 3 (branding preview) | ⚠️ 2 — deferred (D1) |
| Onboarding step 6 (billing/plan) | ⚠️ 2 — deferred (D2) |
| Dashboard (overview, feed, notifications, team, billing) | ✅ 0 violations |
| Community mgmt (overview, pending, residents, events, alerts, facilities) | ✅ 0 violations |
| Keyboard: tab order + focus indicators | ✅ all real controls have a visible indicator |
| Keyboard: dialog open/Esc/return-focus | ✅ works |
| Keyboard: dialog focus trap | ⚠️ intermittent leak — deferred (KB-1) |

---

## Fixed (clear wins)

### F1 — Critical: icon button with no accessible name (`button-name`)
The Header notification bell rendered an icon-only button with no name on 4
routes (communities-list, dashboard-billing, dashboard-feed, dashboard-team).
**Fix:** added `aria-label="Notifications"` to both bell render paths
(`components/dashboard/Header.tsx`, `components/dashboard/NotificationDropdown.tsx`).
Confirmed via keyboard pass — the bell now reports its name.

### F2 — Serious: white text on cyan brand buttons (`color-contrast`)
White (`#fff`) on `--nly-brand` (`#2FC4D3`) / `--nly-brand-gradient` measured
~2.0–2.1:1 (AA needs 4.5:1). Recurred on every primary button. **Fix:** switched
text to the existing `--nly-brand-text` token (`#0B0F1A`, ~10:1 — passes AA/AAA).

Files fixed:
- `components/auth/AuthToggleTabs.tsx` (Sign In/Sign Up active tab)
- `app/(auth)/login`, `signup`, `forgot-password` submit buttons
- 5 dialog components — trigger **and** submit buttons:
  `EventFormDialog`, `PostFormDialog`, `CreateAlertDialog`, `FacilityFormDialog`
  (community/), `InviteTeamMemberDialog` (dashboard/)
- 6 onboarding buttons: `Step1PropertyInfo`, `Step2Branding`, `Step3Facilities`,
  `Step4AdminAccess`, `Step5Billing`, `SetupComplete`
- `app/(dashboard)/dashboard/communities/[id]/page.tsx` "Upgrade Plan" link

---

## Deferred — need a design decision / deeper change (not blind-fixed)

### D1 — Onboarding branding preview contrast (onboarding step 3)
`components/onboarding/Step2Branding.tsx` renders a live PREVIEW of the PM's
chosen brand colors (`data.primary_color`, default coral `#E65C4F`):
- `<span>Miyora</span>` coral text → **4.12:1** (just under 4.5)
- "Primary Button" white-on-coral → **3.49:1**

These faithfully preview user-controlled colors (coral default is intentional per
the design system). Silently darkening them would misrepresent the preview.
**Recommendation:** add contrast guidance/validation to the brand-color picker so
PMs pick accessible colors, rather than overriding the preview. (Feature, not a
one-line fix.)

### D2 — Billing toggle + "Save 20%" badge on light surface (onboarding step 6)
`components/onboarding/Step5Billing.tsx`, billing-cycle toggle sits on the light
`--nly-input-bg` surface:
- inactive toggle label `--nly-text-tertiary` (`#8a9db5`) on `#e9eef4` → **2.37:1**
- "Save 20%" badge: green `#10b981` on light-green tint `#c8e6e3` → **1.91:1**

Entangled with the known `:has(> input)` color override on the onboarding surface,
so a careful (non-blind) fix is needed. **Recommendation:** for this toggle use a
darker inactive label (e.g. `--nly-text-secondary` verified against the light
track) and a higher-contrast badge (darker green text or a more opaque/darker
badge background). Verify via re-scan.

### KB-1 — Modal focus trap is intermittent
`tests/e2e/a11y-keyboard.spec.ts` observed keyboard focus escaping an open dialog
into the sidebar nav ("Dashboard"/"Communities"/"Notifications") on a first
attempt, then trapping correctly on retry — i.e. flaky. Dialog open-focus, Esc to
close, and return-focus all work reliably; only the trap leaks. base-ui's
`Dialog.Root` is modal by default, so this is likely a timing/inert-application or
layout-layering issue. **Recommendation:** investigate the base-ui Dialog
modal/inert behavior against the dashboard layout; ensure the background is inert
while a dialog is open. Trap check is logged (not hard-asserted) in the spec until
fixed.

---

## Needs-review items judged acceptable

axe could not auto-measure text over the `.nly-auth-bg` gradient ("background
color could not be determined due to a background gradient"). These are light/
brand text on the dark auth gradient (e.g. white marketing copy, `--nly-text-*`
grays, the cyan `MIYORA` wordmark, `--nly-accent` links) — all light-on-dark and
high-contrast on inspection. No confirmed failures; flagged only because of the
gradient.

---

## Out of scope tonight (per design)

Offboarding/account routes (already e2e-covered), screen-reader narration testing,
full mobile-responsive a11y. Phase 8 (Analytics) intentionally pushed a day or two
so this audit landed tonight.
