import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who put an event on.
 *
 * events.hosted_by (migration 037) wins when set: management often posts
 * resident-run events from its own account, so the PM marks them. When it's
 * NULL, derive from the creator:
 * - "management": created from the portal (the portal inserts with
 *   created_by = null, since PMs have no profiles row), or by a mobile
 *   account with role 'admin' (a PM who also uses the app).
 * - "resident": created in the app by anyone else.
 */
export type EventHost = "management" | "resident";

export const HOST_FILTERS = [
  { value: "all", label: "All" },
  { value: "management", label: "Management" },
  { value: "resident", label: "Residents" },
] as const;
export type HostFilter = (typeof HOST_FILTERS)[number]["value"];

export function parseHostFilter(value: string | string[] | undefined): HostFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return HOST_FILTERS.some((f) => f.value === v) ? (v as HostFilter) : "all";
}

export function parseEventHost(v: unknown): EventHost | null {
  return v === "management" || v === "resident" ? v : null;
}

export function eventHost(
  createdBy: string | null,
  adminIds: ReadonlySet<string>,
  hostedBy: string | null = null,
): EventHost {
  const explicit = parseEventHost(hostedBy);
  if (explicit) return explicit;
  return createdBy === null || adminIds.has(createdBy) ? "management" : "resident";
}


/**
 * Count RSVPs per event: only status 'going' counts as attending, and
 * management/flagged accounts (`excludeUserIds`) never count.
 */
export function countGoing(
  rows: { event_id: string; user_id: string | null; status: string }[],
  excludeUserIds: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "going" || (r.user_id && excludeUserIds.has(r.user_id))) continue;
    counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  }
  return counts;
}

export type HostedEventInfo = { host: EventHost; going: number };

/**
 * Host and "going" count for each event id.
 *
 * `admin` must be the service-role client, and the caller must already have
 * checked that the PM manages the community: event_rsvps RLS only lets
 * community members read RSVPs, and PMs are not profiles. Only aggregate
 * counts leave this function, never who RSVPed.
 */
export async function loadEventHostInfo(
  admin: SupabaseClient,
  events: { id: string; created_by: string | null; hosted_by: string | null }[],
  /** From nonResidentIds(): their RSVPs are not resident attendance. */
  nonResidentUserIds: string[],
): Promise<Map<string, HostedEventInfo>> {
  const result = new Map<string, HostedEventInfo>();
  if (events.length === 0) return result;

  // Only events without an explicit host need their creator's role.
  const creatorIds = [
    ...new Set(
      events
        .filter((e) => !parseEventHost(e.hosted_by))
        .map((e) => e.created_by)
        .filter((v): v is string => !!v),
    ),
  ];
  const eventIds = events.map((e) => e.id);

  const [creators, rsvpRows] = await Promise.all([
    readCreators(admin, creatorIds),
    readAllRsvps(admin, eventIds),
  ]);

  const adminIds = new Set(creators.filter((p) => p.role === "admin").map((p) => p.id));
  const going = countGoing(rsvpRows, new Set(nonResidentUserIds));
  for (const e of events) {
    result.set(e.id, { host: eventHost(e.created_by, adminIds, e.hosted_by), going: going.get(e.id) ?? 0 });
  }
  return result;
}

// Ids go in the query string; chunk them so long event histories don't
// exceed the gateway's URL limit (~37 bytes per UUID).
const ID_CHUNK = 150;
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
  return out;
}

async function readCreators(admin: SupabaseClient, ids: string[]) {
  const rows: { id: string; role: string | null }[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await admin.from("profiles").select("id, role").in("id", part);
    if (error) throw error;
    rows.push(...((data ?? []) as { id: string; role: string | null }[]));
  }
  return rows;
}

// PostgREST caps responses at 1000 rows; page so busy events aren't undercounted.
async function readAllRsvps(admin: SupabaseClient, eventIds: string[]) {
  const PAGE = 1000;
  const rows: { event_id: string; user_id: string | null; status: string }[] = [];
  for (const part of chunks(eventIds)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("event_rsvps")
        .select("event_id, user_id, status")
        .in("event_id", part)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as { event_id: string; user_id: string | null; status: string }[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
  }
  return rows;
}
