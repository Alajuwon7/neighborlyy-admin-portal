"use server";

import { createClient } from "@/lib/supabase/server";
import { differenceInCalendarDays } from "date-fns";

/**
 * Returns the days remaining on the soonest-expiring trial across the signed-in
 * PM's communities, but only when it falls inside the 7-day warning window
 * (daysLeft <= 7, including 0 and negative = already ended). Returns null when
 * there's nothing to warn about, or on any auth/lookup failure — this powers a
 * non-critical banner fetched on mount, so it never redirects or throws.
 */
export async function getTrialStatus(): Promise<{ daysLeft: number } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pmRow } = await supabase
    .from("property_managers")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const pm = pmRow as { id: string; organization_id: string | null } | null;
  if (!pm) return null;

  let query = supabase
    .from("communities")
    .select("trial_ends_at")
    .eq("status", "trial")
    .not("trial_ends_at", "is", null);

  query = pm.organization_id
    ? query.eq("organization_id", pm.organization_id)
    : query.eq("property_manager_id", pm.id);

  const { data: communities } = await query;
  if (!communities || communities.length === 0) return null;

  const today = new Date();
  const soonest = Math.min(
    ...(communities as { trial_ends_at: string }[]).map((c) =>
      differenceInCalendarDays(new Date(c.trial_ends_at), today),
    ),
  );

  if (soonest > 7) return null;

  return { daysLeft: soonest };
}
