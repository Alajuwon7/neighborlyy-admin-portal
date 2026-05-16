import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  // Both Phase 3 and Phase 4 Screen-5 seed deletion_requests for the SHARED
  // test PM. The `deletion_requests_one_open_per_pm_idx` partial unique index
  // forbids two concurrent open requests. Run a single worker locally (same as
  // CI) to guarantee describe blocks never overlap on the shared PM row.
  workers: 1,
  reporter: "html",

  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "on-first-retry",
    trace: "on-first-retry",
    storageState: "tests/.auth/session.json",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
      },
});
