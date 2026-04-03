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

  if (!title || !message || !priority) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase.from("alerts").insert({
    community_code: communityCode,
    title,
    message,
    priority: priority as "urgent" | "high" | "medium" | "low",
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/communities/${communityId}/alerts`);
  return { success: true };
}
