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
