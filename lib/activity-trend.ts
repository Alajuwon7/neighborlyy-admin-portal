import type { WeekWindow } from "./insights";

export type Marker = { kind: "event" | "alert"; title: string };

export type ActivityWeek = {
  weekStart: string; // YYYY-MM-DD (Monday, UTC)
  label: string;
  tookPart: number | null;
  quiet: number | null;
  active: number | null;
  tracked: boolean;
  pctActive: number | null;
  pctTookPart: number | null;
  markers: Marker[];
};

export type WeeklyActiveRow = {
  week_start: string;
  active: number;
  tracked: boolean;
  /** YYYY-MM-DD; same value on every row. */
  tracking_started?: string | null;
};

const DAY_MS = 86_400_000;

const pct = (n: number | null, residents: number): number | null =>
  n === null || residents <= 0 ? null : Math.round((n / residents) * 100);

export function mergeActivityWeeks(
  weeks: WeekWindow[],
  tookPart: Map<string, number>,
  activeRows: WeeklyActiveRow[],
  residents: number,
  markers: { kind: Marker["kind"]; title: string; at: string }[],
): ActivityWeek[] {
  const activeByWeek = new Map(activeRows.map((r) => [r.week_start, r]));
  return weeks.map((w) => {
    const weekStart = w.start.toISOString().slice(0, 10);
    const startMs = w.start.getTime();
    const row = activeByWeek.get(weekStart);
    const took = tookPart.get(weekStart) ?? null;
    const tracked = row?.tracked ?? false;
    const rawActive = row?.active ?? null;
    const active =
      rawActive === null && took === null ? null : Math.max(rawActive ?? 0, took ?? 0);
    const quiet = tracked && active !== null ? active - (took ?? 0) : null;
    return {
      weekStart,
      label: w.label,
      tookPart: took,
      quiet,
      active,
      tracked,
      pctActive: pct(active, residents),
      pctTookPart: pct(took, residents),
      markers: markers
        .filter((m) => {
          const t = new Date(m.at).getTime();
          return t >= startMs && t < startMs + 7 * DAY_MS;
        })
        .map(({ kind, title }) => ({ kind, title })),
    };
  });
}

export function activityHeadline(week: ActivityWeek | undefined, residents: number): string | null {
  if (!week) return null;
  if (!week.tracked) {
    return week.tookPart === null ? null : `${week.tookPart} residents took part last week`;
  }
  if (week.active === null) return null;
  const pctPart = week.pctActive === null ? "" : ` · ${week.pctActive}% of ${residents}`;
  const took = week.tookPart === null ? "" : ` · ${week.tookPart} took part`;
  return `${week.active} residents active last week${pctPart}${took}`;
}

/** The tracking start date, only when a shown week predates tracking. */
export function trackingStartedOn(rows: WeeklyActiveRow[]): string | null {
  if (!rows.some((r) => !r.tracked)) return null;
  return rows.find((r) => r.tracking_started)?.tracking_started ?? null;
}

export function trackingNote(startedOn: string | null): string | null {
  if (!startedOn) return null;
  const d = new Date(`${startedOn}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `App-open tracking started ${d}; earlier weeks show taking part only.`;
}
