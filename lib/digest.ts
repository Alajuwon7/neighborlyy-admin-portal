/**
 * Weekly community digest — the portal's view of what the mobile app shows on
 * CommunityDigestScreen.
 *
 * The digest is written by the mobile repo's build-community-digest Edge
 * Function (nightly cron, service role): one community_digests row per
 * community per ISO week, Claude's one-paragraph narrative, and an A/B pair of
 * community_suggestions. The portal only reads it and lets a PM choose A or B
 * through choose_suggestion(). Spec: Miyora
 * docs/superpowers/specs/2026-08-21-community-digest-design.md.
 *
 * Ported from Miyora src/utils/digestWeeks.ts and CommunityDigestScreen.tsx —
 * keep the display rules in sync so a PM sees the same summary on both.
 */

export const METRIC_KEYS = [
  "posts", "comments", "help_requests", "survey_responses", "connection_requests",
  "event_rsvps", "events_held", "residents_joined", "active_residents",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type SuggestionStatus =
  | "open" | "chosen" | "not_chosen" | "achieved" | "missed" | "dismissed" | "expired";

export type Suggestion = {
  id: string;
  community_code: string;
  week_start: string;
  variant: "A" | "B";
  title: string;
  rationale: string;
  metric: string;
  target_direction: "up" | "down";
  baseline_value: number;
  status: SuggestionStatus;
};

export type Digest = {
  community_code: string;
  week_start: string; // DATE 'YYYY-MM-DD', always a Monday
  week_end: string; // the Sunday
  narrative: string | null;
  residents_total: number;
} & Record<MetricKey, number>;

export type DigestWithSuggestions = Digest & { suggestions: Suggestion[] };

export const DIGEST_COLUMNS = [
  "community_code", "week_start", "week_end", "narrative", "residents_total", ...METRIC_KEYS,
].join(", ");

export const SUGGESTION_COLUMNS =
  "id, community_code, week_start, variant, title, rationale, metric, target_direction, baseline_value, status";

/**
 * Joined in JS rather than a PostgREST embed: an embed can resolve as an INNER
 * join and drop every digest without suggestions — exactly the quiet weeks.
 */
export function attachSuggestions(digests: Digest[], suggestions: Suggestion[]): DigestWithSuggestions[] {
  return digests.map((d) => ({
    ...d,
    suggestions: suggestions
      .filter((s) => s.community_code === d.community_code && s.week_start === d.week_start)
      .sort((a, b) => a.variant.localeCompare(b.variant)),
  }));
}

// ─── Dates ──────────────────────────────────────────────────────────────────
// DATE columns arrive as 'YYYY-MM-DD'. Parse as UTC midnight and format with
// UTC getters: reading a bare date in a local zone west of UTC shifts it a day.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseIsoDate(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "17 – 23 August 2026", or "27 July – 2 August 2026" across a month boundary. */
export function formatWeekRange(startIso: string, endIso: string): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return startIso;
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const left = sameMonth ? `${start.getUTCDate()}` : `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
  return `${left} – ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/**
 * The next Monday STRICTLY after `now` — when the next summary publishes.
 * Computed, never hardcoded: the spec's draft hand-wrote a date that was a Tuesday.
 */
export function nextMondayAfter(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilMonday = (1 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}

/** "Monday, 24 August" */
export function formatFriendlyDate(d: Date): string {
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// ─── Metrics ────────────────────────────────────────────────────────────────

const METRIC_NOUNS: Record<MetricKey, [string, string]> = {
  posts: ["post", "posts"],
  comments: ["comment", "comments"],
  help_requests: ["help request", "help requests"],
  event_rsvps: ["event RSVP", "event RSVPs"],
  events_held: ["event held", "events held"],
  residents_joined: ["resident joined", "residents joined"],
  // The digest's active_residents counts residents who posted, commented,
  // asked for help, RSVPed, answered a survey or sent a Connect request —
  // narrower than get_active_resident_count (which adds app opens, likes,
  // bookings, marketplace). The portal's Insights tab owns "active residents",
  // so this one reads "took part" and the two never look like the same metric.
  active_residents: ["resident took part", "residents took part"],
  survey_responses: ["survey response", "survey responses"],
  connection_requests: ["Connect request", "Connect requests"],
};

/**
 * suggestion.metric is free text at runtime. Own-property check so an odd value
 * ('constructor', '__proto__') degrades to generic copy instead of resolving up
 * the prototype chain.
 */
export function metricNoun(metric: string): [string, string] {
  return Object.prototype.hasOwnProperty.call(METRIC_NOUNS, metric)
    ? METRIC_NOUNS[metric as MetricKey]
    : ["metric", "metrics"];
}

export function metricLabel(key: MetricKey, value: number): string {
  const [one, many] = METRIC_NOUNS[key];
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * Metrics non-zero in at least one loaded week, so every card has the same
 * shape and a structurally-zero metric never shows. Cards additionally hide a
 * metric that is zero that particular week — a "0 help requests" chip teaches
 * the PM to stop reading.
 */
export function visibleMetrics(rows: Array<Partial<Record<MetricKey, number>>>): MetricKey[] {
  return METRIC_KEYS.filter((k) => rows.some((r) => (r[k] ?? 0) > 0));
}

/**
 * Mirrors the is_quiet formula in write_missing_digests() and the Edge
 * Function. residents_total and active_residents are excluded on purpose — a
 * community with residents and no activity IS the quiet case.
 */
export function isQuiet(d: Digest): boolean {
  return (
    d.narrative === null &&
    d.posts + d.comments + d.help_requests + d.survey_responses + d.connection_requests +
      d.event_rsvps + d.events_held + d.residents_joined === 0
  );
}

export type MetricComparison = {
  key: MetricKey;
  value: number;
  /** The week before, or null when it isn't on file. */
  previous: number | null;
  /** Rounded mean of up to 4 prior weeks on file (the suggestions' baseline), or null with no history. */
  average: number | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Guard for the [week] route param before it reaches a query. */
export function isIsoWeekStart(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && d.getUTCDay() === 1;
}

/**
 * Every metric for `current` against the weeks before it. `prior` is newest
 * first and should hold up to 4 weeks. A missing week (the job failed) is
 * simply absent — comparisons use what's on file rather than inventing zeros.
 */
export function compareWeek(current: Digest, prior: Digest[]): MetricComparison[] {
  const window = prior.slice(0, 4);
  const weekBefore = prior[0];
  const expectedPrevious = new Date(`${current.week_start}T00:00:00Z`);
  expectedPrevious.setUTCDate(expectedPrevious.getUTCDate() - 7);
  const hasWeekBefore = weekBefore?.week_start === expectedPrevious.toISOString().slice(0, 10);

  return METRIC_KEYS.map((key) => ({
    key,
    value: current[key],
    previous: hasWeekBefore ? weekBefore[key] : null,
    // Rounded exactly as the Edge Function's trailingMean (prompt.ts), so a
    // tile and a suggestion's "4-week avg N" always show the same number.
    average: window.length > 0 ? Math.round(window.reduce((sum, d) => sum + d[key], 0) / window.length) : null,
  }));
}

/** Title-case metric name for stat tiles: "Help requests". */
export function metricTitle(key: MetricKey): string {
  const [, many] = METRIC_NOUNS[key];
  return many.charAt(0).toUpperCase() + many.slice(1);
}

// ─── Suggestions ────────────────────────────────────────────────────────────

/**
 * `expired` / `dismissed` / untouched `open` all read "Not chosen": a PM who
 * didn't engage is data about the feature, not their failure — no error styling.
 */
export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  open: "Not chosen",
  chosen: "Chosen",
  not_chosen: "Not chosen",
  achieved: "Achieved",
  missed: "Missed",
  dismissed: "Not chosen",
  expired: "Not chosen",
};

/** "More posts — 4-week avg 3": what the suggestion aims to move, from where. */
export function suggestionTarget(s: Pick<Suggestion, "metric" | "target_direction" | "baseline_value">): string {
  const [, noun] = metricNoun(s.metric);
  return `${s.target_direction === "up" ? "More" : "Fewer"} ${noun} — 4-week avg ${s.baseline_value}`;
}

const FROZEN: SuggestionStatus[] = ["expired", "achieved", "missed", "dismissed"];

/**
 * Only the newest week is choosable (choose_suggestion refuses once a newer
 * digest exists); terminal statuses stay read-only. `open`, `chosen` and
 * `not_chosen` on the newest week can all be (re)picked until it closes.
 */
export function canChoose(status: SuggestionStatus, isNewestWeek: boolean): boolean {
  return isNewestWeek && !FROZEN.includes(status);
}
