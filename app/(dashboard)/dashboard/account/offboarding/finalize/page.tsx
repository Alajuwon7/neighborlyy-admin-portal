import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("deletion_requests")
    .select("id, status")
    .eq("pm_id", pm.id)
    .eq("status", "approved")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) redirect("/dashboard/account");

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4 text-center">
      <h1 className="text-2xl font-bold" style={{ color: "var(--nly-text-primary)" }}>
        Your account is queued for closure
      </h1>
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        We&apos;ll send a final confirmation email when closure completes.
      </p>
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        You can still cancel until closure begins.
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
