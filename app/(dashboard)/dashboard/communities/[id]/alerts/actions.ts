"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const validUntil = formData.get("valid_until") as string;
  const isPinned = formData.get("is_pinned") === "true";

  if (!title || !message || !priority) {
    return { error: "Title, message, and priority are required" };
  }

  // created_by FKs to profiles.id; property managers live in property_managers,
  // not profiles, so we leave it null for PM-authored community alerts.
  const { error } = await supabase.from("alerts").insert({
    community_code: communityCode,
    title,
    message,
    priority: priority as "urgent" | "high" | "medium" | "low",
    is_active: true,
    is_pinned: isPinned,
    valid_until: validUntil || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}
