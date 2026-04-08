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
  const eventDate = formData.get("event_date") as string;
  const maxAttendees = formData.get("max_attendees") as string;

  if (!title || !eventDate) return { error: "Title and date are required" };

  const { error } = await supabase.from("events").insert({
    community_code: communityCode,
    title,
    description: description || null,
    location: location || null,
    event_date: eventDate,
    max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/events`);
  return { success: true };
}

export async function updateEvent(
  eventId: string,
  formData: FormData,
  communityId: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const location = formData.get("location") as string;
  const eventDate = formData.get("event_date") as string;
  const maxAttendees = formData.get("max_attendees") as string;

  if (!title || !eventDate) return { error: "Title and date are required" };

  const { error } = await supabase
    .from("events")
    .update({
      title,
      description: description || null,
      location: location || null,
      event_date: eventDate,
      max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
    })
    .eq("id", eventId);

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
