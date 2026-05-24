# Accessibility Audit — Design (Phase 9)

**Date:** 2026-05-24
**Owner:** Alajuwon Thomas
**Status:** Approved (design)

## Goal

Wrap up the Phase 9 accessibility audit for the Miyora admin portal's core
property-manager flows. Produce a reusable automated a11y test harness, run a
driven manual keyboard/focus pass, log all findings ranked by severity, and fix
the unambiguous issues tonight. Larger structural issues are documented as
ranked follow-ups rather than forced into one session.

## Standard

WCAG 2.1 Level AA. axe-core run with tags: `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`. The portal is dark-mode only, so color-contrast checks run against
the actual rendered `--nly-*` theme tokens.

## Scope

Core PM flows only:

- **Public (no auth):** `/login`, `/signup`, `/forgot-password`, `/reset-password`
- **Onboarding:** all 6 steps
- **Dashboard:** `/dashboard`, `/dashboard/feed`, `/dashboard/notifications`,
  `/dashboard/team`, `/dashboard/billing`
- **Community management:** `/dashboard/communities/[id]` plus `pending`,
  `residents`, `events`, `alerts`, `facilities`

**Out of scope tonight:** offboarding/account routes (already e2e-covered),
screen-reader narration testing, full mobile-responsive a11y.

## Approach

### 1. Automated layer

- Add dev dependency `@axe-core/playwright`.
- New spec `tests/e2e/a11y.spec.ts` reusing the existing `storageState`
  (`tests/.auth/session.json`) produced by `tests/global-setup.ts`, so scans of
  authenticated routes start logged in as the test PM (`e2e-test@miyora-app.com`).
- Community-management routes need a real `community.id`. Global setup
  deliberately removes communities (to force `/onboarding`), so the a11y spec
  seeds a throwaway community for the test PM via the service-role key in a
  `beforeAll`, captures its id, and deletes it in `afterAll` (mirrors the
  cleanup pattern in `onboarding.spec.ts`).
- Each route is visited, axe runs, and the spec asserts zero violations. On
  violations it serializes `{ rule, impact, help, nodes }` so the run yields a
  ranked report, not just a pass/fail.

### 2. Manual layer (Claude drives Playwright, no screenshots)

axe cannot catch keyboard/focus behavior. Driven manual pass over the
highest-traffic surfaces, logging observations as text findings (no screenshots):

- Tab order + visible focus ring through login, onboarding step navigation, and
  the dashboard sidebar/header.
- Modal behavior on at least one dialog (deny-pending modal and/or
  ShareCommunityCode modal): focus trap, Esc to close, focus returns to trigger.

### 3. Fixes

- **Fix tonight (clear wins):** missing form `<label>` / `aria-label`,
  button & icon-button accessible names, `alt` text, landmark roles, `aria-*` on
  custom controls, and color-contrast on `--nly-*` tokens. Per the project's
  UI-revision-rigor convention, contrast/visual fixes go through the
  frontend-design skill rather than blind CSS tweaks.
- **Document, don't force:** anything structural (e.g. a component needing
  rework) is logged as a ranked follow-up.

## Deliverables

- `tests/e2e/a11y.spec.ts` — reusable harness, runs in CI going forward.
- `docs/superpowers/specs/2026-05-24-accessibility-audit-findings.md` — findings
  report (per-route violations, severity, fixed-vs-deferred status, manual-pass
  notes).
- Committed fixes for the clear-win findings.

## Out-of-scope schedule note

Phase 8 (Analytics) is intentionally pushed a day or two so this audit lands
tonight.
