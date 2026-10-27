"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Empty -> null (no limit); otherwise a positive whole number.
function parseMaxAttendees(raw: FormDataEntryValue | null): number | null | "invalid" {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : "invalid";
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Uploads an event image to the shared 'events' bucket via the service role.
// The bucket's RLS only allows mobile admins (profiles.role='admin') to insert,
// and portal PMs/team members have no such profiles row — so we authenticate +
// authorize in the action, then upload with the service role. Returns the
// public URL (events.image_url) or an error string.
async function uploadEventImage(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Image must be a JPG, PNG, or WebP file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 5MB or smaller." };
  }
  const ext = EXT_BY_TYPE[file.type];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("events")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Event image upload failed:", error);
    return { error: "We couldn't upload that image. Please try again." };
  }
  const { data } = admin.storage.from("events").getPublicUrl(path);
  return { url: data.publicUrl };
}

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

  if (!title || !eventDate) return { error: "Title and date are required" };

  const maxAttendees = parseMaxAttendees(formData.get("max_attendees"));
  if (maxAttendees === "invalid") {
    return { error: "Max attendees must be a whole number of 1 or more." };
  }

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadEventImage(image, user.id);
    if ("error" in uploaded) return { error: uploaded.error };
    imageUrl = uploaded.url;
  }

  const { error } = await supabase.from("events").insert({
    community_code: communityCode,
    title,
    description: description || null,
    location: location || null,
    event_date: eventDate,
    image_url: imageUrl,
    max_attendees: maxAttendees,
  });

  if (error) {
    console.error("Failed to create event:", error);
    return { error: "We couldn't create this event. Please try again." };
  }

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
  const maxAttendees = parseMaxAttendees(formData.get("max_attendees"));

  if (!title || !eventDate) return { error: "Title and date are required" };
  if (maxAttendees === "invalid") {
    return { error: "Max attendees must be a whole number of 1 or more." };
  }

  const updates: Record<string, unknown> = {
    title,
    description: description || null,
    location: location || null,
    event_date: eventDate,
    max_attendees: maxAttendees,
  };

  // Image: a new file replaces it; the remove_image flag clears it; otherwise
  // leave image_url untouched.
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadEventImage(image, user.id);
    if ("error" in uploaded) return { error: uploaded.error };
    updates.image_url = uploaded.url;
  } else if (formData.get("remove_image") === "true") {
    updates.image_url = null;
  }

  const { error } = await supabase.from("events").update(updates).eq("id", eventId);

  if (error) {
    console.error("Failed to update event:", error);
    return { error: "We couldn't save your changes. Please try again." };
  }

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

  if (error) {
    console.error("Failed to delete event:", error);
    return { error: "We couldn't delete this event. Please try again." };
  }

  revalidatePath(`/dashboard/communities/${communityId}/events`);
  return { success: true };
}
