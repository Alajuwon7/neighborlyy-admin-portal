"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/offboarding/audit";
import {
  isDispositionAction,
  canCloseCommunity,
  allCommunitiesHaveDisposition,
  type DispositionAction,
} from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";

type ActionResult = { ok: true } | { ok: false; error: string };

type LoadCtx =
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
        community_disposition: CommunityDisposition[] | null;
      };
    };

async function loadPmAndRequest(): Promise<LoadCtx> {
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
    .select("id, org_id, status, stripe_resolved_at, community_disposition")
    .eq("pm_id", pm.id)
    .eq("status", "in_review")
    .not("stripe_resolved_at", "is", null)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return { ok: false, error: "No active deletion request in disposition stage" };

  return { ok: true, user, pm, admin, req };
}

export async function setCommunityDisposition(
  communityId: string,
  action: string,
  notes?: string,
): Promise<ActionResult> {
  if (!isDispositionAction(action)) {
    return { ok: false, error: "Invalid disposition action" };
  }
  if (action === "transfer") {
    return { ok: false, error: "Transfer disposition is not yet available" };
  }

  const ctx = await loadPmAndRequest();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { user, pm, admin, req } = ctx;

  const { data: community } = await admin
    .from("communities")
    .select("id, organization_id, community_code, name")
    .eq("id", communityId)
    .maybeSingle();
  if (!community || community.organization_id !== pm.organization_id) {
    return { ok: false, error: "Community not found" };
  }

  if (action === "close") {
    const { data: summary } = await admin
      .from("community_audit_summary")
      .select("active_residents")
      .eq("community_id", communityId)
      .maybeSingle();
    if (!summary || !canCloseCommunity(summary.active_residents)) {
      return { ok: false, error: "Cannot close — community still has active residents" };
    }
  }

  const newEntry: CommunityDisposition = {
    community_id: communityId,
    action: action as Exclude<DispositionAction, "transfer">,
    notes: notes?.slice(0, 500),
    set_at: new Date().toISOString(),
  };

  const { error: updateError } = await admin.rpc("set_community_disposition", {
    p_request_id: req.id,
    p_community_id: communityId,
    p_entry: newEntry,
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (action === "suspend") {
    await admin
      .from("communities")
      .update({ suspended_reason: "PM offboarding" })
      .eq("id", communityId);

    // CC-6: mobile-side push notification for community suspension.
    //
    // We previously attempted to write to `admin_notifications` here as a
    // stub, but that table is the wrong surface for this signal:
    //   1. Its `type` column has a CHECK constraint limited to
    //      ('pending_resident', 'event_rsvp', 'facility_reservation',
    //       'help_request') — adding 'community_suspended' would require
    //      a schema migration AND coordinated UI changes in the admin
    //      portal bell-dropdown and notifications page.
    //   2. `admin_notifications` is admin-portal-internal (populated by
    //      triggers on mobile-write tables and read by the PM dashboard).
    //      The PM who just clicked Suspend would only be notifying
    //      themselves.
    //   3. The actual mobile push fan-out belongs in a dedicated
    //      mechanism (Expo push tokens / FCM) targeting residents.
    //
    // The audit log entry below is the durable record of the suspend
    // action; CC-6 will layer mobile push on top in a follow-up that
    // includes the schema/UI changes the proper notification surface
    // requires.
  }

  try {
    await appendAudit(admin, "deletion_requests", req.id, {
      actor: "pm",
      actor_id: user.id,
      action: `disposition_set_${action}`,
      note: `community=${community.community_code}`,
    });
  } catch (err) {
    console.warn("[offboarding] audit append failed for setCommunityDisposition", err);
  }

  revalidatePath("/dashboard/account/offboarding/disposition");
  return { ok: true };
}

export async function finalizeDispositions(): Promise<ActionResult> {
  const ctx = await loadPmAndRequest();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { user, pm, admin, req } = ctx;

  const { data: communities } = await admin
    .from("communities")
    .select("id")
    .eq("organization_id", pm.organization_id);
  const communityIds = (communities ?? []).map((c) => c.id);

  const dispositions = (req.community_disposition ?? []) as CommunityDisposition[];
  if (!allCommunitiesHaveDisposition(communityIds, dispositions)) {
    return { ok: false, error: "Every community needs a disposition before continuing" };
  }

  const { error: updateError } = await admin
    .from("deletion_requests")
    .update({ status: "approved" })
    .eq("id", req.id)
    .eq("status", "in_review");
  if (updateError) return { ok: false, error: updateError.message };

  try {
    await appendAudit(admin, "deletion_requests", req.id, {
      actor: "pm",
      actor_id: user.id,
      action: "dispositions_finalized",
      note: `count=${dispositions.length}`,
    });
  } catch (err) {
    console.warn("[offboarding] audit append failed for finalizeDispositions", err);
  }

  revalidatePath("/dashboard/account/offboarding/disposition");
  redirect("/dashboard/account/offboarding/finalize");
}
