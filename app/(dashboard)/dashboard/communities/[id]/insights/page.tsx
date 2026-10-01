import Link from "next/link";
import { getCommunityWithAuth } from "@/lib/queries";
import { filterResidents } from "@/lib/residents";
import {
  RANGES,
  formatWait,
  lastWeeks,
  medianWaitHours,
  monthlyDecisions,
  parseRange,
  rangeStart,
  summarizeDecisions,
  type DecisionRow,
} from "@/lib/insights";
import { DecisionsChart, WeeklyTookPartChart } from "@/components/insights/InsightsCharts";
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

  // PostgREST caps every response at max_rows (1000) regardless of .limit(),
  // so page through the ledger rather than silently dropping rows.
  const readLedger = async (): Promise<{ data: DecisionRow[]; error: unknown }> => {
    const PAGE = 1000;
    const rows: DecisionRow[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from("user_application_decisions")
        .select("decision, decided_at, applied_at")
        .eq("community_code", code)
        .order("decided_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (ledgerFrom) q = q.gte("decided_at", ledgerFrom.toISOString());
      const { data, error } = await q;
      if (error) return { data: rows, error };
      rows.push(...((data as DecisionRow[] | null) ?? []));
      if (!data || data.length < PAGE) return { data: rows, error: null };
    }
  };

  const activeCount = (from: Date, to: Date) =>
    supabase.rpc("get_active_resident_count", {
      p_community_code: code,
      p_start: from.toISOString(),
      p_end: to.toISOString(),
    });

  const [{ count: residentCount, error: residentError }, ledgerRes, activeRes, weeklyRes] = await Promise.all([
    filterResidents(
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
  ]);

  const loadError =
    residentError ?? ledgerRes.error ?? activeRes.error ?? weeklyRes.error ?? null;
  if (loadError) console.error("insights read failed:", loadError);

  const ledger = ledgerRes.data;
  const inRange = start ? ledger.filter((r) => new Date(r.decided_at) >= start) : ledger;
  const decisions = summarizeDecisions(inRange);
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
  const weeklyAll = weeks.map((w) => ({ label: w.label, value: tookPartByWeek.get(isoDate(w.start)) ?? null }));
  const firstKnown = weeklyAll.findIndex((p) => p.value !== null);
  const weekly = firstKnown === -1 ? [] : weeklyAll.slice(firstKnown);
  const monthly = monthlyDecisions(ledger, now, TREND_MONTHS);

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            Resident Insights
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            Who&apos;s joining, who&apos;s active, and how quickly applicants hear back
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
                Residents who took part, by week
              </h3>
              <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--nly-text-tertiary)" }}>
                Posted, commented, asked for help, RSVPed, answered a survey or used Connect · same count as the Weekly Summary · last {TREND_WEEKS} completed weeks
              </p>
              <WeeklyTookPartChart data={weekly} />
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
