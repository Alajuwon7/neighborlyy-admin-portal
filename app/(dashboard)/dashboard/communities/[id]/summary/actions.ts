"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Pick suggestion A or B for the newest week. choose_suggestion (mobile repo)
 * sets this row 'chosen' and its sibling 'not_chosen' in one transaction,
 * authorises the caller (community admin or PM, 20260930170000), and refuses
 * once a newer digest has closed the week. The pick is the same record the
 * app shows.
 */
export async function chooseSuggestion(
  suggestionId: string,
  communityId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("choose_suggestion", { p_suggestion_id: suggestionId });

  if (error) {
    console.error("choose_suggestion failed:", error);
    if (/is closed/i.test(error.message)) {
      return { error: "This week has closed — a newer summary is out. Refresh to see it." };
    }
    if (/not authori[sz]ed/i.test(error.message)) {
      return { error: "You don't have permission to choose for this community." };
    }
    return { error: "Couldn't save your choice. Please try again." };
  }

  revalidatePath(`/dashboard/communities/${communityId}/summary`);
  revalidatePath("/dashboard");
  return { success: true };
}
