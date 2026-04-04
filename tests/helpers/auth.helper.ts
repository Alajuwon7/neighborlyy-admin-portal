import { type Page } from "@playwright/test";
import { TEST_USER, TEST_PROPERTY, TEST_FACILITIES, TEST_ADMIN } from "../fixtures/test-data";

/**
 * Log in as a property manager via the login page.
 * Only needed if NOT using the global-setup storageState.
 */
export async function loginAsPropertyManager(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

/**
 * Complete the full onboarding flow (Steps 1-5) with test defaults.
 * Assumes the page is already on /onboarding and the user is authenticated
 * (via storageState from global setup).
 */
export async function completeOnboardingFlow(
  page: Page,
  options: {
    skipPayment?: boolean;
    property?: Partial<typeof TEST_PROPERTY>;
    facilities?: string[];
    adminCode?: string;
  } = {}
) {
  const property = { ...TEST_PROPERTY, ...options.property };
  const facilities = options.facilities ?? TEST_FACILITIES;
  const adminCode = options.adminCode ?? TEST_ADMIN.admin_code;

  // Step 1: Property Info
  await page.getByLabel(/property name/i).fill(property.name);
  await page.getByLabel(/community code/i).fill(property.community_code);
  await page.getByLabel(/property type/i).selectOption(property.property_type);
  await page.getByLabel(/street address/i).fill(property.street_address);
  await page.getByLabel(/city/i).fill(property.city);
  await page.getByLabel(/state/i).selectOption(property.state);
  await page.getByLabel(/zip/i).fill(property.zip_code);
  await page.getByLabel(/number of units/i).fill(property.unit_count);
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 2: Branding — skip logo, just continue
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 3: Facilities
  for (const facility of facilities) {
    await page.getByRole("button", { name: new RegExp(facility, "i") }).click();
  }
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 4: Admin Access
  await page.getByLabel(/admin code/i).fill(adminCode);
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 5: Billing
  if (options.skipPayment !== false) {
    await page.getByTestId("skip-payment-button").click();
  } else {
    await page.getByRole("button", { name: /start free trial/i }).click();
  }
}

/**
 * Navigate to /onboarding and advance to a specific step by filling minimal data.
 * Assumes the user is authenticated via storageState.
 */
export async function skipToOnboardingStep(page: Page, stepNumber: number) {
  await page.goto("/onboarding");

  if (stepNumber <= 1) return;

  // Step 1: fill minimal required fields
  await page.getByLabel(/property name/i).fill(TEST_PROPERTY.name);
  await page.getByLabel(/community code/i).fill(TEST_PROPERTY.community_code);
  await page.getByLabel(/street address/i).fill(TEST_PROPERTY.street_address);
  await page.getByLabel(/city/i).fill(TEST_PROPERTY.city);
  await page.getByLabel(/state/i).selectOption(TEST_PROPERTY.state);
  await page.getByLabel(/zip/i).fill(TEST_PROPERTY.zip_code);
  await page.getByLabel(/number of units/i).fill(TEST_PROPERTY.unit_count);
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 2) return;

  // Step 2: Branding — just continue
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 3) return;

  // Step 3: Facilities — select one and continue
  await page.getByRole("button", { name: /fitness center/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 4) return;

  // Step 4: Admin Access
  await page.getByLabel(/admin code/i).fill(TEST_ADMIN.admin_code);
  await page.getByRole("button", { name: /continue/i }).click();
}
