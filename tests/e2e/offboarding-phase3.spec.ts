import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_USER } from "../fixtures/test-data";

// ---------------------------------------------------------------------------
// Phase 3 e2e — PM offboarding disposition flow + layout-guard redirect.
//
// Why a service-role admin client here:
//   - Layout guard, disposition page, and finalize page all key off rows in
//     `deletion_requests`. RLS forbids `authenticated` from INSERTing those
//     rows directly (only the canonical RPC path is allowed). Seeding via
//     service role lets these tests bypass the production workflow and put
//     the system into specific states cheaply.
//
// Why we seed an organization + community per test:
//   - `global-setup.ts` deletes the test PM's communities so the onboarding
//     suite starts from a clean state. The disposition page requires at
//     least one community (and its `community_audit_summary` view row) to
//     render. So we provision a minimal org+community, link the PM, and
//     tear it all down in `afterEach`.
//
// Why we don't reuse `loginAsPropertyManager`:
//   - The Playwright project uses `storageState: "tests/.auth/session.json"`
//     from global setup, so the page arrives pre-authenticated. We just
//     need to look up the PM row by user_id to seed FK relations.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && serviceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe("PM offboarding Phase 3", () => {
  let pmId: string;
  let orgId: string;
  let communityId: string;
  let requestId: string;

  test.beforeAll(async () => {
    test.skip(
      !supabaseAdmin,
      "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env",
    );
  });

  test.beforeEach(async () => {
    if (!supabaseAdmin) return;

    // Look up the auth user the global setup created/logged in.
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = usersPage?.users?.find((u) => u.email === TEST_USER.email);
    if (!authUser) {
      throw new Error(
        `Test auth user not found (${TEST_USER.email}). Run global setup first.`,
      );
    }

    const { data: pm, error: pmErr } = await supabaseAdmin
      .from("property_managers")
      .select("id")
      .eq("user_id", authUser.id)
      .single();
    if (pmErr || !pm) {
      throw new Error(`Failed to look up property_manager: ${pmErr?.message}`);
    }
    pmId = pm.id;

    // Seed organization + link the PM to it. The PM may already have an
    // organization_id from a prior onboarding run; we always create a fresh
    // one so this test owns the lifecycle and afterEach can clean it up
    // without disturbing other suites.
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: "Phase3 Offboarding Test Org", type: "individual" })
      .select("id")
      .single();
    if (orgErr || !org) {
      throw new Error(`Failed to seed organization: ${orgErr?.message}`);
    }
    orgId = org.id;

    await supabaseAdmin
      .from("property_managers")
      .update({ organization_id: orgId })
      .eq("id", pmId);

    // Seed exactly one community so the disposition page renders a single
    // card and the "Continue to account closure" button is enabled the moment
    // that card is confirmed.
    const codeSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: community, error: commErr } = await supabaseAdmin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: "Phase3 Test Community",
        community_code: `P3${codeSuffix}`,
        admin_code: `AD${codeSuffix}`,
      })
      .select("id")
      .single();
    if (commErr || !community) {
      throw new Error(`Failed to seed community: ${commErr?.message}`);
    }
    communityId = community.id;

    // Seed a deletion request in `in_review` with billing already resolved.
    // This simulates corp approval + auto-passed billing for orgs with no
    // active subscriptions — the state where the disposition UI is allowed.
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "in_review",
        stripe_resolved_at: new Date().toISOString(),
        audit_log: [],
      })
      .select("id")
      .single();
    if (reqErr || !req) {
      throw new Error(`Failed to seed deletion request: ${reqErr?.message}`);
    }
    requestId = req.id;
  });

  test.afterEach(async () => {
    if (!supabaseAdmin) return;

    // Order matters: deletion_requests FK-references organizations (ON DELETE
    // SET NULL), but we hard-delete to keep the table tidy. Communities and
    // org references on the PM are also nulled to leave the PM untouched
    // for the next test.
    if (requestId) {
      await supabaseAdmin.from("deletion_requests").delete().eq("id", requestId);
    }
    if (communityId) {
      await supabaseAdmin.from("communities").delete().eq("id", communityId);
    }
    if (pmId) {
      await supabaseAdmin
        .from("property_managers")
        .update({ organization_id: null })
        .eq("id", pmId);
    }
    if (orgId) {
      await supabaseAdmin.from("organizations").delete().eq("id", orgId);
    }

    pmId = "";
    orgId = "";
    communityId = "";
    requestId = "";
  });

  test("happy path: account → disposition → finalize", async ({ page }) => {
    // 1. Account page shows the OffboardingStatusCard for the seeded request.
    //    Per OffboardingStatusCard.tsx, `in_review` renders the "Continue
    //    offboarding →" link that targets /billing. The layout guard then
    //    redirects to /disposition because stripe_resolved_at is non-null.
    await page.goto("/dashboard/account");
    await expect(
      page.getByText(/account deletion in progress/i),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /continue offboarding/i })
      .click();
    await page.waitForURL(/\/dashboard\/account\/offboarding\/disposition$/, {
      timeout: 10_000,
    });

    // 2. Disposition: there is exactly one card (one seeded community).
    //    Pick "Suspend" — the "Close" option is disabled until active
    //    residents == 0 and we don't seed residents, but the seeded view
    //    will naturally report 0 so "Close" would also be available.
    //    "Suspend" is the safer default — it touches communities.suspended_reason
    //    and admin_notifications, both of which we want to exercise.
    const card = page.locator("fieldset").first();
    await expect(card).toBeVisible();
    await card.getByLabel(/^suspend$/i).check();

    await page
      .getByRole("button", { name: /confirm this community/i })
      .click();
    await expect(page.getByText(/Confirmed:\s*suspend/i)).toBeVisible({
      timeout: 10_000,
    });

    // 3. Continue → account closure. Because we seeded exactly one community,
    //    the gate flips to enabled immediately after the first confirmation.
    const continueBtn = page.getByRole("button", {
      name: /continue to account closure/i,
    });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    await page.waitForURL(/\/dashboard\/account\/offboarding\/finalize$/, {
      timeout: 10_000,
    });
    await expect(
      page.getByRole("heading", { name: /queued for closure/i }),
    ).toBeVisible();
  });

  test("layout guard redirects from disposition when billing not resolved", async ({
    page,
  }) => {
    if (!supabaseAdmin) test.skip();

    // Roll back the billing-resolved timestamp to put the request into the
    // "in_review without billing resolved" branch of the layout guard.
    const { error } = await supabaseAdmin!
      .from("deletion_requests")
      .update({ stripe_resolved_at: null })
      .eq("id", requestId);
    if (error) throw new Error(`Failed to unset stripe_resolved_at: ${error.message}`);

    await page.goto("/dashboard/account/offboarding/disposition");
    await page.waitForURL(/\/dashboard\/account\/offboarding\/billing$/, {
      timeout: 10_000,
    });
    await expect(page).toHaveURL(
      /\/dashboard\/account\/offboarding\/billing$/,
    );
  });
});
