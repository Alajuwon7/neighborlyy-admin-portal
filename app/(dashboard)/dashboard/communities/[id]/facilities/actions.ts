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
  const type = formData.get("type") as string;
  const description = formData.get("description") as string;
  const hours = formData.get("hours") as string;
  const rules = formData.get("rules") as string;

  if (!name || !type) return { error: "Name and type are required" };

  const { error } = await supabase.from("facilities").insert({
    community_code: communityCode,
    name,
    type,
    description: description || null,
    hours: hours || null,
    rules: rules || null,
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
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
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
