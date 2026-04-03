"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createEvent(formData: FormData, communityCode: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const location = formData.get("location") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;

  if (!title || !startTime) return { error: "Title and start time are required" };

  const { error } = await supabase.from("events").insert({
    community_code: communityCode,
    title,
    description: description || null,
    location: location || null,
    start_time: startTime,
    end_time: endTime || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/events`);
  return { success: true };
}

export async function deleteEvent(eventId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/events`);
  return { success: true };
}
