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

  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const type = (formData.get("type") as string) || "announcement";

  if (!title || !body) return { error: "Title and body are required" };

  const { error } = await supabase.from("posts").insert({
    community_code: communityCode,
    author_id: user.id,
    title,
    body,
    type,
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
    .eq("author_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/feed");
  return { success: true };
}
