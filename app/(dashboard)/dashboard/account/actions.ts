"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const companyName = formData.get("company_name") as string;

  if (!fullName) return { error: "Full name is required" };

  const { error } = await supabase
    .from("property_managers")
    .update({
      full_name: fullName,
      phone: phone || null,
      company_name: companyName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/account");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { error: error.message };

  return { success: true };
}

export async function deleteAccount(
  password: string,
  transferToMemberId: string | null,
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify password by attempting sign-in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  });
  if (signInError) return { error: "Incorrect password" };

  // Get PM record
  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single();

  if (!pm) return { error: "Profile not found" };

  // Get all communities owned by this PM
  const { data: communities } = await supabase
    .from("communities")
    .select("id")
    .eq("property_manager_id", pm.id);

  const communityIds = (communities ?? []).map((c: { id: string }) => c.id);

  if (communityIds.length > 0) {
    if (transferToMemberId) {
      // Transfer ownership: find the team member's PM record
      const { data: member } = await supabase
        .from("team_members")
        .select("email")
        .eq("id", transferToMemberId)
        .single();

      if (member) {
        // Find or note the target PM — for now, update communities to remove current PM
        // and set status to active (transfer target will claim via their account)
        const { error: transferError } = await supabase
          .from("communities")
          .update({
            property_manager_id: null,
            status: "active" as const,
            updated_at: new Date().toISOString(),
          })
          .in("id", communityIds);

        if (transferError) return { error: `Transfer failed: ${transferError.message}` };
      }
    } else {
      // No transfer — suspend all communities
      const { error: suspendError } = await supabase
        .from("communities")
        .update({
          status: "suspended" as const,
          updated_at: new Date().toISOString(),
        })
        .in("id", communityIds);

      if (suspendError) return { error: `Suspension failed: ${suspendError.message}` };
    }
  }

  // Delete PM record
  await supabase
    .from("property_managers")
    .delete()
    .eq("id", pm.id);

  // Sign out (actual auth user deletion requires admin API / Edge Function)
  await supabase.auth.signOut();

  return { success: true };
}

export async function getTeamMembersForTransfer() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!pm) return [];

  // Get active team members across all communities
  const { data: members } = await supabase
    .from("team_members")
    .select("id, full_name, email, role, community_id")
    .eq("status", "active");

  return (members ?? []) as { id: string; full_name: string; email: string; role: string; community_id: string }[];
}
