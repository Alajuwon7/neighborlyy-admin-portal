"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveResident(profileId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  return { success: true };
}

export async function denyResident(profileId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "denied", updated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  return { success: true };
}

export async function bulkApproveResidents(
  profileIds: string[],
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .in("id", profileIds);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/pending`);
  return { success: true };
}
