import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DispositionCards } from "./DispositionCards";
import type { CommunityDisposition } from "@/lib/offboarding/types";
import type { CommunitySummary } from "@/lib/offboarding/disposition";

export default async function DispositionPage() {
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

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status, stripe_resolved_at, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "in_review")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req || !req.stripe_resolved_at) {
    redirect("/dashboard/account/offboarding/billing");
  }

  const { data: summaries } = await admin
    .from("community_audit_summary")
    .select("*")
    .eq("organization_id", pm.organization_id);

  const communities = (summaries ?? []) as CommunitySummary[];
  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];

  // Defense in depth: a PM with zero communities shouldn't reach disposition,
  // but if they do, render an explicit empty state instead of stranding them
  // with an indefinitely-disabled Continue button.
  if (communities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          No communities to disposition
        </h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Your organization has no communities. Please contact support@neighborlyy.com
          to complete account closure.
        </p>
        <Link
          href="/dashboard/account"
          className="inline-block text-xs underline"
          style={{ color: "var(--nly-text-tertiary)" }}
        >
          Return to account settings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          Choose what happens to your communities
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--nly-text-secondary)" }}>
          You must make a decision for each community before your account can be closed.
        </p>
      </header>

      <DispositionCards
        deletionRequestId={req.id}
        communities={communities}
        initialDispositions={dispositions}
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
