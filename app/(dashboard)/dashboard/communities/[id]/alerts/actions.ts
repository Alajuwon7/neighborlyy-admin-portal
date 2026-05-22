"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { durationToTimestamps } from "@/lib/alerts";

type Priority = "urgent" | "high" | "medium" | "low";

export async function createAlert(
  formData: FormData,
  communityCode: string,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const priority = formData.get("priority") as string;
  const pinDuration = (formData.get("pin_duration") as string) || "off";

  if (!title || !message || !priority) {
    return { error: "Title, message, and priority are required" };
  }

  const { is_pinned, pin_expires_at, valid_until } =
    durationToTimestamps(pinDuration);

  // created_by FKs to profiles.id; PMs live in property_managers, not profiles,
  // so we leave it null for PM-authored community alerts.
  const { error } = await supabase.from("alerts").insert({
    community_code: communityCode,
    title,
    message,
    priority: priority as Priority,
    is_active: true,
    is_pinned,
    pin_expires_at,
    valid_until,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}

export async function updateAlert(
  alertId: string,
  formData: FormData,
  communityId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const priority = formData.get("priority") as string;
  const pinDuration = (formData.get("pin_duration") as string) || "keep";

  if (!title || !message || !priority) {
    return { error: "Title, message, and priority are required" };
  }

  const updates: Record<string, unknown> = {
    title,
    message,
    priority: priority as Priority,
  };

  // "keep" leaves the pin/expiry timestamps untouched; anything else
  // (a duration or "off") reschedules them.
  if (pinDuration !== "keep") {
    Object.assign(updates, durationToTimestamps(pinDuration));
  }

  const { error } = await supabase
    .from("alerts")
    .update(updates)
    .eq("id", alertId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}

export async function deleteAlert(alertId: string, communityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("alerts").delete().eq("id", alertId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}
