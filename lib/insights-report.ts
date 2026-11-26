import type { SupabaseClient } from "@supabase/supabase-js";
import { excludeAuthors, filterCountedResidents, nonResidentIds } from "./residents";
import {
  helpByCategory,
  medianWaitHours,
  summarizeDecisions,
  summarizeHelp,
  type DecisionRow,
  type HelpRow,
} from "./insights";
import {
  mergeActivityWeeks,
  trimLeadingGaps,
  weeksSince,
  type ActivityWeek,
  type WeeklyActiveRow,
} from "./activity-trend";
import { loadEventHostInfo, type EventHost } from "./event-host";
import { isoDay, reportWeeks, type ReportPeriod } from "./report-period";

export type ReportEvent = {
  title: string;
  eventDate: string;
  location: string | null;
  host: EventHost | null;
  going: number | null;
  maxAttendees: number | null;
};

export type InsightsReport = {
  communityName: string;
  /** People living in the building (PM-entered), or null when not set. */
  buildingResidents: number | null;
  period: ReportPeriod;
  generatedAt: Date;
  residents: number;
  active: number;
  activeShare: number | null;
  decisions: ReturnType<typeof summarizeDecisions>;
  wait: ReturnType<typeof medianWaitHours>;
  weekly: ActivityWeek[];
  help: ReturnType<typeof summarizeHelp>;
  helpCategories: { label: string; count: number }[];
  openHelpNow: number;
  inProgressHelpNow: number;
  events: ReportEvent[];
  /** False when the host/RSVP read failed (those columns print as "—"). */
  eventInfoAvailable: boolean;
  alertsSent: number;
};

type Community = {
  community_code: string;
  name: string;
  created_at: string;
  building_resident_count?: number | null;
};

/**
 * Everything the PDF export prints, for one community and period. Same
 * sources and resident rules as the Insights page, bounded on both ends.
 *
 * `supabase` is the PM's client (RLS applies). `admin` is the service-role
 * client, used only for aggregate RSVP counts; the caller must already have
 * verified the PM manages this community.
 */
export async function loadInsightsReport(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  community: Community,
  period: ReportPeriod,
  now: Date,
): Promise<InsightsReport> {
  const code = community.community_code;
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const weeks = weeksSince(reportWeeks(period, now), community.created_at);

  async function readAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  ): Promise<T[]> {
    const PAGE = 1000;
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data as T[] | null) ?? [];
      rows.push(...batch);
      if (batch.length < PAGE) return rows;
    }
  }

  const notResidents = await nonResidentIds(supabase, [code]);

  const [
    residentsRes,
    ledger,
    activeRes,
    digestRes,
    weeklyActiveRes,
    helpRows,
    openHelpRes,
    waitingHelpRes,
    eventsRes,
    alertsRes,
  ] = await Promise.all([
    filterCountedResidents(
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("community_code", code),
    ),
    readAll<DecisionRow>((from, to) =>
      supabase
        .from("user_application_decisions")
        .select("decision, decided_at, applied_at")
        .eq("community_code", code)
        .gte("decided_at", startIso)
        .lt("decided_at", endIso)
        .order("decided_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.rpc("get_active_resident_count", { p_community_code: code, p_start: startIso, p_end: endIso }),
    weeks.length
      ? supabase
          .from("community_digests")
          .select("week_start, active_residents")
          .eq("community_code", code)
          .gte("week_start", isoDay(weeks[0].start))
          .lte("week_start", isoDay(weeks[weeks.length - 1].start))
      : Promise.resolve({ data: [], error: null }),
    weeks.length
      ? supabase.rpc("get_weekly_active_residents", {
          p_community_code: code,
          p_week_starts: weeks.map((w) => isoDay(w.start)),
        })
      : Promise.resolve({ data: [], error: null }),
    readAll<HelpRow>((from, to) =>
      excludeAuthors(
        supabase
          .from("help_requests")
          .select("request_type, metadata, status, created_at, resolved_at")
          .eq("community_code", code),
        notResidents,
      )
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    excludeAuthors(
      supabase.from("help_requests").select("id", { count: "exact", head: true }).eq("community_code", code),
      notResidents,
    ).in("status", ["open", "in_progress"]),
    excludeAuthors(
      supabase.from("help_requests").select("id", { count: "exact", head: true }).eq("community_code", code),
      notResidents,
    ).eq("status", "open"),
    supabase
      .from("events")
      .select("id, title, event_date, location, max_attendees, created_by, hosted_by")
      .eq("community_code", code)
      .gte("event_date", startIso)
      .lt("event_date", endIso)
      .order("event_date", { ascending: true }),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("community_code", code)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const required = residentsRes.error ?? activeRes.error ?? digestRes.error ?? openHelpRes.error ?? waitingHelpRes.error ?? eventsRes.error ?? alertsRes.error;
  if (required) throw required;
  // Same as the page: the daily-activity read only adds the "quietly active"
  // slice, so a failure degrades the chart rather than failing the report.
  if (weeklyActiveRes.error) console.error("report weekly active read failed:", weeklyActiveRes.error);

  const residents = residentsRes.count ?? 0;
  const active = (activeRes.data as number | null) ?? 0;

  const tookPart = new Map(
    ((digestRes.data as { week_start: string; active_residents: number }[] | null) ?? []).map((r) => [
      r.week_start,
      r.active_residents,
    ]),
  );
  const activeRows = weeklyActiveRes.error ? [] : ((weeklyActiveRes.data as WeeklyActiveRow[] | null) ?? []);
  const weekly = trimLeadingGaps(mergeActivityWeeks(weeks, tookPart, activeRows, residents, []));

  const eventRows =
    (eventsRes.data as {
      id: string;
      title: string;
      event_date: string;
      location: string | null;
      max_attendees: number | null;
      created_by: string | null;
      hosted_by: string | null;
    }[] | null) ?? [];
  let info: Awaited<ReturnType<typeof loadEventHostInfo>> | null = null;
  try {
    info = await loadEventHostInfo(admin, eventRows, notResidents);
  } catch (e) {
    console.error("report event host/RSVP read failed:", e);
  }

  const unfinished = openHelpRes.count ?? 0;
  const waiting = waitingHelpRes.count ?? 0;

  return {
    communityName: community.name,
    buildingResidents: community.building_resident_count ?? null,
    period,
    generatedAt: now,
    residents,
    active,
    activeShare: residents > 0 ? Math.round((active / residents) * 100) : null, // same as the page
    decisions: summarizeDecisions(ledger),
    wait: medianWaitHours(ledger),
    weekly,
    help: summarizeHelp(helpRows),
    helpCategories: helpByCategory(helpRows),
    openHelpNow: waiting,
    inProgressHelpNow: Math.max(0, unfinished - waiting),
    events: eventRows.map((e) => ({
      title: e.title,
      eventDate: e.event_date,
      location: e.location,
      host: info?.get(e.id)?.host ?? null,
      going: info ? (info.get(e.id)?.going ?? 0) : null,
      maxAttendees: e.max_attendees,
    })),
    eventInfoAvailable: info !== null,
    alertsSent: alertsRes.count ?? 0,
  };
}
