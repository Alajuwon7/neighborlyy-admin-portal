# E2E Testing with Playwright

## Prerequisites

E2E tests require a running Supabase instance and the following environment variables in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The `SUPABASE_SERVICE_ROLE_KEY` is needed by the global setup script to create and manage the test user (`e2e-test@miyora.com`).

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run in UI mode (interactive browser panel)
npm run test:e2e:ui

# Run in headed mode (see the browser)
npm run test:e2e:headed

# Run in debug mode (step through tests)
npm run test:e2e:debug
```

## How It Works

### Global Setup (`tests/global-setup.ts`)

Before any tests run, the global setup script:

1. **Creates a test user** in Supabase auth (`e2e-test@miyora.com`) with a confirmed email using the Admin API — no email verification needed
2. **Creates a `property_managers` row** for that user
3. **Cleans up any existing communities** from previous test runs
4. **Logs in via the browser** and saves the authenticated session to `tests/.auth/session.json`

All tests then reuse this saved session (via Playwright's `storageState`), so they start already authenticated.

### Test Structure

```
tests/
  global-setup.ts        # Seed test user + save auth session
  .auth/                 # Saved session state (gitignored)
  e2e/                   # End-to-end test specs
    onboarding.spec.ts   # Full onboarding flow tests
  fixtures/              # Shared test data constants
    test-data.ts
  helpers/               # Reusable test utilities
    auth.helper.ts       # Login, onboarding flow, step navigation
```

## Payment Bypass

When `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is **not set**, the billing step (Step 5) shows a "Skip Payment for Now (Testing Only)" button. This allows completing onboarding without Stripe integration.

The bypass creates a trial account with:
- **Tier:** Professional
- **Status:** trial
- **Trial period:** 14 days

This button is automatically hidden when Stripe environment variables are configured.

## Test Data

Tests use constants from `tests/fixtures/test-data.ts`:

| Constant | Value |
|---|---|
| Test user email | `e2e-test@miyora.com` |
| Test user password | `TestPassword123!` |
| Property name | Cypress Gardens |
| Community code | `CYPGRDNS` |
| Admin code | `TEST1234` |
| Facilities | Fitness Center, Swimming Pool, Clubhouse |

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Import helpers from `tests/helpers/` and fixtures from `tests/fixtures/`
3. Tests automatically start authenticated — no login step needed
4. Use `skipToOnboardingStep(page, stepNumber)` to jump to a specific step
5. Use `completeOnboardingFlow(page, options)` to run through the full flow

## Troubleshooting

| Issue | Fix |
|---|---|
| "SUPABASE_SERVICE_ROLE_KEY required" warning | Add the key to `.env.local` (get it from Supabase Dashboard > Settings > API) |
| Tests time out on login | Make sure dev server is running (`npm run dev`) or the Supabase URL is reachable |
| Skip payment button not visible | Ensure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is **not** set in `.env.local` |
| Browser not installed | Run `npx playwright install chromium` |
| "community_code unique constraint" error | Global setup failed to clean up — manually delete test communities in Supabase |

## Configuration

- **Config file:** `playwright.config.ts` (project root)
- **Base URL:** `http://localhost:3000` (override with `PLAYWRIGHT_BASE_URL`)
- **Browser:** Chromium only
- **Retries:** 1
- **Artifacts:** Screenshots on failure, video + trace on first retry
