"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function inviteTeamMember(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("community_id") as string;
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;

  if (!communityId || !fullName || !email || !role) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase.from("team_members").insert({
    community_id: communityId,
    full_name: fullName,
    email,
    role: role as "owner" | "manager" | "assistant_manager" | "leasing_agent",
    status: "invited",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This email is already invited to this community" };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/team");
  return { success: true };
}

export async function updateTeamMemberStatus(
  memberId: string,
  status: "active" | "deactivated"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("team_members")
    .update({
      status,
      ...(status === "active" ? { joined_at: new Date().toISOString() } : {}),
    })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/team");
  return { success: true };
}
