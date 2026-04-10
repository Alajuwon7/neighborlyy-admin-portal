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

  const { error } = await supabase.rpc("deny_pending_user", {
    p_pending_user_id: pendingUserId,
    p_reason: reason ?? null,
    p_rejected_by: null,
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
