import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "e2e-test@miyora.com";
const TEST_PASSWORD = "TestPassword123!";
const TEST_FULL_NAME = "E2E Test Manager";

/**
 * Playwright global setup:
 * 1. Ensures a test user exists in Supabase (auth + property_managers)
 * 2. Logs in via the browser and saves session state for reuse
 */
async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "\n⚠️  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E tests.\n" +
        "   Skipping test user seeding. Tests requiring auth will fail.\n"
    );
    return;
  }

  // Admin client to create/verify test user
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Check if test user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`✓ Test user already exists: ${TEST_EMAIL}`);
  } else {
    // Create test user with confirmed email (no verification needed)
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: TEST_FULL_NAME },
      });

    if (createError) {
      throw new Error(`Failed to create test user: ${createError.message}`);
    }

    userId = newUser.user.id;
    console.log(`✓ Created test user: ${TEST_EMAIL}`);
  }

  // 2. Ensure property_managers row exists
  const { data: existingPM } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existingPM) {
    const { error: pmError } = await supabase.from("property_managers").insert({
      user_id: userId,
      full_name: TEST_FULL_NAME,
      email: TEST_EMAIL,
    });

    if (pmError) {
      throw new Error(`Failed to create property_managers row: ${pmError.message}`);
    }
    console.log("✓ Created property_managers row");
  } else {
    console.log("✓ property_managers row already exists");
  }

  // 3. Clean up any existing communities for this test user (fresh state)
  const { data: pmData } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (pmData) {
    await supabase
      .from("communities")
      .delete()
      .eq("property_manager_id", pmData.id);
    console.log("✓ Cleaned up previous test communities");
  }

  // 4. Log in via the browser and save session state
  const baseURL = config.projects[0].use.baseURL || "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("form").getByRole("button", { name: /^sign in$/i }).click();

  // Wait for redirect to /onboarding (since no community exists)
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 });

  // Save signed-in state
  await page.context().storageState({ path: "tests/.auth/session.json" });
  console.log("✓ Saved authenticated session state");

  await browser.close();
}

export default globalSetup;
