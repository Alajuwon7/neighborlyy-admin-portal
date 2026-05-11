import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { markBillingResolved } from "./actions";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) redirect("/dashboard/account");

  const { data: req } = await supabase
    .from("deletion_requests")
    .select("id, status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", ["in_review", "billing_blocked"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, stripe_subscription_id, stripe_subscription_status, stripe_cancel_at")
    .eq("organization_id", pm.organization_id);

  const list = communities ?? [];
  const hasAnyActiveSub = list.some(
    (c) => c.stripe_subscription_id && c.stripe_subscription_status !== "canceled",
  );

  // Auto-pass: nothing to cancel.
  if (!hasAnyActiveSub && !req.stripe_resolved_at) {
    const result = await markBillingResolved();
    if (result.ok) {
      redirect("/dashboard/account/offboarding/disposition");
    }
    // If result.ok is false (TOCTOU race: a sub was created between page
    // load and action), fall through to render the billing UI so the user
    // sees the active sub and can cancel it manually.
  }

  if (req.stripe_resolved_at) {
    redirect("/dashboard/account/offboarding/disposition");
  }

  const isBlocked = req.status === "billing_blocked";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          Account closure — Step 1 of 2: Billing review
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--nly-text-secondary)" }}>
          We&apos;ll cancel each community subscription at the end of its current
          billing period. Review and confirm below.
        </p>
      </header>

      {isBlocked && (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{ borderColor: "var(--nly-error)", color: "var(--nly-error)" }}
          role="alert"
        >
          A recent payment failed. Please resolve the outstanding invoice in the
          Stripe customer portal before continuing.
        </div>
      )}

      <BillingClient
        deletionRequestId={req.id}
        initialCommunities={list.map((c) => ({
          id: c.id,
          name: c.name,
          stripe_subscription_id: c.stripe_subscription_id,
          stripe_subscription_status: c.stripe_subscription_status,
          stripe_cancel_at: c.stripe_cancel_at,
        }))}
      />

      <Link
        href="/dashboard/account"
        className="text-xs underline"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        Cancel and return to account settings
      </Link>
    </div>
  );
}
