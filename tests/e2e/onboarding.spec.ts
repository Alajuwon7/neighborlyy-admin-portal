import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_PROPERTY, TEST_ADMIN, TEST_USER } from "../fixtures/test-data";
import { skipToOnboardingStep, completeOnboardingFlow } from "../helpers/auth.helper";

/**
 * Delete all communities owned by the test PM after each test so that the
 * Step 2 uniqueness check (building_name / community_code) never sees stale
 * rows from a previous test in this same run.
 */
async function cleanupTestCommunities() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("email", TEST_USER.email)
    .single();

  if (pm) {
    await supabase.from("communities").delete().eq("property_manager_id", pm.id);
  }
}

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Session is pre-authenticated via global-setup storageState.
    // Global setup also cleans up any existing communities, so
    // login redirects to /onboarding.
    await page.goto("/onboarding");
  });

  test.afterEach(async () => {
    // Remove communities created during the test so the next test's
    // Step 2 uniqueness check starts from a clean slate.
    await cleanupTestCommunities();
  });

  test("should complete full onboarding with payment skip", async ({ page }) => {
    // Step 1: Organization Type
    await expect(page.getByText(/step 1 of 6/i)).toBeVisible();
    await expect(page.getByText(/organization type/i)).toBeVisible();
    await page.getByRole("button", { name: /independent manager/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Property Info
    await expect(page.getByText(/step 2 of 6/i)).toBeVisible();
    await expect(page.getByText(/property information/i)).toBeVisible();

    // Step1PropertyInfo uses <Label> siblings (no htmlFor/id) so we target by placeholder.
    // For <select> elements, getByRole("combobox") nth(0)=PropertyType, nth(1)=State.
    await page.getByPlaceholder(/the reserve/i).fill(TEST_PROPERTY.name);
    await page.getByPlaceholder(/sunset/i).fill(TEST_PROPERTY.community_code);
    await page.getByRole("combobox").nth(0).selectOption(TEST_PROPERTY.property_type);
    await page.getByPlaceholder(/123 main street/i).fill(TEST_PROPERTY.street_address);
    await page.getByPlaceholder(/austin/i).fill(TEST_PROPERTY.city);
    await page.getByRole("combobox").nth(1).selectOption(TEST_PROPERTY.state);
    await page.getByPlaceholder(/78701/i).fill(TEST_PROPERTY.zip_code);
    await page.getByPlaceholder(/200/i).fill(TEST_PROPERTY.unit_count);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Branding
    await expect(page.getByText(/step 3 of 6/i)).toBeVisible();
    await expect(page.getByText(/community branding/i)).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Facilities
    await expect(page.getByText(/step 4 of 6/i)).toBeVisible();
    await expect(page.getByText(/facilities & amenities/i)).toBeVisible();

    await page.getByRole("button", { name: /fitness center/i }).click();
    await page.getByRole("button", { name: /swimming pool/i }).click();
    await page.getByRole("button", { name: /clubhouse/i }).click();
    await expect(page.getByText(/3 selected/)).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Admin Access
    await expect(page.getByText(/step 5 of 6/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /admin access/i })).toBeVisible();
    await page.getByPlaceholder(/sunset24/i).fill(TEST_ADMIN.admin_code);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 6: Billing
    await expect(page.getByText(/step 6 of 6/i)).toBeVisible();
    await expect(page.getByText(/choose a plan/i)).toBeVisible();

    // Verify all 3 plan tiers display — use exact:true to avoid matching feature
    // list items like "Everything in Starter" or "Everything in Professional".
    await expect(page.getByText("Starter", { exact: true })).toBeVisible();
    await expect(page.getByText("Professional", { exact: true })).toBeVisible();
    await expect(page.getByText("Enterprise", { exact: true })).toBeVisible();

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
    // Navigate to Step 6 (Billing)
    await skipToOnboardingStep(page, 6);

    await expect(page.getByText(/step 6 of 6/i)).toBeVisible();

    // Verify skip payment button
    const skipButton = page.getByTestId("skip-payment-button");
    await expect(skipButton).toBeVisible();
    await expect(skipButton).toHaveText(/skip payment for now/i);

    // Verify testing badge
    await expect(page.getByText(/for testing only/i)).toBeVisible();

    // Verify OR divider — exact:true avoids matching "OR" inside other words
    await expect(page.getByText("OR", { exact: true })).toBeVisible();

    // Click and verify it completes onboarding
    await skipButton.click();
    await expect(page.getByText(/is live!/i)).toBeVisible();
  });

  test("should navigate back and forth between steps", async ({ page }) => {
    // Complete Step 1 (Organization Type) first
    await page.getByRole("button", { name: /independent manager/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Fill Step 2 (Property Info) and advance — use placeholder selectors (no htmlFor/id on inputs)
    await page.getByPlaceholder(/the reserve/i).fill(TEST_PROPERTY.name);
    await page.getByPlaceholder(/sunset/i).fill(TEST_PROPERTY.community_code);
    await page.getByPlaceholder(/123 main street/i).fill(TEST_PROPERTY.street_address);
    await page.getByPlaceholder(/austin/i).fill(TEST_PROPERTY.city);
    await page.getByRole("combobox").nth(1).selectOption(TEST_PROPERTY.state);
    await page.getByPlaceholder(/78701/i).fill(TEST_PROPERTY.zip_code);
    await page.getByPlaceholder(/200/i).fill(TEST_PROPERTY.unit_count);
    await page.getByRole("button", { name: /continue/i }).click();

    // Verify Step 3 (Branding)
    await expect(page.getByText(/step 3 of 6/i)).toBeVisible();

    // Go back to Step 2 (Property Info)
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/step 2 of 6/i)).toBeVisible();

    // Verify data persisted — check by placeholder (inputs have no htmlFor/id)
    await expect(page.getByPlaceholder(/the reserve/i)).toHaveValue(TEST_PROPERTY.name);
    await expect(page.getByPlaceholder(/sunset/i)).toHaveValue(TEST_PROPERTY.community_code);
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
