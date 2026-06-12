"use server";

import { createClient } from "@/lib/supabase/server";
import { trialDaysLeft } from "@/lib/trial-days";

/**
 * Returns the days remaining on the most urgent trial across the signed-in
 * PM's communities, for the dashboard's trial-end warning banner.
 *
 * Only communities still genuinely on a free trial count: status='trial' AND
 * not actively billed (no subscription, or a canceled one — the same rule the
 * Stripe webhook fan-in uses), because communities.status never flips off
 * 'trial' when a PM subscribes; without the billing check the banner would
 * tell paying customers their trial ended.
 *
 * Warning window: the soonest unexpired trial with daysLeft <= 7. Unexpired
 * trials win over expired ones so a long-abandoned trial community can't
 * permanently mask an imminent expiry elsewhere; only when every unbilled
 * trial has ended does it return a negative daysLeft ("trial has ended").
 * Returns null when there's nothing to warn about, or on any auth/lookup
 * failure — this powers a non-critical banner, so it never redirects or throws.
 */
export async function getTrialStatus(): Promise<{ daysLeft: number } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pmRow } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const pm = pmRow as { id: string; organization_id: string | null } | null;
  if (!pm) return null;

  let query = supabase
    .from("communities")
    .select("trial_ends_at, stripe_subscription_id, stripe_subscription_status")
    .eq("status", "trial")
    .not("trial_ends_at", "is", null);

  query = pm.organization_id
    ? query.eq("organization_id", pm.organization_id)
    : query.eq("property_manager_id", pm.id);

  const { data: communities } = await query;

  // Same "not actively billed" predicate as allCommunitiesBillingResolved()
  // in app/api/webhooks/stripe/fan-in.ts.
  const onTrial = (
    (communities ?? []) as {
      trial_ends_at: string;
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
    }[]
  ).filter(
    (c) =>
      !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
  if (onTrial.length === 0) return null;

  const days = onTrial.map((c) => trialDaysLeft(c.trial_ends_at));
  const unexpired = days.filter((d) => d >= 0);
  const daysLeft =
    unexpired.length > 0 ? Math.min(...unexpired) : Math.max(...days);

  if (daysLeft > 7) return null;

  return { daysLeft };
}
