import { test, expect, request as playwrightRequest } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_USER } from "../fixtures/test-data";

// ---------------------------------------------------------------------------
// Phase 4 e2e — PM offboarding completion (Gate 5 wipe) + Gate 6 cron.
//
// Three concerns, each self-cleaning:
//   A. Screen 5 renders + the two-tap close button arms. Driven in the browser
//      as the shared test user. We NEVER tap the second time — completeOffboarding
//      deletes the auth user, which would break the shared session for all
//      other specs.
//   B. complete_pm_offboarding RPC against a throwaway PM (its own throwaway
//      auth user). Verifies the atomic wipe without a browser.
//   C. hard_delete_expired_offboarding via the cron route, against throwaway
//      'completed' requests with backdated soft_deleted_at.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

let admin: SupabaseClient | null = null;
if (supabaseUrl && serviceRoleKey) {
  admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const rand = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// --- Concern A: Screen 5 render + two-tap arm (shared user, browser) --------
test.describe("Phase 4 — Screen 5 (final confirmation)", () => {
  let pmId: string;
  let orgId: string;
  let communityId: string;
  let requestId: string;
  let priorOrgId: string | null = null;

  test.beforeAll(() => {
    test.skip(
      !admin,
      "Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env",
    );
  });

  test.beforeEach(async () => {
    if (!admin) return;

    const { data: usersPage } = await admin.auth.admin.listUsers();
    const authUser = usersPage?.users?.find((u) => u.email === TEST_USER.email);
    if (!authUser) throw new Error(`Test auth user not found (${TEST_USER.email}).`);

    const { data: pm } = await admin
      .from("property_managers")
      .select("id, organization_id")
      .eq("user_id", authUser.id)
      .single();
    if (!pm) throw new Error("Test property_manager row not found.");
    pmId = pm.id;
    priorOrgId = pm.organization_id;

    const suffix = rand();
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Screen5 Org ${suffix}`, type: "individual" })
      .select("id")
      .single();
    orgId = org!.id;

    await admin
      .from("property_managers")
      .update({ organization_id: orgId })
      .eq("id", pmId);

    const { data: community } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Phase4 Community ${suffix}`,
        building_name: `Phase4 Building ${suffix}`,
        community_code: `P4${suffix}`,
        admin_code: `AD${suffix}`,
      })
      .select("id")
      .single();
    communityId = community!.id;

    const { data: req } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "approved",
        stripe_resolved_at: new Date().toISOString(),
        community_disposition: [
          {
            community_id: communityId,
            action: "suspend",
            set_at: new Date().toISOString(),
          },
        ],
        audit_log: [],
      })
      .select("id")
      .single();
    requestId = req!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    await admin.from("deletion_requests").delete().eq("id", requestId);
    await admin.from("communities").delete().eq("id", communityId);
    await admin
      .from("property_managers")
      .update({ organization_id: priorOrgId })
      .eq("id", pmId);
    await admin.from("organizations").delete().eq("id", orgId);
  });

  test("renders the summary and arms the two-tap close button", async ({ page }) => {
    await page.goto("/dashboard/account/offboarding/finalize");

    await expect(
      page.getByRole("heading", { name: /ready to be closed/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();
    await expect(page.getByText(/Suspended/)).toBeVisible();

    const closeButton = page.getByRole("button", { name: "Close my account" });
    await expect(closeButton).toBeVisible();

    // First tap arms the button. We deliberately do NOT tap again — the second
    // tap would run completeOffboarding and delete the shared test auth user.
    await closeButton.click();
    await expect(
      page.getByRole("button", { name: "Tap again to confirm" }),
    ).toBeVisible();
  });
});

// --- Concern B: complete_pm_offboarding RPC (throwaway PM, no browser) ------
test.describe("Phase 4 — complete_pm_offboarding RPC", () => {
  let throwawayUserId: string;
  let pmId: string;
  let orgId: string;
  let closeCommunityId: string;
  let suspendCommunityId: string;
  let requestId: string;

  test.beforeAll(() => {
    test.skip(!admin, "Requires Supabase service-role env vars");
  });

  test.beforeEach(async () => {
    if (!admin) return;
    const suffix = rand();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: `phase4-rpc-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(`Failed to create throwaway user: ${createErr?.message}`);
    }
    throwawayUserId = created.user.id;

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `Phase4 RPC Org ${suffix}`, type: "individual" })
      .select("id")
      .single();
    orgId = org!.id;

    const { data: pm } = await admin
      .from("property_managers")
      .insert({
        user_id: throwawayUserId,
        full_name: "Throwaway PM",
        email: `phase4-rpc-${suffix}@miyora.com`,
        phone: "555-0100",
        company_name: "Throwaway Co",
        organization_id: orgId,
      })
      .select("id")
      .single();
    pmId = pm!.id;

    const { data: closeComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Close Community ${suffix}`,
        building_name: `Close Bldg ${suffix}`,
        community_code: `PC${suffix}`,
        admin_code: `CC${suffix}`,
      })
      .select("id")
      .single();
    closeCommunityId = closeComm!.id;

    const { data: suspendComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: orgId,
        name: `Suspend Community ${suffix}`,
        building_name: `Suspend Bldg ${suffix}`,
        community_code: `PS${suffix}`,
        admin_code: `SC${suffix}`,
      })
      .select("id")
      .single();
    suspendCommunityId = suspendComm!.id;

    const { data: req } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: pmId,
        org_id: orgId,
        reason: "test",
        status: "approved",
        stripe_resolved_at: new Date().toISOString(),
        community_disposition: [
          {
            community_id: closeCommunityId,
            action: "close",
            set_at: new Date().toISOString(),
          },
          {
            community_id: suspendCommunityId,
            action: "suspend",
            set_at: new Date().toISOString(),
          },
        ],
        audit_log: [],
      })
      .select("id")
      .single();
    requestId = req!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    await admin.from("deletion_requests").delete().eq("id", requestId);
    await admin.from("communities").delete().eq("organization_id", orgId);
    await admin.from("property_managers").delete().eq("id", pmId);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(throwawayUserId);
  });

  test("atomically wipes PII, marks org deleted, soft-deletes only closed communities", async () => {
    if (!admin) return;

    const { data: rpcRows, error } = await admin.rpc("complete_pm_offboarding", {
      p_request_id: requestId,
      p_audit: {
        actor: "pm",
        actor_id: throwawayUserId,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "e2e",
      },
    });
    expect(error).toBeNull();
    expect(Array.isArray(rpcRows) ? rpcRows.length : 0).toBe(1);

    const { data: pm } = await admin
      .from("property_managers")
      .select("full_name, email, phone, company_name, avatar_url")
      .eq("id", pmId)
      .single();
    expect(pm!.full_name).toBe("[deleted]");
    expect(pm!.email).toBe(`[deleted]-${pmId}`);
    expect(pm!.phone).toBeNull();
    expect(pm!.company_name).toBeNull();
    expect(pm!.avatar_url).toBeNull();

    const { data: org } = await admin
      .from("organizations")
      .select("status, deleted_at")
      .eq("id", orgId)
      .single();
    expect(org!.status).toBe("deleted");
    expect(org!.deleted_at).not.toBeNull();

    const { data: closeComm } = await admin
      .from("communities")
      .select("deleted_at")
      .eq("id", closeCommunityId)
      .single();
    expect(closeComm!.deleted_at).not.toBeNull();

    const { data: suspendComm } = await admin
      .from("communities")
      .select("deleted_at")
      .eq("id", suspendCommunityId)
      .single();
    expect(suspendComm!.deleted_at).toBeNull();

    const { data: reqAfter } = await admin
      .from("deletion_requests")
      .select("status, pii_wiped_at, soft_deleted_at, audit_log")
      .eq("id", requestId)
      .single();
    expect(reqAfter!.status).toBe("completed");
    expect(reqAfter!.pii_wiped_at).not.toBeNull();
    expect(reqAfter!.soft_deleted_at).not.toBeNull();
    expect(reqAfter!.audit_log.some((e: { action: string }) => e.action === "pii_wiped")).toBe(true);
  });

  test("is a no-op when the request is not 'approved'", async () => {
    if (!admin) return;
    await admin
      .from("deletion_requests")
      .update({ status: "completed" })
      .eq("id", requestId);

    const { data: rpcRows, error } = await admin.rpc("complete_pm_offboarding", {
      p_request_id: requestId,
      p_audit: {
        actor: "pm",
        actor_id: throwawayUserId,
        action: "pii_wiped",
        at: new Date().toISOString(),
        note: "e2e",
      },
    });
    expect(error).toBeNull();
    expect(Array.isArray(rpcRows) ? rpcRows.length : 0).toBe(0);

    const { data: pm } = await admin
      .from("property_managers")
      .select("full_name")
      .eq("id", pmId)
      .single();
    expect(pm!.full_name).toBe("Throwaway PM");
  });
});

