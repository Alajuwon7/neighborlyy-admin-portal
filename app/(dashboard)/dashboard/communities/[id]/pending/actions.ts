"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Since mobile migration 20260923170420 the decision RPCs check the caller via
// can_decide_pending_user() and delete the pending_users row once decided, so a
// row approved elsewhere (another PM, a mobile admin) raises instead of no-oping.
type DecisionResult = { error?: string; success?: boolean };

function decisionError(action: string, error: { message: string }): DecisionResult {
  console.error(`${action} failed:`, error);
  if (/unauthori[sz]ed|not allowed|permission/i.test(error.message)) {
    return { error: "You don't have permission to review applicants for this community." };
  }
  if (/not found|already been decided/i.test(error.message)) {
    return { error: "This application was already reviewed. Refresh to see the latest queue." };
  }
  return { error: "Something went wrong. Please try again." };
}

export async function approveResident(pendingUserId: string, communityId: string): Promise<DecisionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("approve_pending_user", {
    p_pending_user_id: pendingUserId,
  });

  if (error) return decisionError("approve_pending_user", error);

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function denyResident(
  pendingUserId: string,
  communityId: string,
  reason?: string
): Promise<DecisionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // The RPC ignores p_rejected_by for signed-in callers and records the caller
  // itself (NULL for a PM without a profiles row). It's still passed explicitly
  // to pin the call to the secured 3-arg signature — portal migration 015's
  // 2-arg (uuid, text) overload is gone (verified in prod 2026-09-30), and if it
  // were ever recreated a 2-arg call would be ambiguous (PGRST203).
  const { error } = await supabase.rpc("deny_pending_user", {
    p_pending_user_id: pendingUserId,
    p_reason: reason ?? null,
    p_rejected_by: null,
  });

  if (error) return decisionError("deny_pending_user", error);

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkApproveResidents(
  pendingUserIds: string[],
  communityId: string
): Promise<DecisionResult & { approvedIds: string[] }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", approvedIds: [] };

  const results = await Promise.all(
    pendingUserIds.map((id) =>
      supabase.rpc("approve_pending_user", { p_pending_user_id: id })
    )
  );

  // Each approval is independent — a row already decided elsewhere fails
  // without rolling back the rest — so report exactly which ones went through.
  const approvedIds = pendingUserIds.filter((_, i) => !results[i].error);
  if (approvedIds.length > 0) {
    revalidatePath(`/dashboard/communities/${communityId}/pending`);
    revalidatePath("/dashboard");
  }

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    return { ...decisionError("approve_pending_user (bulk)", firstError), approvedIds };
  }
  return { success: true, approvedIds };
}
