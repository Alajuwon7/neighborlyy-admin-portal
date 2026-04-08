import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getAuthenticatedPM() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, full_name, email, phone, company_name, organization_id")
    .eq("user_id", user.id)
    .single();

  if (!pm) redirect("/onboarding");

  return {
    supabase,
    user,
    pm: pm as {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      company_name: string | null;
      organization_id: string | null;
    },
  };
}

export async function getCommunityWithAuth(communityId: string) {
  const { supabase, pm } = await getAuthenticatedPM();

  // Use organization_id for access check when available (allows org-level access),
  // fall back to property_manager_id for PMs without an org yet.
  let query = supabase
    .from("communities")
    .select("*")
    .eq("id", communityId);

  if (pm.organization_id) {
    query = query.eq("organization_id", pm.organization_id);
  } else {
    query = query.eq("property_manager_id", pm.id);
  }

  const { data: community } = await query.single();

  if (!community) redirect("/dashboard/communities");

  return {
    supabase,
    pm,
    community: community as NonNullable<typeof community>,
  };
}
