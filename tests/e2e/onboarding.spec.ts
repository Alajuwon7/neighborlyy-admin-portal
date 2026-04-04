import { test, expect } from "@playwright/test";
import { TEST_PROPERTY, TEST_ADMIN } from "../fixtures/test-data";
import { skipToOnboardingStep, completeOnboardingFlow } from "../helpers/auth.helper";

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Session is pre-authenticated via global-setup storageState.
    // Global setup also cleans up any existing communities, so
    // login redirects to /onboarding.
    await page.goto("/onboarding");
  });

  test("should complete full onboarding with payment skip", async ({ page }) => {
    // Step 1: Property Info
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible();
    await expect(page.getByText(/property information/i)).toBeVisible();

    await page.getByLabel(/property name/i).fill(TEST_PROPERTY.name);
    await page.getByLabel(/community code/i).fill(TEST_PROPERTY.community_code);
    await page.getByLabel(/property type/i).selectOption(TEST_PROPERTY.property_type);
    await page.getByLabel(/street address/i).fill(TEST_PROPERTY.street_address);
    await page.getByLabel(/city/i).fill(TEST_PROPERTY.city);
    await page.getByLabel(/state/i).selectOption(TEST_PROPERTY.state);
    await page.getByLabel(/zip/i).fill(TEST_PROPERTY.zip_code);
    await page.getByLabel(/number of units/i).fill(TEST_PROPERTY.unit_count);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Branding
    await expect(page.getByText(/step 2 of 5/i)).toBeVisible();
    await expect(page.getByText(/community branding/i)).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Facilities
    await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
    await expect(page.getByText(/facilities & amenities/i)).toBeVisible();

    await page.getByRole("button", { name: /fitness center/i }).click();
    await page.getByRole("button", { name: /swimming pool/i }).click();
    await page.getByRole("button", { name: /clubhouse/i }).click();
    await expect(page.getByText(/3 selected/)).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Admin Access
    await expect(page.getByText(/step 4 of 5/i)).toBeVisible();
    await expect(page.getByText(/admin access/i)).toBeVisible();
    await page.getByLabel(/admin code/i).fill(TEST_ADMIN.admin_code);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Billing
    await expect(page.getByText(/step 5 of 5/i)).toBeVisible();
    await expect(page.getByText(/choose a plan/i)).toBeVisible();

    // Verify all 3 plan tiers display
    await expect(page.getByText("Starter")).toBeVisible();
    await expect(page.getByText("Professional")).toBeVisible();
    await expect(page.getByText("Enterprise")).toBeVisible();

    // Verify pricing
    await expect(page.getByText("$99")).toBeVisible();
    await expect(page.getByText("$199")).toBeVisible();
    await expect(page.getByText("$399")).toBeVisible();

    // Click skip payment button
    const skipButton = page.getByTestId("skip-payment-button");
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Setup Complete
    await expect(page.getByText(/is live!/i)).toBeVisible();
    await expect(page.getByText(TEST_PROPERTY.name)).toBeVisible();
    await expect(page.getByText(TEST_ADMIN.admin_code)).toBeVisible();

    const dashboardButton = page.getByRole("button", { name: /go to dashboard/i });
    await expect(dashboardButton).toBeVisible();
  });

  test("should show skip payment option when Stripe not configured", async ({ page }) => {
    // Navigate to Step 5
    await skipToOnboardingStep(page, 5);

    await expect(page.getByText(/step 5 of 5/i)).toBeVisible();

    // Verify skip payment button
    const skipButton = page.getByTestId("skip-payment-button");
    await expect(skipButton).toBeVisible();
    await expect(skipButton).toHaveText(/skip payment for now/i);

    // Verify testing badge
    await expect(page.getByText(/for testing only/i)).toBeVisible();

    // Verify OR divider
    await expect(page.getByText("OR")).toBeVisible();

    // Click and verify it completes onboarding
    await skipButton.click();
    await expect(page.getByText(/is live!/i)).toBeVisible();
  });

  test("should navigate back and forth between steps", async ({ page }) => {
    // Fill Step 1 and advance
    await page.getByLabel(/property name/i).fill(TEST_PROPERTY.name);
    await page.getByLabel(/community code/i).fill(TEST_PROPERTY.community_code);
    await page.getByLabel(/street address/i).fill(TEST_PROPERTY.street_address);
    await page.getByLabel(/city/i).fill(TEST_PROPERTY.city);
    await page.getByLabel(/state/i).selectOption(TEST_PROPERTY.state);
    await page.getByLabel(/zip/i).fill(TEST_PROPERTY.zip_code);
    await page.getByLabel(/number of units/i).fill(TEST_PROPERTY.unit_count);
    await page.getByRole("button", { name: /continue/i }).click();

    // Verify Step 2
    await expect(page.getByText(/step 2 of 5/i)).toBeVisible();

    // Go back to Step 1
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible();

    // Verify data persisted
    await expect(page.getByLabel(/property name/i)).toHaveValue(TEST_PROPERTY.name);
    await expect(page.getByLabel(/community code/i)).toHaveValue(TEST_PROPERTY.community_code);
  });

  test("should redirect to dashboard after completing onboarding", async ({ page }) => {
    // Complete the full flow
    await completeOnboardingFlow(page, { skipPayment: true });

    // Verify setup complete
    await expect(page.getByText(/is live!/i)).toBeVisible();

    // Click Go to Dashboard
    await page.getByRole("button", { name: /go to dashboard/i }).click();

    // Verify redirect
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
