import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispositionLabel } from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";
import { FinalConfirmation } from "./FinalConfirmation";

// Screen 5 — final confirmation before the PII wipe. The offboarding layout
// guard already restricts this route to status='approved'; the redirects below
// are belt-and-suspenders (and mirror the prior stub).
export default async function FinalizePage() {
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
  if (!pm.organization_id) redirect("/dashboard/account");

  const { data: req } = await supabase
    .from("deletion_requests")
    .select("id, status, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  const admin = createAdminClient();

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  const { data: communities } = await admin
    .from("communities")
    .select("id, name, community_code, stripe_cancel_at")
    .eq("organization_id", pm.organization_id);
  const communityRows = communities ?? [];

  const communitySummary = communityRows.map((c) => {
    const d = dispositions.find((x) => x.community_id === c.id);
    return {
      id: c.id,
      name: c.name ?? c.community_code ?? "Community",
      label: d ? dispositionLabel(d.action) : "No disposition recorded",
    };
  });

  // Build the billing line from ALL communities with a non-null stripe_cancel_at.
  // For multi-community orgs we show the LATEST cancellation date (the actual
  // "all subscriptions are gone" date) plus the count, rather than picking an
  // arbitrary first match.
  const cancelDates = communityRows
    .filter((c): c is typeof c & { stripe_cancel_at: string } =>
      typeof c.stripe_cancel_at === "string" && c.stripe_cancel_at.length > 0,
    )
    .sort((a, b) => Date.parse(b.stripe_cancel_at) - Date.parse(a.stripe_cancel_at));

  const billingLine =
    cancelDates.length === 0
      ? "No active subscription"
      : cancelDates.length === 1
        ? `Subscription cancelled, effective ${new Date(
            cancelDates[0].stripe_cancel_at,
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`
        : `${cancelDates.length} subscriptions cancelling — last effective ${new Date(
            cancelDates[0].stripe_cancel_at,
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`;

  const sectionStyle = {
    backgroundColor: "var(--nly-surface)",
    borderColor: "var(--nly-border)",
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Your account is ready to be closed
        </h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Here&apos;s a summary of what will happen.
        </p>
      </div>

      <section className="rounded-2xl border p-5 space-y-4" style={sectionStyle}>
        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Communities
          </h2>
          <ul
            className="text-sm space-y-1"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            {communitySummary.length === 0 ? (
              <li>No communities required handoff.</li>
            ) : (
              communitySummary.map((c) => (
                <li key={c.id}>
                  {c.name} — {c.label}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Billing
          </h2>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            {billingLine}
          </p>
        </div>

        <div className="space-y-1">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Your data
          </h2>
          <ul
            className="text-sm space-y-1"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            <li>Your name, email, and phone will be wiped.</li>
            <li>Your login will be disabled immediately.</li>
            <li>Your residents&apos; data is fully preserved.</li>
            <li>A permanent compliance record of this process is kept.</li>
          </ul>
        </div>
      </section>

      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        You have 30 days to request a data export after closure — contact
        support@miyora.com.
      </p>

      <FinalConfirmation requestId={req.id} />

      <div className="text-center">
        <Link
          href="/dashboard/account"
          className="text-xs underline"
          style={{ color: "var(--nly-text-tertiary)" }}
        >
          Return to account settings
        </Link>
      </div>
    </div>
  );
}
