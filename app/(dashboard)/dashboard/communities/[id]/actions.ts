"use server";

import { revalidatePath } from "next/cache";
import { getCommunityWithAuth } from "@/lib/queries";

/** Save how many people live in the building (PM's records, not app users). */
export async function updateBuildingResidentCount(communityId: string, raw: string) {
  const { supabase } = await getCommunityWithAuth(communityId);

  const trimmed = raw.trim().replace(/,/g, "");
  const value = trimmed === "" ? null : Number(trimmed);
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100_000)) {
    return { error: "Enter a whole number from 1 to 100,000." };
  }

  const { error } = await supabase
    .from("communities")
    .update({ building_resident_count: value })
    .eq("id", communityId);
  if (error) {
    console.error("Failed to save building resident count:", error);
    return { error: "We couldn't save that. Please try again." };
  }

  revalidatePath(`/dashboard/communities/${communityId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
