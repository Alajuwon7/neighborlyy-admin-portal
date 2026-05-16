import { redirect } from "next/navigation";
import { getAuthenticatedPM } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EventsRedirectPage() {
  const { pm } = await getAuthenticatedPM();
  const supabase = await createClient();

  let commQuery = supabase.from("communities").select("id");
  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }
  const { data: communities } = await commQuery.limit(1);

  const firstId = (communities as { id: string }[] | null)?.[0]?.id;
  if (firstId) {
    redirect(`/dashboard/communities/${firstId}/events`);
  }

  redirect("/dashboard");
}
