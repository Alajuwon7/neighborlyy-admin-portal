import Link from "next/link";
import { getCommunityWithAuth } from "@/lib/queries";
import { excludeAuthors, filterCountedResidents, nonResidentIds } from "@/lib/residents";
import {
  RANGES,
  formatWait,
  lastWeeks,
  medianWaitHours,
  monthlyDecisions,
  parseRange,
  rangeStart,
  summarizeDecisions,
  summarizeHelp,
  helpByCategory,
  helpCategory,
  formatAge,
  type DecisionRow,
  type HelpRow,
} from "@/lib/insights";
import { DecisionsChart, WeeklyActivityChart } from "@/components/insights/InsightsCharts";
import {
  activityHeadline,
  mergeActivityWeeks,
  trackingNote,
  trackingStartedOn,
  trimLeadingGaps,
  type WeeklyActiveRow,
} from "@/lib/activity-trend";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

const TREND_WEEKS = 12;
const TREND_MONTHS = 12;

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const range = parseRange((await searchParams).range);
  const { supabase, community } = await getCommunityWithAuth(id);
  const code = community.community_code as string;

  const now = new Date();
  const start = rangeStart(range, now);
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
  // One ledger read covers both the range tiles and the 12-month chart.
  const ledgerFrom = start && start < twelveMonthsAgo ? start : start ? twelveMonthsAgo : null;
  // "All time" still needs a start for the RPC; nothing predates the community.
  const activeFrom = start ?? new Date(community.created_at as string);
  // The last TREND_WEEKS completed ISO weeks (the in-progress week has no
  // digest row until it closes).
  const weeks = lastWeeks(now, TREND_WEEKS + 1).slice(0, -1);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const weekEnd = new Date(weeks[weeks.length - 1].start.getTime() + 7 * 86_400_000);

  // PostgREST caps every response at max_rows (1000) regardless of .limit(),
  // so page through rather than silently dropping rows. `page` must apply a
  // stable order and .range(from, to).
  async function readAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  ): Promise<{ data: T[]; error: unknown }> {
    const PAGE = 1000;
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) return { data: rows, error };
      const batch = (data as T[] | null) ?? [];
      rows.push(...batch);
      if (batch.length < PAGE) return { data: rows, error: null };
    }
  }

  const readLedger = () =>
    readAll<DecisionRow>((from, to) => {
      let q = supabase
        .from("user_application_decisions")
        .select("decision, decided_at, applied_at")
        .eq("community_code", code)
        .order("decided_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (ledgerFrom) q = q.gte("decided_at", ledgerFrom.toISOString());
      return q;
    });

  // Management and the founder's own account are not resident engagement
  // (same rule as the mobile app and the database metrics).
  const notResidents = await nonResidentIds(supabase, [code]);

  // Help requests CREATED in the range (a request's outcome belongs to the
  // period it was asked in, so completion rate isn't skewed by old backlogs).
  const readHelp = () =>
    readAll<HelpRow>((from, to) => {
      let q = excludeAuthors(
        supabase
          .from("help_requests")
          .select("request_type, metadata, status, created_at, resolved_at")
          .eq("community_code", code),
        notResidents,
      )
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (start) q = q.gte("created_at", start.toISOString());
      return q;
    });

  const activeCount = (from: Date, to: Date) =>
    supabase.rpc("get_active_resident_count", {
      p_community_code: code,
      p_start: from.toISOString(),
      p_end: to.toISOString(),
    });

  const [
    { count: residentCount, error: residentError },
    ledgerRes,
    activeRes,
    weeklyRes,
    weeklyActiveRes,
    eventsRes,
    alertsRes,
    helpRes,
    openHelpRes,
    waitingHelpRes,
  ] = await Promise.all([
    filterCountedResidents(
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("community_code", code),
    ),
    readLedger(),
    activeCount(activeFrom, now),
    // Weekly trend from the digest, NOT the RPC: the RPC's app-open signal is
    // profiles.last_active (latest value only), so re-running it for past
    // weeks drops everyone who has opened the app since — a fake upward
    // trend. The digest's "took part" count was computed when each week closed.
    supabase
      .from("community_digests")
      .select("week_start, active_residents")
      .eq("community_code", code)
      .gte("week_start", isoDate(weeks[0].start))
      .lte("week_start", isoDate(weeks[weeks.length - 1].start)),
    // Daily-activity weekly counts (adds the "quietly active" slice). A failure
    // here degrades the chart to took-part only; it never breaks the page.
    supabase.rpc("get_weekly_active_residents", {
      p_community_code: code,
      p_week_starts: weeks.map((w) => isoDate(w.start)),
    }),
    // PM markers: only titles and dates, no resident data.
    supabase
      .from("events")
      .select("id, title, event_date")
      .eq("community_code", code)
      .gte("event_date", weeks[0].start.toISOString())
      .lt("event_date", weekEnd.toISOString()),
    supabase
      .from("alerts")
      .select("id, title, created_at")
      .eq("community_code", code)
      .gte("created_at", weeks[0].start.toISOString())
      .lt("created_at", weekEnd.toISOString()),
    readHelp(),
    // Open now (any age) and the five waiting longest.
    excludeAuthors(
      supabase
        .from("help_requests")
        .select("id, title, request_type, metadata, status, created_at", { count: "exact" })
        .eq("community_code", code),
      notResidents,
    )
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(5),
    // Status 'open' only: nobody has offered to help yet. Matches the app's
    // admin analytics, which counts in-progress requests separately.
    excludeAuthors(
      supabase
        .from("help_requests")
        .select("id", { count: "exact", head: true })
        .eq("community_code", code),
      notResidents,
    ).eq("status", "open"),
  ]);

  const loadError =
    residentError ?? ledgerRes.error ?? activeRes.error ?? weeklyRes.error ?? helpRes.error ?? openHelpRes.error ?? waitingHelpRes.error ?? null;
  if (loadError) console.error("insights read failed:", loadError);

  const ledger = ledgerRes.data;
  const inRange = start ? ledger.filter((r) => new Date(r.decided_at) >= start) : ledger;
  const decisions = summarizeDecisions(inRange);
  const helpSummary = summarizeHelp(helpRes.data);
  const helpCategories = helpByCategory(helpRes.data);
  // The folded tail sits last but can be the biggest bucket — scale to the max.
  const maxCategoryCount = Math.max(1, ...helpCategories.map((c) => c.count));
  const unfinishedHelpCount = openHelpRes.count ?? 0;
  const waitingHelpCount = waitingHelpRes.count ?? 0;
  const inProgressHelpCount = Math.max(0, unfinishedHelpCount - waitingHelpCount);
  const oldestOpen = (openHelpRes.data as (Pick<HelpRow, "request_type" | "metadata" | "status" | "created_at"> & {
    id: string;
    title: string;
  })[] | null) ?? [];
  const wait = medianWaitHours(inRange);
  const active = (activeRes.data as number | null) ?? 0;
  const residents = residentCount ?? 0;
  const activeShare = residents > 0 ? Math.round((active / residents) * 100) : null;
  const rangeLabel = RANGES.find((r) => r.value === range)!.label.toLowerCase();

  const tookPartByWeek = new Map(
    ((weeklyRes.data as { week_start: string; active_residents: number }[] | null) ?? []).map((r) => [
      r.week_start,
      r.active_residents,
    ]),
  );
  // A week with no digest row is a gap (job missed, or before the digest
  // existed) — null, not zero. Leading gaps are dropped so the chart starts at
  // the first summary.
  // Optional reads: log and degrade rather than break the page.
  if (weeklyActiveRes.error) console.error("insights weekly active read failed:", weeklyActiveRes.error);
  if (eventsRes.error) console.error("insights events markers read failed:", eventsRes.error);
  if (alertsRes.error) console.error("insights alerts markers read failed:", alertsRes.error);
  const activeRows = weeklyActiveRes.error ? [] : ((weeklyActiveRes.data as WeeklyActiveRow[] | null) ?? []);
  const markerRows = [
    ...(eventsRes.error ? [] : ((eventsRes.data as { title: string; event_date: string }[] | null) ?? [])).map((e) => ({
      kind: "event" as const,
      title: e.title,
      at: e.event_date,
    })),
    ...(alertsRes.error ? [] : ((alertsRes.data as { title: string; created_at: string }[] | null) ?? [])).map((a) => ({
      kind: "alert" as const,
      title: a.title,
      at: a.created_at,
    })),
  ];
  const mergedAll = mergeActivityWeeks(weeks, tookPartByWeek, activeRows, residents, markerRows);
  const weekly = trimLeadingGaps(mergedAll);
  const headline = activityHeadline(weekly[weekly.length - 1], residents);
  const trackingNoteText = weekly.some((w) => !w.tracked) ? trackingNote(trackingStartedOn(activeRows)) : null;
  const monthly = monthlyDecisions(ledger, now, TREND_MONTHS);

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            Resident Insights
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            Who&apos;s joining, who&apos;s active, how quickly applicants hear back, and how neighbours help each other
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range filter — one row, above everything it filters. */}
          <nav
            aria-label="Date range"
            className="flex rounded-xl border p-0.5"
            style={{ borderColor: "var(--nly-border)", backgroundColor: "var(--nly-surface)" }}
          >
            {RANGES.map((r) => {
              const selected = r.value === range;
              return (
                <Link
                  key={r.value}
                  href={`?range=${r.value}`}
                  aria-current={selected ? "page" : undefined}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  style={{
                    backgroundColor: selected ? "var(--nly-surface-hover)" : "transparent",
                    color: selected ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
                  }}
                >
                  {r.label}
                </Link>
              );
            })}
          </nav>
          <RefreshButton />
        </div>
      </div>

      {loadError ? (
        <Panel>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            Couldn&apos;t load insights. Please refresh to try again.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Tile label="Residents" value={String(residents)} note={`+${decisions.approved} approved in the last ${rangeLabel}`} />
            <Tile
              label="Active residents"
              value={String(active)}
              note={
                activeShare !== null
                  ? `${activeShare}% of residents used the app in the last ${rangeLabel}`
                  : `in the last ${rangeLabel}`
              }
            />
            <Tile
              label="Approval rate"
              value={decisions.approvalRate === null ? "—" : `${decisions.approvalRate}%`}
              note={
                decisions.total === 0
                  ? `No applications decided in the last ${rangeLabel}`
                  : `${decisions.approved} approved · ${decisions.rejected} rejected`
              }
            />
            <Tile
              label="Typical wait"
              value={wait ? formatWait(wait.hours) : "—"}
              note={
                wait
                  ? `Median time from applying to a decision (${wait.sample} ${wait.sample === 1 ? "applicant" : "applicants"})`
                  : "No decisions with a known application date"
              }
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Panel>
              <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                Resident activity, by week
              </h3>
              <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--nly-text-tertiary)" }}>
                Took part = posted, commented, asked for help, RSVPed, answered a survey or used Connect (same as the Weekly Summary) · Quietly active = opened the app, liked, booked or listed something · last {TREND_WEEKS} completed weeks
              </p>
              {headline ? (
                <p className="text-sm font-medium mb-3 break-words" style={{ color: "var(--nly-text-primary)" }}>
                  {headline}
                </p>
              ) : null}
              <WeeklyActivityChart data={weekly} />
              {trackingNoteText ? (
                <p className="text-[11px] mt-3 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
                  {trackingNoteText}
                </p>
              ) : null}
            </Panel>
            <Panel>
              <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                Applications decided
              </h3>
              <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--nly-text-tertiary)" }}>
                Approved and rejected per month · last {TREND_MONTHS} months
              </p>
              <DecisionsChart data={monthly} />
            </Panel>
          </div>

          {/* ── Help requests (the neighbour help board) ───────────────── */}
          <section className="space-y-3 pt-2" aria-labelledby="help-heading">
            <div>
              <h3 id="help-heading" className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
                Help requests
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                Neighbours asking each other for help · requests made in the last {rangeLabel}
              </p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Tile
                label="Requests"
                value={String(helpSummary.total)}
                note={helpSummary.cancelled > 0 ? `${helpSummary.cancelled} withdrawn by the resident` : `asked in the last ${rangeLabel}`}
              />
              <Tile
                label="Completed"
                value={helpSummary.completionRate === null ? String(helpSummary.completed) : `${helpSummary.completionRate}%`}
                note={
                  helpSummary.completionRate === null
                    ? "No requests to complete yet"
                    : `${helpSummary.completed} of ${helpSummary.total - helpSummary.cancelled} requests (withdrawn excluded) completed so far — recent ones may still be open`
                }
              />
              <Tile
                label="Typical time to help"
                value={helpSummary.medianResolveHours === null ? "—" : formatWait(helpSummary.medianResolveHours)}
                note={
                  helpSummary.medianResolveHours === null
                    ? "No completed requests yet"
                    : "Median from asking to completed (before 17 Sep: estimated)"
                }
              />
              <Tile
                label="Open now"
                value={String(waitingHelpCount)}
                note={
                  (waitingHelpCount === 0
                    ? "Nobody is waiting for a helper"
                    : "Waiting for a neighbour to offer help, any age") +
                  (inProgressHelpCount > 0
                    ? ` · ${inProgressHelpCount} more in progress`
                    : "")
                }
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel>
                <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--nly-text-primary)" }}>
                  What residents ask for
                </h4>
                {helpCategories.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
                    No help requests in the last {rangeLabel}.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {helpCategories.map((c) => (
                      <li key={c.label} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-xs">
                        <span className="truncate" style={{ color: "var(--nly-text-secondary)" }}>
                          {c.label}
                        </span>
                        <span className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--nly-surface-hover)" }}>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(c.count / maxCategoryCount) * 100}%`, backgroundColor: "#16A3B3" }}
                          />
                        </span>
                        <span className="text-right tabular-nums" style={{ color: "var(--nly-text-primary)" }}>
                          {c.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel>
                <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--nly-text-primary)" }}>
                  Oldest unfinished requests
                </h4>
                {oldestOpen.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
                    No open requests right now.
                  </p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
                    {oldestOpen.map((r) => (
                      <li key={r.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: "var(--nly-text-primary)" }}>
                            {r.title}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--nly-text-tertiary)" }}>
                            {helpCategory(r)}
                            {r.status === "in_progress" ? " · a neighbour is on it" : ""}
                          </p>
                        </div>
                        <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--nly-text-secondary)" }}>
                          {formatAge(r.created_at, now)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      {children}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1" style={{ color: "var(--nly-text-primary)" }}>
        {value}
      </p>
      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--nly-text-tertiary)" }}>
        {note}
      </p>
    </div>
  );
}
