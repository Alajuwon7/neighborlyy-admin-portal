import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OffboardingStatusCard } from "@/components/dashboard/OffboardingStatusCard";
import type { DeletionRequestRow } from "@/lib/offboarding/types";

export default async function FinalizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pm) redirect("/dashboard/account");

  const { data: req } = await supabase
    .from("deletion_requests")
    .select("id, status")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  // Hydrate the full row so the OffboardingStatusCard can render with realtime
  // + cancel actions. Stub copy lives above the card; the card itself provides
  // the cancel UX promised by the spec.
  const { data: fullRequest } = await supabase
    .from("deletion_requests")
    .select("*")
    .eq("id", req.id)
    .maybeSingle();

  if (!fullRequest) redirect("/dashboard/account");

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
          Your account is queued for closure
        </h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          We&apos;ll send a final confirmation email when closure completes.
        </p>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          You can still cancel until closure begins.
        </p>
      </div>

      <OffboardingStatusCard initialRequest={fullRequest as DeletionRequestRow} />

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
