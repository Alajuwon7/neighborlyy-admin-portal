import Link from "next/link";
import { redirect } from "next/navigation";
import { getCommunityWithAuth } from "@/lib/queries";
import { PendingUsersTable } from "@/components/community/PendingUsersTable";
import { ReviewedTable, type ReviewedRow } from "@/components/community/ReviewedTable";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import {
  DECISION_FILTERS,
  HISTORY_PAGE_SIZE,
  decidedByLabel,
  parseDecisionFilter,
  parsePage,
  sanitizeSearch,
} from "@/lib/decision-history";
import { formatWait } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = sp.view === "reviewed" ? "reviewed" : "pending";
  const { supabase, user, community } = await getCommunityWithAuth(id);

  const { data: pendingRaw } = await supabase
    .from("pending_users")
    .select("id, full_name, email, unit_number, created_at")
    .eq("community_code", community.community_code)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pendingUsers =
    (pendingRaw as {
      id: string;
      full_name: string;
      email: string;
      unit_number: string | null;
      created_at: string;
    }[]) ?? [];

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            {view === "pending" ? "Pending Approvals" : "Reviewed Applications"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {view === "pending"
              ? `${pendingUsers.length} ${pendingUsers.length === 1 ? "request" : "requests"} waiting`
              : "Every approval and rejection, newest first"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Applications view"
            items={[
              { href: "?view=pending", label: `Pending (${pendingUsers.length})`, selected: view === "pending" },
              { href: "?view=reviewed", label: "Reviewed", selected: view === "reviewed" },
            ]}
          />
          <RefreshButton />
        </div>
      </div>

      {view === "pending" ? (
        <PendingUsersTable users={pendingUsers} communityId={id} />
      ) : (
        <Reviewed
          supabase={supabase}
          communityId={id}
          code={community.community_code as string}
          currentUserId={user.id}
          sp={sp}
        />
      )}
    </main>
  );
}

async function Reviewed({
  supabase,
  communityId,
  code,
  currentUserId,
  sp,
}: {
  supabase: Awaited<ReturnType<typeof getCommunityWithAuth>>["supabase"];
  communityId: string;
  code: string;
  currentUserId: string;
  sp: { [key: string]: string | string[] | undefined };
}) {
  const decision = parseDecisionFilter(sp.decision);
  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);
  const from = (page - 1) * HISTORY_PAGE_SIZE;

  let query = supabase
    .from("user_application_decisions")
    .select("id, full_name, email, decision, reason, decided_at, applied_at, decided_by", { count: "exact" })
    .eq("community_code", code)
    .order("decided_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  if (decision !== "all") query = query.eq("decision", decision);
  if (q) query = query.or(`full_name.ilike.*${q}*,email.ilike.*${q}*`);

  const { data, count, error } = await query;
  // A page past the end (bookmark after the history shrank) is a 416 from
  // PostgREST, not an empty page — send the PM back to the first page.
  if (error?.code === "PGRST103" && page > 1) {
    const params = new URLSearchParams({ view: "reviewed" });
    if (decision !== "all") params.set("decision", decision);
    if (q) params.set("q", q);
    redirect(`/dashboard/communities/${communityId}/pending?${params.toString()}`);
  }
  if (error) console.error("decision history read failed:", error);

  const raw =
    (data as {
      id: string;
      full_name: string | null;
      email: string;
      decision: "approved" | "rejected";
      reason: string | null;
      decided_at: string;
      applied_at: string | null;
      decided_by: string | null;
    }[] | null) ?? [];

  // decided_by is an auth uid. Mobile admins have a profiles row with that id
  // (readable by the community's PM); other PMs' rows aren't readable.
  const deciderIds = [...new Set(raw.map((r) => r.decided_by).filter((v): v is string => !!v && v !== currentUserId))];
  const profileNames = new Map<string, string>();
  if (deciderIds.length > 0) {
    const { data: deciders } = await supabase.from("profiles").select("id, full_name").in("id", deciderIds);
    for (const p of (deciders as { id: string; full_name: string | null }[] | null) ?? []) {
      if (p.full_name) profileNames.set(p.id, p.full_name);
    }
  }

  const rows: ReviewedRow[] = raw.map((r) => {
    const waitedMs = r.applied_at ? new Date(r.decided_at).getTime() - new Date(r.applied_at).getTime() : null;
    return {
      id: r.id,
      name: r.full_name?.trim() || "—",
      email: r.email,
      decision: r.decision,
      reason: r.reason,
      decidedAt: r.decided_at,
      waited: waitedMs !== null && waitedMs >= 0 ? formatWait(waitedMs / 3600000) : "—",
      decidedBy: decidedByLabel(r.decided_by, currentUserId, profileNames),
    };
  });

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const href = (over: Record<string, string | number>) => {
    const params = new URLSearchParams({ view: "reviewed", decision, ...(q ? { q } : {}), page: String(page) });
    for (const [k, v] of Object.entries(over)) params.set(k, String(v));
    if (params.get("page") === "1") params.delete("page");
    if (params.get("decision") === "all") params.delete("decision");
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Plain GET form: works without JS and keeps the filter in the URL. */}
        <form method="get" className="flex-1 min-w-48 max-w-sm">
          <input type="hidden" name="view" value="reviewed" />
          {decision !== "all" && <input type="hidden" name="decision" value={decision} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            aria-label="Search reviewed applications by name or email"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--nly-input-bg)",
              borderColor: "var(--nly-input-border)",
              color: "var(--nly-text-primary)",
            }}
          />
        </form>
        <Segmented
          label="Filter by decision"
          items={DECISION_FILTERS.map((f) => ({
            href: href({ decision: f.value, page: 1 }),
            label: f.label,
            selected: f.value === decision,
          }))}
        />
      </div>

      {error ? (
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Couldn&apos;t load reviewed applications. Please refresh to try again.
        </p>
      ) : (
        <ReviewedTable rows={rows} emptyText={q || decision !== "all" ? "No decisions match." : "No applications reviewed yet."} />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          <span>
            {from + 1}–{Math.min(from + HISTORY_PAGE_SIZE, total)} of {total}
          </span>
          <span className="flex gap-3">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="hover:underline" style={{ color: "var(--nly-brand)" }}>
                ← Newer
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className="hover:underline" style={{ color: "var(--nly-brand)" }}>
                Older →
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  );
}

function Segmented({ label, items }: { label: string; items: { href: string; label: string; selected: boolean }[] }) {
  return (
    <nav
      aria-label={label}
      className="flex rounded-xl border p-0.5"
      style={{ borderColor: "var(--nly-border)", backgroundColor: "var(--nly-surface)" }}
    >
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.selected ? "page" : undefined}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
          style={{
            backgroundColor: i.selected ? "var(--nly-surface-hover)" : "transparent",
            color: i.selected ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
          }}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
