import { SupabaseClient } from "@supabase/supabase-js";

export interface Nudge {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
  color: string;
}

/**
 * Computes smart nudge cards from real community data.
 * Returns max 3 nudges, sorted by priority.
 */
export async function computeNudges(
  supabase: SupabaseClient,
  communityIds: string[],
  communityNames: Map<string, string>,
): Promise<Nudge[]> {
  const nudges: Nudge[] = [];

  if (communityIds.length === 0) return nudges;

  const codes = await getCommunityCodesForIds(supabase, communityIds);
  if (codes.length === 0) return nudges;

  // 1. Check pending residents
  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("community_code", codes)
    .eq("status", "pending");

  if (pendingCount && pendingCount > 0) {
    nudges.push({
      id: "pending-residents",
      icon: "\uD83D\uDC4B",
      title: `You've got ${pendingCount} new resident${pendingCount > 1 ? "s" : ""} waiting!`,
      subtitle: "Timely approvals make a great first impression.",
      actionLabel: "Review now",
      actionHref: `/dashboard/communities/${communityIds[0]}/pending`,
      color: "var(--nly-warning)",
    });
  }

  // 2. Check last event date
  const { data: lastEvent } = await supabase
    .from("events")
    .select("event_date")
    .in("community_code", codes)
    .order("event_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEvent?.event_date) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastEvent.event_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= 7) {
      nudges.push({
        id: "event-gap",
        icon: "\uD83D\uDCC5",
        title: `It's been ${daysSince} days since your last event`,
        subtitle: "Communities with weekly events keep residents 40% more engaged.",
        actionLabel: "Create one",
        actionHref: `/dashboard/communities/${communityIds[0]}/events`,
        color: "var(--nly-accent)",
      });
    }
  } else {
    nudges.push({
      id: "no-events",
      icon: "\uD83D\uDCC5",
      title: "No events yet \u2014 your residents are waiting!",
      subtitle: "A simple meetup or announcement gets the ball rolling.",
      actionLabel: "Create your first event",
      actionHref: `/dashboard/communities/${communityIds[0]}/events`,
      color: "var(--nly-accent)",
    });
  }

  // 3. Check resident milestones
  for (const cId of communityIds) {
    const cCodes = await getCommunityCodesForIds(supabase, [cId]);
    const { count: residentCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("community_code", cCodes)
      .eq("status", "approved");

    if (residentCount) {
      const milestones = [100, 50, 25];
      for (const m of milestones) {
        if (residentCount >= m && residentCount < m + 5) {
          const name = communityNames.get(cId) ?? "Your community";
          nudges.push({
            id: `milestone-${cId}-${m}`,
            icon: "\uD83C\uDF89",
            title: `${name} just hit ${m} residents!`,
            subtitle: "Nice milestone! Consider posting a welcome message to celebrate.",
            actionLabel: "Post an update",
            actionHref: `/dashboard/feed`,
            color: "var(--nly-success)",
          });
          break;
        }
      }
    }
  }

  // 4. Day-of-week contextual nudge
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5) {
    nudges.push({
      id: "friday-nudge",
      icon: "\uD83C\uDFAF",
      title: "Happy Friday! Plan something for the weekend?",
      subtitle: "Weekend events get 2x more RSVPs than weekday ones.",
      actionLabel: "Create an event",
      actionHref: `/dashboard/communities/${communityIds[0]}/events`,
      color: "var(--nly-brand)",
    });
  }

  return nudges.slice(0, 3);
}

async function getCommunityCodesForIds(
  supabase: SupabaseClient,
  communityIds: string[],
): Promise<string[]> {
  const { data } = await supabase
    .from("communities")
    .select("community_code")
    .in("id", communityIds);

  return (data ?? [])
    .map((c: { community_code: string }) => c.community_code)
    .filter(Boolean);
}
