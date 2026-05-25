# Accessibility Audit — Findings (Phase 9)

**Date:** 2026-05-24
**Standard:** WCAG 2.1 AA (axe-core tags: wcag2a, wcag2aa, wcag21a, wcag21aa)
**Harness:** `tests/e2e/a11y.spec.ts` (axe-core + Playwright). Per-route JSON is
written to `test-results/a11y/`.

Severity uses axe `impact`: critical > serious > moderate > minor. "Needs review"
= axe `incomplete` (could not auto-measure; requires manual confirmation).

---

## Status summary

| Area | Scanned | Result |
| --- | --- | --- |
| Public auth pages | ✅ | **0 violations** after fix (was 2 serious) |
| Onboarding (6 steps) | ⏳ blocked | needs `SUPABASE_SERVICE_ROLE_KEY` to authenticate |
| Dashboard (5 routes) | ⏳ blocked | needs key (auth + seeded community) |
| Community mgmt (6 routes) | ⏳ blocked | needs key (auth + seeded community) |
| Manual keyboard/focus pass | ⏳ pending | runs after authed scan |

> **Blocker:** the authenticated scan requires `SUPABASE_SERVICE_ROLE_KEY` in
> `.env.local` (global-setup uses it to log the test PM in and save the session;
> the spec uses it to seed a temporary community). Without it, authenticated
> routes redirect to `/login` and get scanned as the login page.

---

## Confirmed & FIXED — Public auth pages

### F1. Primary buttons: white text on cyan brand — serious (contrast 2.1:1) ✅ FIXED

White (`#ffffff`) text on the `--nly-brand` cyan (`#2FC4D3`) / `--nly-brand-gradient`
measured **2.1:1**, below the 4.5:1 AA minimum for normal text.

Affected (auth card):
- `components/auth/AuthToggleTabs.tsx` — active Sign In / Sign Up tab (solid `--nly-brand`)
- `app/(auth)/login/page.tsx` — "Sign In" submit (gradient)
- `app/(auth)/signup/page.tsx` — "Sign Up" submit (gradient)
- `app/(auth)/forgot-password/page.tsx` — "Send Reset Link" submit (gradient)

**Fix:** switched button text from `#fff` to the existing `--nly-brand-text`
token (`#0B0F1A` dark navy), which the design system already defines for text on
the brand color. Contrast on `--nly-brand` rises to ~10:1 (passes AA/AAA).
**Re-scan: login + signup now report 0 violations.**

> **Systemic note:** `--nly-brand` is used as a button background in ~55 places
> across ~29 files. White-on-cyan fails AA wherever it occurs, so the same fix
> very likely applies to primary buttons on the (not-yet-scanned) authenticated
> routes. Those will be enumerated and fixed precisely once the authed scan runs.

### F2. Text over the auth gradient — needs review (1 per public page)

axe could not measure several text nodes because `.nly-auth-bg` is a gradient
("background color could not be determined due to a background gradient"). These
are white/light/`--nly-text-*` text over the dark gradient (very likely passing)
plus the brand-cyan `MIYORA` wordmark and `--nly-accent` links. To be confirmed
in the manual pass — none are confirmed failures.

---

## Pending — Authenticated routes & manual pass

To be populated after `SUPABASE_SERVICE_ROLE_KEY` is set and the full scan +
manual keyboard/focus pass run.
