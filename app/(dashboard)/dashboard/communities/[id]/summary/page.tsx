import { getCommunityWithAuth } from "@/lib/queries";
import {
  DIGEST_COLUMNS,
  SUGGESTION_COLUMNS,
  attachSuggestions,
  formatFriendlyDate,
  nextMondayAfter,
  type Digest,
  type Suggestion,
} from "@/lib/digest";
import { WeeklySummaryList } from "@/components/community/WeeklySummaryList";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

// Same horizon as the app's screen: six months of weekly cards.
const WEEKS_SHOWN = 26;

export default async function WeeklySummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  // RLS lets a PM read every community they manage, so both queries must be
  // scoped to this one (the app never needs to — an admin has one community).
  const { data: digestsRaw, error: digestsError } = await supabase
    .from("community_digests")
    .select(DIGEST_COLUMNS)
    .eq("community_code", community.community_code)
    .order("week_start", { ascending: false })
    .limit(WEEKS_SHOWN);

  const digests = (digestsRaw as unknown as Digest[] | null) ?? [];

  let suggestions: Suggestion[] = [];
  let suggestionsError: unknown = null;
  if (digests.length > 0) {
    const { data: suggestionsRaw, error } = await supabase
      .from("community_suggestions")
      .select(SUGGESTION_COLUMNS)
      .eq("community_code", community.community_code)
      .gte("week_start", digests[digests.length - 1].week_start);
    suggestions = (suggestionsRaw as Suggestion[] | null) ?? [];
    suggestionsError = error;
  }

  if (digestsError) console.error("community_digests read failed:", digestsError);
  if (suggestionsError) console.error("community_suggestions read failed:", suggestionsError);

  // Remount on ANY server-side change so router.refresh() replaces the local
  // optimistic copy: a new week (even a quiet one), a late narrative, or a
  // suggestion status change.
  const dataKey = [
    ...digests.map((d) => `${d.week_start}:${d.narrative ? 1 : 0}`),
    ...suggestions.map((s) => `${s.id}:${s.status}`),
  ].join(",");

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            Weekly Summary
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            What happened, and what to try next
          </p>
        </div>
        <RefreshButton />
      </div>

      <WeeklySummaryList
        key={dataKey}
        communityId={id}
        digests={attachSuggestions(digests, suggestions)}
        loadFailed={!!digestsError || !!suggestionsError}
        nextSummaryLabel={formatFriendlyDate(nextMondayAfter(new Date()))}
      />
    </main>
  );
}
