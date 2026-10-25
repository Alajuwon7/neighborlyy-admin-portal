import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Canonical resident filter: residents are non-admin profiles.
 *
 * A PM who also signs up on the mobile app gets a profiles row with
 * role='admin' (unit_number='PM') sharing the community_code. Every
 * resident-shaped query on `profiles` must apply this filter or PMs get
 * counted/listed as residents (inflated counts, "joined the community"
 * activity entries, wrong occupancy).
 *
 * Do NOT filter on profiles.status. Only the portal's approve_pending_user
 * writes it; the mobile app's approval (UserService.approveUser) inserts the
 * profile without it, so app-approved residents keep the column default
 * 'pending'. Approval == a profiles row exists (applicants live in
 * pending_users until decided) — the same rule the mobile app uses.
 */
interface ResidentFilterable {
  or(filters: string): ResidentFilterable;
}

// T is intentionally unconstrained: constraining it to the PostgREST builder
// shape makes TS recurse into supabase-js's generics and fail with TS2589.
export function filterResidents<T>(query: T): T {
  return (query as unknown as ResidentFilterable).or("role.is.null,role.neq.admin") as unknown as T;
}

interface CountedFilterable {
  eq(column: string, value: unknown): CountedFilterable;
}

/**
 * Residents who COUNT toward community metrics: {@link filterResidents} plus
 * `exclude_from_leaderboard = false`. That flag marks the founder's own
 * resident account, which is not resident engagement. Same rule as the mobile
 * app and the database (`internal.compute_community_metrics`,
 * `get_active_resident_count`), so all three report the same numbers.
 *
 * Use for counts and milestones. Directories and "joined" activity keep
 * {@link filterResidents}: the founder is still listed as a resident.
 */
export function filterCountedResidents<T>(query: T): T {
  return (filterResidents(query) as unknown as CountedFilterable).eq(
    "exclude_from_leaderboard",
    false,
  ) as unknown as T;
}

/**
 * Profile ids in these communities whose activity is not resident engagement:
 * management (role 'admin') and flagged accounts. Feed to {@link excludeAuthors}.
 */
export async function nonResidentIds(
  supabase: SupabaseClient,
  communityCodes: string[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, exclude_from_leaderboard")
    .in("community_code", communityCodes);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; role: string | null; exclude_from_leaderboard: boolean | null }[];
  return rows
    .filter((p) => p.role === "admin" || p.exclude_from_leaderboard === true)
    .map((p) => p.id);
}

interface NotFilterable {
  not(column: string, operator: string, value: string): NotFilterable;
}

/** Drop rows authored by `ids` (no-op for an empty list). */
export function excludeAuthors<T>(query: T, ids: string[], column = "user_id"): T {
  if (ids.length === 0) return query;
  return (query as unknown as NotFilterable).not(column, "in", `(${ids.join(",")})`) as unknown as T;
}
