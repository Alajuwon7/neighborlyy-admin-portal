import { notFound } from "next/navigation";
import { getCommunityWithAuth } from "@/lib/queries";
import {
  DIGEST_COLUMNS,
  SUGGESTION_COLUMNS,
  attachSuggestions,
  compareWeek,
  formatFriendlyDate,
  isIsoWeekStart,
  nextMondayAfter,
  type Digest,
  type Suggestion,
} from "@/lib/digest";
import { BackLink, WeekDetail } from "@/components/community/WeekDetail";

export const dynamic = "force-dynamic";

export default async function WeekDetailPage({
  params,
}: {
  params: Promise<{ id: string; week: string }>;
}) {
  const { id, week } = await params;
  if (!isIsoWeekStart(week)) notFound();

  const { supabase, community } = await getCommunityWithAuth(id);

  // This week plus up to 4 before it (the suggestions' comparison window), and
  // whether any newer week exists — that decides if the A/B pick is still open.
  const [
    { data: weeksRaw, error: weeksError },
    { data: newerRaw, error: newerError },
    { data: suggestionsRaw, error: suggestionsError },
  ] =
    await Promise.all([
      supabase
        .from("community_digests")
        .select(DIGEST_COLUMNS)
        .eq("community_code", community.community_code)
        .lte("week_start", week)
        .order("week_start", { ascending: false })
        .limit(5),
      supabase
        .from("community_digests")
        .select("week_start")
        .eq("community_code", community.community_code)
        .gt("week_start", week)
        .limit(1),
      supabase
        .from("community_suggestions")
        .select(SUGGESTION_COLUMNS)
        .eq("community_code", community.community_code)
        .eq("week_start", week),
    ]);

  // A failed read must not masquerade as a 404 (weeks) or an open week
  // (newer), so any error renders the error state instead.
  const loadError = weeksError ?? newerError ?? suggestionsError;
  if (loadError) console.error("week detail read failed:", loadError);

  const weeks = (weeksRaw as unknown as Digest[] | null) ?? [];
  const current = weeks[0];
  if (!loadError && (!current || current.week_start !== week)) notFound();

  if (loadError || !current) {
    return (
      <main className="flex-1 p-4 sm:p-6 space-y-4">
        <BackLink communityId={id} />
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            Couldn&apos;t load this week. Please refresh to try again.
          </p>
        </div>
      </main>
    );
  }

  const suggestions = (suggestionsRaw as Suggestion[] | null) ?? [];
  const [digest] = attachSuggestions([current], suggestions);

  return (
    <WeekDetail
      // Remount on server changes so router.refresh() replaces the optimistic copy.
      key={`${current.narrative ? 1 : 0},` + suggestions.map((s) => `${s.id}:${s.status}`).join(",")}
      communityId={id}
      digest={digest}
      comparisons={compareWeek(current, weeks.slice(1))}
      isNewest={(newerRaw ?? []).length === 0}
      nextSummaryLabel={formatFriendlyDate(nextMondayAfter(new Date()))}
    />
  );
}
