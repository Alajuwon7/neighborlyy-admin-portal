"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createFacility(
  formData: FormData,
  communityCode: string,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const capacityRaw = formData.get("capacity") as string;
  const imageUrl = formData.get("image_url") as string;
  const openTime = formData.get("open_time") as string;
  const closeTime = formData.get("close_time") as string;

  if (!name) return { error: "Name is required" };

  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null;

  const { error } = await supabase.from("facilities").insert({
    community_code: communityCode,
    name,
    description: description || null,
    capacity,
    image_url: imageUrl || null,
    open_time: openTime || null,
    close_time: closeTime || null,
    available: true,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/facilities`);
  return { success: true };
}

export async function toggleFacilityAvailability(
  facilityId: string,
  isAvailable: boolean,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("facilities")
    .update({ available: isAvailable })
    .eq("id", facilityId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/facilities`);
  return { success: true };
}

export async function deleteFacility(facilityId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("facilities")
    .delete()
    .eq("id", facilityId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/facilities`);
  return { success: true };
}
