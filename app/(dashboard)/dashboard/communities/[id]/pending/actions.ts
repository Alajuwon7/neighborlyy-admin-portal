"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveResident(pendingUserId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("approve_pending_user", {
    p_pending_user_id: pendingUserId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function denyResident(pendingUserId: string, communityId: string, reason?: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // rejected_users.rejected_by FK → profiles.id. Most PMs don't have a profiles
  // row (admin signup creates a property_managers row only); check first and
  // pass null when the PM has no profile, so the FK insert doesn't violate.
  // When the PM does have one (e.g. former resident, manual seed), audit info
  // is preserved.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.rpc("deny_pending_user", {
    p_pending_user_id: pendingUserId,
    p_reason: reason ?? null,
    p_rejected_by: profile?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkApproveResidents(
  pendingUserIds: string[],
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const results = await Promise.all(
    pendingUserIds.map((id) =>
      supabase.rpc("approve_pending_user", { p_pending_user_id: id })
    )
  );

  const firstError = results.find((r) => r.error);
  if (firstError?.error) return { error: firstError.error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  revalidatePath("/dashboard");
  return { success: true };
}
