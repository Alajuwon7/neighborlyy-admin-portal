import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEST_USER } from "../fixtures/test-data";
import { skipToOnboardingStep } from "../helpers/auth.helper";

/**
 * Phase 9 accessibility audit harness.
 *
 * Scans the core PM flows against WCAG 2.1 AA with axe-core. Each route writes a
 * JSON file under test-results/a11y/ summarizing violations + incomplete checks,
 * and soft-asserts zero violations so a single run scans EVERY route even when
 * earlier ones fail (audit mode). See
 * docs/superpowers/specs/2026-05-24-accessibility-audit-design.md.
 *
 * Public auth pages are scanned in a fresh unauthenticated context because
 * proxy.ts redirects authenticated users away from /login and /signup.
 * Dashboard + community routes reuse the global-setup storageState and a
 * community seeded via the service-role key (global setup deletes communities).
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const REPORT_DIR = join(process.cwd(), "test-results", "a11y");

type AxeNode = { target: unknown; failureSummary?: string; html: string };
type AxeResult = {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
};

function summarize(results: AxeResult[]) {
  return results.map((r) => ({
    id: r.id,
    impact: r.impact ?? "n/a",
    help: r.help,
    helpUrl: r.helpUrl,
    nodeCount: r.nodes.length,
    nodes: r.nodes.slice(0, 8).map((n) => ({
      target: n.target,
      failureSummary: n.failureSummary,
      html: n.html.slice(0, 240),
    })),
  }));
}

/**
 * Navigate-and-scan helper. `prep` lets onboarding tests drive the wizard to a
 * step before scanning. Writes a per-route report and soft-asserts zero
 * violations so the run continues.
 */
async function scanRoute(
  page: Page,
  slug: string,
  url: string | null,
  prep?: (page: Page) => Promise<void>
) {
  if (prep) {
    await prep(page);
  } else if (url) {
    await page.goto(url, { timeout: 60_000, waitUntil: "domcontentloaded" });
  }
  // Let client components hydrate / animations settle before measuring.
  await page.waitForTimeout(1_500);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const violations = summarize(results.violations as AxeResult[]);
  const incomplete = summarize(results.incomplete as AxeResult[]);

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    join(REPORT_DIR, `${slug}.json`),
    JSON.stringify(
      { route: slug, url: url ?? page.url(), violations, incomplete },
      null,
      2
    )
  );

  const ids = violations.map((v) => `${v.id}(${v.impact}×${v.nodeCount})`);
  console.log(
    `[a11y] ${slug}: ${violations.length} violations` +
      (ids.length ? ` → ${ids.join(", ")}` : "") +
      ` | ${incomplete.length} needs-review`
  );

  expect
    .soft(violations, `a11y violations on ${slug}:\n${JSON.stringify(ids, null, 2)}`)
    .toEqual([]);
}

// ---------------------------------------------------------------------------
// Public auth pages — unauthenticated context
// ---------------------------------------------------------------------------
test.describe("a11y: public auth pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Note: there is no standalone /reset-password route — the recovery link
  // lands on the authenticated /dashboard/account (out of scope). The public
  // auth surfaces are login, signup, forgot-password, and verify-email.
  const pages: Array<[string, string]> = [
    ["login", "/login"],
    ["signup", "/signup"],
    ["forgot-password", "/forgot-password"],
    ["verify-email", "/verify-email"],
  ];

  for (const [slug, url] of pages) {
    test(`scan ${slug}`, async ({ page }) => {
      test.setTimeout(120_000);
      await scanRoute(page, slug, url);
    });
  }
});

// ---------------------------------------------------------------------------
// Onboarding wizard — authenticated, no community needed (no final submit)
// ---------------------------------------------------------------------------
test.describe("a11y: onboarding wizard", () => {
  const steps = [1, 2, 3, 4, 5, 6];

  for (const step of steps) {
    test(`scan onboarding step ${step}`, async ({ page }) => {
      test.setTimeout(120_000);
      await scanRoute(page, `onboarding-step-${step}`, null, async (p) => {
        await skipToOnboardingStep(p, step);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Dashboard + community management — authenticated, seeded community
// ---------------------------------------------------------------------------
test.describe("a11y: dashboard + community", () => {
  let admin: SupabaseClient;
  let communityId: string | null = null;
  let pmId: string | null = null;

  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed the a11y community."
      );
    }
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: pm } = await admin
      .from("property_managers")
      .select("id")
      .eq("email", TEST_USER.email)
      .single();
    if (!pm) throw new Error("Test PM not found — global setup must run first.");
    pmId = pm.id as string;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { data: community, error } = await admin
      .from("communities")
      .insert({
        property_manager_id: pmId,
        organization_id: null,
        building_name: "A11y Audit Community",
        name: "Miyora @ A11y Audit Community",
        community_code: "A11YSEED",
        street_address: "1 Audit Way",
        city: "Austin",
        state: "TX",
        zip_code: "78701",
        unit_count: 100,
        property_type: "apartment",
        primary_color: "#2FC4D3",
        accent_color: "#78A6C8",
        admin_code: "A11YADMN",
        website_url: null,
        subscription_tier: "professional",
        status: "trial",
        onboarding_completed: true,
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to seed a11y community: ${error.message}`);
    communityId = community!.id as string;
  });

  test.afterAll(async () => {
    if (admin && communityId) {
      await admin.from("communities").delete().eq("id", communityId);
    }
  });

  const dashboardRoutes: Array<[string, string]> = [
    ["dashboard", "/dashboard"],
    ["dashboard-feed", "/dashboard/feed"],
    ["dashboard-notifications", "/dashboard/notifications"],
    ["dashboard-team", "/dashboard/team"],
    ["dashboard-billing", "/dashboard/billing"],
    ["communities-list", "/dashboard/communities"],
  ];

  for (const [slug, url] of dashboardRoutes) {
    test(`scan ${slug}`, async ({ page }) => {
      test.setTimeout(120_000);
      await scanRoute(page, slug, url);
    });
  }

  const communitySubRoutes: Array<[string, string]> = [
    ["community-overview", ""],
    ["community-pending", "/pending"],
    ["community-residents", "/residents"],
    ["community-events", "/events"],
    ["community-alerts", "/alerts"],
    ["community-facilities", "/facilities"],
  ];

  for (const [slug, suffix] of communitySubRoutes) {
    test(`scan ${slug}`, async ({ page }) => {
      test.setTimeout(120_000);
      expect(communityId, "community must be seeded").toBeTruthy();
      await scanRoute(page, slug, `/dashboard/communities/${communityId}${suffix}`);
    });
  }
});
