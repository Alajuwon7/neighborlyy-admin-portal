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
    const { error: suspendError } = await admin
      .from("communities")
      .update({ suspended_reason: "PM offboarding" })
      .eq("id", communityId);
    if (suspendError) {
      // Failure to set suspended_reason is more critical than the notification
      // stub since it's the actual user-visible state change. Log loudly so
      // operators see it; the disposition row was committed via the RPC above.
      console.warn(
        "[offboarding] communities.suspended_reason update failed",
        { communityId, error: suspendError },
      );
    }

    // CC-6 stub: insert admin_notifications row for the mobile workstream to
    // consume and fan out resident push notifications. Migration 029 extended
    // the type CHECK constraint to allow 'community_suspended'. Schema-correct
    // shape verified against the live DB at task time. Failure is logged but
    // non-fatal — the disposition itself committed via the RPC above.
    const { error: notifyError } = await admin.from("admin_notifications").insert({
      community_code: community.community_code,
      type: "community_suspended",
      title: `Community suspended: ${community.name}`,
      body: "This community is being suspended because the property manager is closing their Miyora account.",
      reference_id: req.id,
      reference_table: "deletion_requests",
    });
    if (notifyError) {
      console.warn(
        "[offboarding] admin_notifications insert failed for suspend disposition",
        notifyError,
      );
    }
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
