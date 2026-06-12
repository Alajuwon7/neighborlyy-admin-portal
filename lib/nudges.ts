import { SupabaseClient } from "@supabase/supabase-js";
import { filterResidents } from "@/lib/residents";

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

  const pairs = await getCommunityPairs(supabase, communityIds);
  const codes = pairs.map((p) => p.community_code);
  if (codes.length === 0) return nudges;

  // 1. Check pending residents.
  // Source must match the approval queue the "Review now" CTA opens
  // (/communities/[id]/pending) and the approve/deny RPCs — all of which use
  // pending_users, NOT profiles. Counting profiles.status='pending' here caused
  // a stale "N residents waiting" nudge that pointed at an empty pending page.
  const { data: pendingRows } = await supabase
    .from("pending_users")
    .select("community_code")
    .in("community_code", codes)
    .eq("status", "pending");

  const pendingCount = pendingRows?.length ?? 0;
  if (pendingCount > 0) {
    // Link the CTA to the community with the most people waiting — the count
    // spans all communities, so always linking communityIds[0] sent PMs to an
    // empty approval queue whenever the pending residents were elsewhere.
    const countsByCode = new Map<string, number>();
    for (const row of pendingRows as { community_code: string }[]) {
      countsByCode.set(
        row.community_code,
        (countsByCode.get(row.community_code) ?? 0) + 1,
      );
    }
    const [topCode] = [...countsByCode.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const targetId =
      pairs.find((p) => p.community_code === topCode)?.id ?? communityIds[0];

    nudges.push({
      id: "pending-residents",
      icon: "\uD83D\uDC4B",
      title: `You've got ${pendingCount} new resident${pendingCount > 1 ? "s" : ""} waiting!`,
      subtitle: "Timely approvals make a great first impression.",
      actionLabel: "Review now",
      actionHref: `/dashboard/communities/${targetId}/pending`,
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
    const cCodes = pairs
      .filter((p) => p.id === cId)
      .map((p) => p.community_code);
    const { count: residentCount } = await filterResidents(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("community_code", cCodes),
    );

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

async function getCommunityPairs(
  supabase: SupabaseClient,
  communityIds: string[],
): Promise<{ id: string; community_code: string }[]> {
  const { data } = await supabase
    .from("communities")
    .select("id, community_code")
    .in("id", communityIds);

  return ((data ?? []) as { id: string; community_code: string }[]).filter(
    (c) => Boolean(c.community_code),
  );
}
