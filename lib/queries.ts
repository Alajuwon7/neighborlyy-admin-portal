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
    .select("id, full_name, email, phone, company_name")
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
    },
  };
}

export async function getCommunityWithAuth(communityId: string) {
  const { supabase, pm } = await getAuthenticatedPM();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (!community) redirect("/dashboard/communities");

  return {
    supabase,
    pm,
    community: community as NonNullable<typeof community>,
  };
}