// --- Concern C: hard_delete_expired_offboarding via the cron route ----------
test.describe("Phase 4 — Gate 6 cron hard delete", () => {
  let dueUserId: string;
  let dueOrgId: string;
  let dueCommunityId: string;
  let dueRequestId: string;
  let freshRequestId: string;
  let freshOrgId: string;
  let freshUserId: string;
  let freshPmId: string;

  test.beforeAll(() => {
    test.skip(!admin || !cronSecret, "Requires Supabase service-role + CRON_SECRET env vars");
  });

  test.beforeEach(async () => {
    if (!admin) return;
    const suffix = rand();

    const { data: dueUser } = await admin.auth.admin.createUser({
      email: `phase4-cron-due-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    dueUserId = dueUser!.user!.id;

    const { data: dueOrg } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Cron Due Org ${suffix}`, type: "individual", status: "deleted", deleted_at: new Date().toISOString() })
      .select("id")
      .single();
    dueOrgId = dueOrg!.id;

    const { data: duePm } = await admin
      .from("property_managers")
      .insert({
        user_id: dueUserId,
        full_name: "[deleted]",
        email: `[deleted]-cron-due-${suffix}`,
        organization_id: dueOrgId,
      })
      .select("id")
      .single();

    const { data: dueComm } = await admin
      .from("communities")
      .insert({
        property_manager_id: duePm!.id,
        organization_id: dueOrgId,
        name: `Cron Due Community ${suffix}`,
        building_name: `Cron Due Bldg ${suffix}`,
        community_code: `CD${suffix}`,
        admin_code: `DD${suffix}`,
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    dueCommunityId = dueComm!.id;

    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dueReq } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: duePm!.id,
        org_id: dueOrgId,
        reason: "test",
        status: "completed",
        stripe_resolved_at: thirtyOneDaysAgo,
        pii_wiped_at: thirtyOneDaysAgo,
        soft_deleted_at: thirtyOneDaysAgo,
        community_disposition: [],
        audit_log: [],
      })
      .select("id")
      .single();
    dueRequestId = dueReq!.id;

    const { data: freshUser } = await admin.auth.admin.createUser({
      email: `phase4-cron-fresh-${suffix}@miyora.com`,
      password: `Throwaway-${suffix}-pw`,
      email_confirm: true,
    });
    freshUserId = freshUser!.user!.id;

    const { data: freshOrg } = await admin
      .from("organizations")
      .insert({ name: `Phase4 Cron Fresh Org ${suffix}`, type: "individual", status: "deleted", deleted_at: new Date().toISOString() })
      .select("id")
      .single();
    freshOrgId = freshOrg!.id;

    const { data: freshPm } = await admin
      .from("property_managers")
      .insert({
        user_id: freshUserId,
        full_name: "[deleted]",
        email: `[deleted]-cron-fresh-${suffix}`,
        organization_id: freshOrgId,
      })
      .select("id")
      .single();
    freshPmId = freshPm!.id;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: freshReq } = await admin
      .from("deletion_requests")
      .insert({
        pm_id: freshPmId,
        org_id: freshOrgId,
        reason: "test",
        status: "completed",
        stripe_resolved_at: fiveDaysAgo,
        pii_wiped_at: fiveDaysAgo,
        soft_deleted_at: fiveDaysAgo,
        community_disposition: [],
        audit_log: [],
      })
      .select("id")
      .single();
    freshRequestId = freshReq!.id;
  });

  test.afterEach(async () => {
    if (!admin) return;
    await admin.from("deletion_requests").delete().eq("id", dueRequestId);
    await admin.from("deletion_requests").delete().eq("id", freshRequestId);
    await admin.from("communities").delete().eq("organization_id", dueOrgId);
    await admin.from("communities").delete().eq("organization_id", freshOrgId);
    await admin.from("property_managers").delete().eq("organization_id", dueOrgId);
    await admin.from("property_managers").delete().eq("id", freshPmId);
    await admin.from("organizations").delete().eq("id", dueOrgId);
    await admin.from("organizations").delete().eq("id", freshOrgId);
    await admin.auth.admin.deleteUser(dueUserId);
    await admin.auth.admin.deleteUser(freshUserId);
  });

  test("rejects requests without a valid CRON_SECRET", async () => {
    const ctx = await playwrightRequest.newContext({ baseURL });
    const res = await ctx.get("/api/cron/offboarding-hard-delete");
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("hard-deletes only requests past the 30-day window", async () => {
    if (!admin) return;
    const ctx = await playwrightRequest.newContext({ baseURL });
    const res = await ctx.get("/api/cron/offboarding-hard-delete", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.errored).toBe(0);
    expect(body.errored_ids).toEqual([]);
    expect(body.request_ids).toContain(dueRequestId);
    expect(body.request_ids).not.toContain(freshRequestId);
    await ctx.dispose();

    // The due request: closed community + PM gone, request row retained with
    // hard_deleted_at set, and the org is INTENTIONALLY KEPT ALIVE (per the
    // Phase 4 design — Gate 6 only reclaims closed communities + the PM row;
    // the org survives while it has communities, even after its PM is gone).
    const { data: dueOrgAfter } = await admin
      .from("organizations")
      .select("id, status")
      .eq("id", dueOrgId)
      .maybeSingle();
    expect(dueOrgAfter).not.toBeNull();
    expect(dueOrgAfter!.status).toBe("deleted");

    const { data: dueComm } = await admin
      .from("communities")
      .select("id")
      .eq("id", dueCommunityId)
      .maybeSingle();
    expect(dueComm).toBeNull();

    const { data: duePmAfter } = await admin
      .from("property_managers")
      .select("id")
      .eq("organization_id", dueOrgId)
      .maybeSingle();
    expect(duePmAfter).toBeNull();

    const { data: dueReqAfter } = await admin
      .from("deletion_requests")
      .select("hard_deleted_at, audit_log")
      .eq("id", dueRequestId)
      .single();
    expect(dueReqAfter!.hard_deleted_at).not.toBeNull();
    expect(dueReqAfter!.audit_log.some((e: { action: string }) => e.action === "hard_deleted")).toBe(true);

    // The fresh request: completely untouched.
    const { data: freshOrgAfter } = await admin
      .from("organizations")
      .select("id")
      .eq("id", freshOrgId)
      .maybeSingle();
    expect(freshOrgAfter).not.toBeNull();

    const { data: freshPmAfter } = await admin
      .from("property_managers")
      .select("id")
      .eq("id", freshPmId)
      .maybeSingle();
    expect(freshPmAfter).not.toBeNull();

    const { data: freshReqAfter } = await admin
      .from("deletion_requests")
      .select("hard_deleted_at")
      .eq("id", freshRequestId)
      .single();
    expect(freshReqAfter!.hard_deleted_at).toBeNull();
  });
});
