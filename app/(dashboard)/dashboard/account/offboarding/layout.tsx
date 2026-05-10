import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  OPEN_DELETION_STATUSES,
  type DeletionStatus,
} from "@/lib/offboarding/types";

/**
 * Layout guard for /dashboard/account/offboarding/*.
 *
 * Enforces the deletion-request status state machine: a PM can only see the
 * step that matches their current request status. Anything else gets bounced
 * either back to /dashboard/account (no/closed request) or to the correct step.
 */
export default async function OffboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!pm) redirect("/dashboard/account");

  // Only OPEN statuses are interesting; terminal statuses (cancelled, blocked,
  // completed) aren't in OPEN_DELETION_STATUSES so this returns null and we
  // bounce to /dashboard/account.
  const { data: req } = await supabase
    .from("deletion_requests")
    .select("status, stripe_resolved_at")
    .eq("pm_id", pm.id)
    .in("status", OPEN_DELETION_STATUSES)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) redirect("/dashboard/account");

  const path = (await headers()).get("x-pathname") ?? "";
  const status = req.status as DeletionStatus;

  // pending / awaiting_corp_approval — request exists but PM has no UI step
  // here; bounce back to the account page where status is shown.
  if (status === "pending" || status === "awaiting_corp_approval") {
    redirect("/dashboard/account");
  }

  // billing_blocked — only /billing
  if (status === "billing_blocked" && !path.endsWith("/billing")) {
    redirect("/dashboard/account/offboarding/billing");
  }

  // in_review without billing resolved — only /billing
  if (status === "in_review" && !req.stripe_resolved_at) {
    if (!path.endsWith("/billing")) {
      redirect("/dashboard/account/offboarding/billing");
    }
  }

  // in_review with billing resolved — only /disposition
  if (status === "in_review" && req.stripe_resolved_at) {
    if (!path.endsWith("/disposition")) {
      redirect("/dashboard/account/offboarding/disposition");
    }
  }

  // approved — only /finalize
  if (status === "approved" && !path.endsWith("/finalize")) {
    redirect("/dashboard/account/offboarding/finalize");
  }

  return <>{children}</>;
}
