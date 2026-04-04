import { redirect } from "next/navigation";
import { getAuthenticatedPM } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EventsRedirectPage() {
  const { pm } = await getAuthenticatedPM();
  const supabase = await createClient();

  const { data: communities } = await supabase
    .from("communities")
    .select("id")
    .eq("property_manager_id", pm.id)
    .limit(1);

  const firstId = (communities as { id: string }[] | null)?.[0]?.id;
  if (firstId) {
    redirect(`/dashboard/communities/${firstId}/events`);
  }

  redirect("/dashboard");
}
