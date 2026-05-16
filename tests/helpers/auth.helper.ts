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
 * Fill the Step 2 Property Info form using placeholder-based selectors.
 * The Step1PropertyInfo component uses <Label> siblings (no htmlFor/id),
 * so getByLabel() does not resolve — we target by placeholder instead.
 * For <select> elements we use getByRole("combobox") with nth() ordering:
 *   nth(0) = Property Type, nth(1) = State.
 */
async function fillPropertyInfoStep(
  page: Page,
  property: typeof TEST_PROPERTY
) {
  await page.getByPlaceholder(/the reserve/i).fill(property.name);
  await page.getByPlaceholder(/sunset/i).fill(property.community_code);
  // Property Type is the first <select> / combobox on this step
  await page.getByRole("combobox").nth(0).selectOption(property.property_type);
  await page.getByPlaceholder(/123 main street/i).fill(property.street_address);
  await page.getByPlaceholder(/austin/i).fill(property.city);
  // State is the second <select> / combobox on this step
  await page.getByRole("combobox").nth(1).selectOption(property.state);
  await page.getByPlaceholder(/78701/i).fill(property.zip_code);
  await page.getByPlaceholder(/200/i).fill(property.unit_count);
}

/**
 * Complete the full onboarding flow (Steps 1-6) with test defaults.
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

  // Step 1: Organization Type — select "Independent Manager" and continue
  await page.getByRole("button", { name: /independent manager/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 2: Property Info
  await fillPropertyInfoStep(page, property);
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 3: Branding — skip logo, just continue
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 4: Facilities
  for (const facility of facilities) {
    await page.getByRole("button", { name: new RegExp(facility, "i") }).click();
  }
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 5: Admin Access — input has placeholder "e.g. SUNSET24"
  await page.getByPlaceholder(/sunset24/i).fill(adminCode);
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 6: Billing
  if (options.skipPayment !== false) {
    await page.getByTestId("skip-payment-button").click();
  } else {
    await page.getByRole("button", { name: /start free trial/i }).click();
  }
}

/**
 * Navigate to /onboarding and advance to a specific step by filling minimal data.
 * Assumes the user is authenticated via storageState.
 *
 * Step numbering matches the current 6-step UI:
 *   1 = Organization Type
 *   2 = Property Information
 *   3 = Community Branding
 *   4 = Facilities & Amenities
 *   5 = Admin Access
 *   6 = Choose a Plan (Billing)
 *
 * Callers that previously passed 5 for "Billing" should now pass 6.
 */
export async function skipToOnboardingStep(page: Page, stepNumber: number) {
  await page.goto("/onboarding");

  if (stepNumber <= 1) return;

  // Step 1: Organization Type — select "Independent Manager" and continue
  await page.getByRole("button", { name: /independent manager/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 2) return;

  // Step 2: Property Info — fill minimal required fields via placeholder selectors
  await fillPropertyInfoStep(page, TEST_PROPERTY);
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 3) return;

  // Step 3: Branding — just continue
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 4) return;

  // Step 4: Facilities — select one and continue
  await page.getByRole("button", { name: /fitness center/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  if (stepNumber <= 5) return;

  // Step 5: Admin Access — input has placeholder "e.g. SUNSET24"
  await page.getByPlaceholder(/sunset24/i).fill(TEST_ADMIN.admin_code);
  await page.getByRole("button", { name: /continue/i }).click();
}
