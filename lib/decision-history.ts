/**
 * Decision history ("Reviewed" on the Pending page), read from the
 * user_application_decisions ledger. Decided applications are deleted from
 * pending_users, so the ledger is the only record of who was approved or
 * rejected, when, and by whom.
 */

export const HISTORY_PAGE_SIZE = 50;

export const DECISION_FILTERS = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;
export type DecisionFilter = (typeof DECISION_FILTERS)[number]["value"];

export function parseDecisionFilter(v: string | string[] | undefined): DecisionFilter {
  const value = Array.isArray(v) ? v[0] : v;
  return DECISION_FILTERS.some((f) => f.value === value) ? (value as DecisionFilter) : "all";
}

export function parsePage(v: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(v) ? (v[0] ?? "") : (v ?? ""), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10000) : 1;
}

/**
 * Make free text safe to embed in a PostgREST `or=(...ilike...)` filter:
 * commas and parentheses would split or close the expression, double quotes
 * and colons are PostgREST syntax, and * / % / \ are pattern metacharacters.
 * Apostrophes are safe and kept ("O'Brien"). Collapses whitespace and caps the length.
 */
export function sanitizeSearch(v: string | string[] | undefined): string {
  const raw = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  return raw.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export type DecidedByMap = Map<string, string>;

/**
 * Who made the decision. decided_by is the deciding admin's auth uid (the
 * ledger triggers record auth.uid()), or null for service-role/system paths.
 * A PM can read their own identity and community profiles (mobile admins),
 * not other PMs' rows — so another PM shows as "Another admin".
 */
export function decidedByLabel(decidedBy: string | null, currentUserId: string, profileNames: DecidedByMap): string {
  // Rows backfilled from before the ledger existed (pre 2026-09-17) have no decider.
  if (!decidedBy) return "Not recorded";
  if (decidedBy === currentUserId) return "You";
  return profileNames.get(decidedBy) ?? "Another admin";
}
