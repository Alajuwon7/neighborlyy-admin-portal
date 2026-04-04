"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPost(
  formData: FormData,
  communityCode: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;

  if (!content) return { error: "Message content is required" };

  const { error } = await supabase.from("posts").insert({
    community_code: communityCode,
    user_id: user.id,
    content,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/feed");
  return { success: true };
}

export async function deletePost(postId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/feed");
  return { success: true };
}
