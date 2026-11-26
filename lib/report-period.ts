import type { WeekWindow } from "./insights";

/** Preset lengths offered for the PDF export, plus a custom range. */
export const REPORT_PRESETS = [30, 60, 90, 120] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

/** Longest custom range we accept (keeps the weekly chart readable). */
export const MAX_CUSTOM_DAYS = 366;

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type ReportPeriod = {
  /** Inclusive start. */
  start: Date;
  /** Exclusive end (never later than now). */
  end: Date;
  /** "Last 90 days" or "Custom range". */
  kind: string;
  /** "26 Aug 2026 – 24 Nov 2026" (inclusive dates, in the report's time zone). */
  label: string;
  /** YYYY-MM-DD of the first and last day (report time zone), for file names. */
  fromDay: string;
  toDay: string;
};

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** A valid IANA zone, else UTC. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Calendar day (YYYY-MM-DD) of an instant in `tz`. */
export function dayIn(d: Date, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** "26 Aug 2026" for a YYYY-MM-DD day. */
export function formatIsoDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "26 Aug 2026" for an instant, in UTC. */
export function formatDay(d: Date): string {
  return formatIsoDay(isoDay(d));
}

/** Offset (ms) of `tz` from UTC at instant `t`. */
function tzOffset(t: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** The instant local midnight starts `day` (YYYY-MM-DD) in `tz`. */
export function zonedMidnight(day: string, tz: string): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass settles DST transitions
  return new Date(t);
}

function nextDay(day: string): string {
  return isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS));
}

function parseDay(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== v ? null : v;
}

function build(start: Date, end: Date, kind: string, fromDay: string, toDay: string): ReportPeriod {
  return { start, end, kind, label: `${formatIsoDay(fromDay)} – ${formatIsoDay(toDay)}`, fromDay, toDay };
}

/**
 * Resolve `?range=30|60|90|120` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`.
 * Custom days are calendar days in `timeZone` (the PM's browser zone), with
 * `to` inclusive. Returns an error message for bad input.
 */
export function resolveReportPeriod(
  params: URLSearchParams,
  now: Date,
  timeZone = "UTC",
): { period: ReportPeriod } | { error: string } {
  const tz = safeTimeZone(timeZone);
  const range = params.get("range") ?? "30";

  if (range === "custom") {
    const from = parseDay(params.get("from"));
    const to = parseDay(params.get("to"));
    if (!from || !to) return { error: "Choose a start and end date." };
    if (from > to) return { error: "The start date must be on or before the end date." };
    if (from > dayIn(now, tz)) return { error: "The start date can't be in the future." };
    const start = zonedMidnight(from, tz);
    const end = new Date(Math.min(zonedMidnight(nextDay(to), tz).getTime(), now.getTime()));
    if ((end.getTime() - start.getTime()) / DAY_MS > MAX_CUSTOM_DAYS + 1) {
      return { error: `Custom ranges can be up to ${MAX_CUSTOM_DAYS} days.` };
    }
    return { period: build(start, end, "Custom range", from, dayIn(new Date(end.getTime() - 1), tz)) };
  }

  const days = Number(range);
  if (!REPORT_PRESETS.includes(days as ReportPreset)) return { error: "Unknown report range." };
  const start = new Date(now.getTime() - days * DAY_MS);
  return { period: build(start, now, `Last ${days} days`, dayIn(start, tz), dayIn(now, tz)) };
}

/**
 * Completed ISO weeks (Monday 00:00 UTC, matching the weekly digest) that
 * overlap the period, oldest first. A week still in progress is left out
 * (its digest isn't written until it closes).
 */
export function reportWeeks(period: ReportPeriod, now: Date): WeekWindow[] {
  const s = period.start;
  const monday = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weeks: WeekWindow[] = [];
  for (let t = monday.getTime(); t < period.end.getTime(); t += 7 * DAY_MS) {
    const start = new Date(t);
    const end = new Date(t + 7 * DAY_MS);
    if (end.getTime() > now.getTime()) break;
    weeks.push({ start, end, label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`, partial: false });
  }
  return weeks;
}
