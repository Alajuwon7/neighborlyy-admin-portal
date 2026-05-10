"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { appendAudit } from "@/lib/offboarding/audit";

type ActionResult = { ok: true } | { ok: false; error: string };

type LoadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      user: { id: string };
      pm: { id: string; organization_id: string };
      admin: ReturnType<typeof createAdminClient>;
      req: {
        id: string;
        org_id: string;
        status: string;
        stripe_resolved_at: string | null;
      };
    };

async function loadPmAndRequest(): Promise<LoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) return { ok: false, error: "Profile not found" };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, org_id, status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", ["in_review", "billing_blocked"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { ok: false, error: "No active deletion request" };

  return { ok: true, user, pm, admin, req };
}

export async function cancelSubscription(communityId: string): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { user, pm, admin } = ctx;

  const { data: community } = await admin
    .from("communities")
    .select("id, organization_id, stripe_subscription_id, stripe_subscription_status")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) return { ok: false, error: "Community not found" };
  if (community.organization_id !== pm.organization_id) {
    return { ok: false, error: "Not your community" };
  }
  if (!community.stripe_subscription_id) {
    return { ok: false, error: "No active subscription" };
  }

  // Idempotent: already canceled or scheduled → return success without re-calling Stripe.
  if (
    community.stripe_subscription_status === "canceled" ||
    community.stripe_subscription_status === "cancel_scheduled"
  ) {
    return { ok: true };
  }

  try {
    await getStripe().subscriptions.update(community.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe cancellation failed",
    };
  }

  // Optimistic mirror; webhook will confirm with final status.
  await admin
    .from("communities")
    .update({ stripe_subscription_status: "cancel_scheduled" })
    .eq("id", communityId);

  try {
    await appendAudit(admin, "deletion_requests", ctx.req.id, {
      actor: "pm",
      actor_id: user.id,
      action: "subscription_cancellation_scheduled",
      note: `community=${communityId}; subscription=${community.stripe_subscription_id}`,
    });
  } catch (err) {
    // Audit gap. The state change already committed; surface a warning to
    // server logs but don't fail the user's request. Replay surface is the
    // recorded stripe_webhook_events row + the communities row mutation.
    console.warn("[offboarding] audit append failed for cancelSubscription", err);
  }

  revalidatePath("/dashboard/account/offboarding/billing");
  return { ok: true };
}

export async function markBillingResolved(): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { admin, req } = ctx;

  // Re-check: this should only run when no community has an active sub.
  const { data: communities } = await admin
    .from("communities")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("organization_id", req.org_id);

  const allDone = (communities ?? []).every(
    (c) => !c.stripe_subscription_id || c.stripe_subscription_status === "canceled",
  );
  if (!allDone) return { ok: false, error: "Not all subscriptions are canceled" };

  if (!req.stripe_resolved_at) {
    await admin
      .from("deletion_requests")
      .update({ stripe_resolved_at: new Date().toISOString() })
      .eq("id", req.id)
      .is("stripe_resolved_at", null);

    try {
      await appendAudit(admin, "deletion_requests", req.id, {
        actor: "system",
        actor_id: "auto-pass",
        action: "billing_resolved",
        note: "no active subscriptions on any community",
      });
    } catch (err) {
      console.warn("[offboarding] audit append failed for markBillingResolved", err);
    }
  }

  revalidatePath("/dashboard/account/offboarding/billing");
  return { ok: true };
}
