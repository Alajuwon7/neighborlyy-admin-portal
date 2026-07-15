import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { differenceInHours } from "date-fns";
import { soonestTrialDaysLeft } from "@/lib/trial-days";
import { filterResidents } from "@/lib/residents";
import { Building2, Users, Clock, AlertTriangle } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/ActivityFeed";
import { DashboardClientShell } from "@/components/dashboard/DashboardClientShell";
import { CommunityThemeProvider } from "@/components/dashboard/CommunityThemeProvider";
import { DashboardAnimatedShell, DashboardSection } from "@/components/dashboard/DashboardAnimatedShell";
import { computeNudges } from "@/lib/nudges";
import { getNotificationCount } from "@/app/(dashboard)/dashboard/notifications/actions";
import { NudgeCards } from "@/components/dashboard/NudgeCards";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { PendingApprovalsPanel, type PendingRow } from "@/components/dashboard/PendingApprovalsPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch property manager
  const { data: pmData } = await supabase
    .from("property_managers")
    .select("id, full_name, organization_id")
    .eq("user_id", user.id)
    .single();

  const pm = pmData as { id: string; full_name: string; organization_id: string | null } | null;
  if (!pm) redirect("/onboarding");

  // Fetch communities scoped to organization (or PM if no org yet)
  let commQuery = supabase
    .from("communities")
    .select("id, name, status, unit_count, trial_ends_at, onboarding_completed, property_manager_id, community_code, created_at, primary_color, accent_color");

  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }

  const { data: communitiesRaw } = await commQuery;

  const communities = (
    communitiesRaw as
      | {
          id: string;
          name: string;
          status: string;
          unit_count: number | null;
          trial_ends_at: string | null;
          onboarding_completed: boolean;
          property_manager_id: string | null;
          community_code: string;
          created_at: string;
          primary_color: string | null;
          accent_color: string | null;
        }[]
      | null
  ) ?? [];

  if (communities.length === 0) {
    redirect("/onboarding");
  }

  const firstCommunity = communities[0];

  const totalUnits = communities.reduce((sum, c) => sum + (c.unit_count ?? 0), 0);
  const activeCommunities = communities.filter((c) => c.status !== "cancelled").length;
  const activeCount = communities.filter((c) => c.status === "active").length;
  const trialCount = communities.filter((c) => c.status === "trial").length;

  // Determine if this is a new user (community created within last 24 hours)
  const hoursSinceCreation = differenceInHours(
    new Date(),
    new Date(firstCommunity.created_at)
  );
  const isNewUser = hoursSinceCreation <= 24;

  // Check for onboarding=complete query param
  const showOnboardingModal = resolvedSearchParams.onboarding === "complete";

  // Check if user has events, residents, pending users (for getting started checklist)
  const communityCodes = communities.map((c) => c.community_code).filter(Boolean);

  // Weekly momentum window (last 7 days). Communities delta is derived from the
  // already-fetched list (no query); residents/pending/alerts deltas are scoped
  // count queries batched together with the base counts below so the dashboard
  // issues a single round-trip instead of two serial ones.
  const weekAgoIso = new Date(new Date().getTime() - 7 * 864e5).toISOString();
  const newCommunitiesWk = communities.filter(
    (c) => c.created_at >= weekAgoIso,
  ).length;

  const [
    { count: eventCount },
    { count: residentCount },
    { count: pendingCount },
    { count: alertCount },
    { count: newResidentsWk },
    { count: newPendingWk },
    { count: newAlertsWk },
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).in("community_code", communityCodes),
    filterResidents(supabase.from("profiles").select("id", { count: "exact", head: true }).in("community_code", communityCodes)),
    supabase.from("pending_users").select("id", { count: "exact", head: true }).in("community_code", communityCodes).eq("status", "pending"),
    supabase.from("alerts").select("id", { count: "exact", head: true }).in("community_code", communityCodes),
    filterResidents(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("community_code", communityCodes)
        .gte("created_at", weekAgoIso),
    ),
    supabase
      .from("pending_users")
      .select("id", { count: "exact", head: true })
      .in("community_code", communityCodes)
      .eq("status", "pending")
      .gte("created_at", weekAgoIso),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .in("community_code", communityCodes)
      .gte("created_at", weekAgoIso),
  ]);

  const occupancyPct =
    totalUnits > 0
      ? Math.min(100, Math.round(((residentCount ?? 0) / totalUnits) * 100))
      : 0;

  // Build activity feed from recent events across tables
  const communityNameByCode = new Map(communities.map((c) => [c.community_code, c.name]));
  const activityItems: ActivityItem[] = [];

  // Recent residents who joined ("<name> joined the community")
  const { data: recentProfiles } = await filterResidents(
    supabase
      .from("profiles")
      .select("id, full_name, community_code, created_at")
      .in("community_code", communityCodes),
  )
    .order("created_at", { ascending: false })
    .limit(10);

  for (const p of (recentProfiles ?? []) as { id: string; full_name: string; community_code: string; created_at: string }[]) {
    activityItems.push({
      id: `profile-${p.id}`,
      type: "resident_joined",
      message: `${p.full_name} joined the community`,
      community_name: communityNameByCode.get(p.community_code),
      created_at: p.created_at,
    });
  }

  // Recent pending join requests
  const { data: recentPending } = await supabase
    .from("pending_users")
    .select("id, full_name, community_code, created_at")
    .in("community_code", communityCodes)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  for (const p of (recentPending ?? []) as { id: string; full_name: string; community_code: string; created_at: string }[]) {
    activityItems.push({
      id: `pending-${p.id}`,
      type: "resident_joined",
      message: `${p.full_name} requested to join`,
      community_name: communityNameByCode.get(p.community_code),
      created_at: p.created_at,
      actionHref: `/dashboard/communities/${communities.find((c) => c.community_code === p.community_code)?.id}/pending`,
      actionLabel: "Review",
    });
  }

  // Recent events
  const { data: recentEvents } = await supabase
    .from("events")
    .select("id, title, community_code, created_at")
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const e of (recentEvents ?? []) as { id: string; title: string; community_code: string; created_at: string }[]) {
    activityItems.push({
      id: `event-${e.id}`,
      type: "event_created",
      message: `Event created: ${e.title}`,
      community_name: communityNameByCode.get(e.community_code),
      created_at: e.created_at,
    });
  }

  // Recent alerts
  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("id, title, community_code, created_at")
    .in("community_code", communityCodes)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const a of (recentAlerts ?? []) as { id: string; title: string; community_code: string; created_at: string }[]) {
    activityItems.push({
      id: `alert-${a.id}`,
      type: "alert_sent",
      message: `Alert: ${a.title}`,
      community_name: communityNameByCode.get(a.community_code),
      created_at: a.created_at,
    });
  }

  // Sort all activity by date descending, limit to 20
  activityItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const recentActivity = activityItems.slice(0, 20);

  // Notification count for bell badge
  const notificationCount = await getNotificationCount(communityCodes);

  // Build maps for notification deep links
  const communityMap: Record<string, string> = {};
  const communityNameMap: Record<string, string> = {};
  for (const c of communities) {
    communityMap[c.community_code] = c.id;
    communityNameMap[c.community_code] = c.name;
  }

  // Top-5 oldest pending residents for the inline approvals panel
  let pendingRows: PendingRow[] = [];
  if ((pendingCount ?? 0) > 0) {
    const { data: pendingRaw } = await supabase
      .from("pending_users")
      .select("id, full_name, email, unit_number, created_at, community_code")
      .in("community_code", communityCodes)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);
    pendingRows = (pendingRaw as PendingRow[] | null) ?? [];
  }

  // Compute smart nudges
  const communityNames = new Map(communities.map((c) => [c.id, c.name]));
  const nudges = await computeNudges(
    supabase,
    communities.map((c) => c.id),
    communityNames,
  );

  const firstName = pm.full_name?.split(" ")[0] ?? "there";

  const single = communities.length === 1;
  const firstId = firstCommunity.id;

  // Only render a delta when there's actually movement (no "+0").
  const posDelta = (n: number | null, label: string) =>
    n && n > 0 ? { value: `+${n}`, tone: "positive" as const, label } : undefined;
  const neutralDelta = (n: number | null, label: string) =>
    n && n > 0 ? { value: `+${n}`, tone: "neutral" as const, label } : undefined;

  const soonestTrial = soonestTrialDaysLeft(communities);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Dashboard"
        firstName={firstName}
        subtitle="Here's what's happening across your communities"
        trialDaysLeft={soonestTrial}
        notificationCount={notificationCount}
        communityCodes={communityCodes}
        communityMap={communityMap}
        communityNameMap={communityNameMap}
      />

      <CommunityThemeProvider
        primaryColor={firstCommunity.primary_color}
        accentColor={firstCommunity.accent_color}
      />

      <DashboardAnimatedShell>
        {/* Client-side onboarding shell (checklist, modals) */}
        <DashboardClientShell
          showOnboardingModal={showOnboardingModal}
          isNewUser={isNewUser}
          communityName={firstCommunity.name}
          communityCode={firstCommunity.community_code}
          communityCreatedAt={firstCommunity.created_at}
          hasResidents={(residentCount ?? 0) > 0}
          hasEvents={(eventCount ?? 0) > 0}
          hasPendingUsers={(pendingCount ?? 0) > 0}
        />

        {/* Summary cards */}
        <DashboardSection delay={0}>
          <div className="flex justify-end mb-2">
            <RefreshButton />
          </div>
          <div data-tour="summary-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <SummaryCard
              label="Active Communities"
              value={activeCommunities}
              subtext={`${totalUnits.toLocaleString()} total units`}
              icon={<Building2 size={22} style={{ color: "var(--nly-brand)" }} />}
              accentColor="var(--nly-brand)"
              href="/dashboard/communities"
              trend={posDelta(newCommunitiesWk, "new this week")}
              footer={
                <p
                  className="text-xs"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  {activeCount} active
                  {trialCount > 0 ? ` · ${trialCount} on trial` : ""}
                </p>
              }
              index={0}
            />
            <SummaryCard
              label="Total Units"
              value={totalUnits.toLocaleString()}
              subtext={
                totalUnits === 0
                  ? "No residents yet — share your community code"
                  : "Across all properties"
              }
              icon={<Users size={22} style={{ color: "var(--nly-accent)" }} />}
              accentColor="var(--nly-accent)"
              href="/dashboard/communities"
              trend={posDelta(newResidentsWk, "residents this week")}
              footer={
                <div>
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--nly-border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${occupancyPct}%`,
                        backgroundColor: "var(--nly-accent)",
                      }}
                    />
                  </div>
                  <p
                    className="text-xs mt-1.5"
                    style={{ color: "var(--nly-text-tertiary)" }}
                  >
                    {occupancyPct}% occupied · {(residentCount ?? 0).toLocaleString()}{" "}
                    {residentCount === 1 ? "resident" : "residents"}
                  </p>
                </div>
              }
              index={1}
            />
            <SummaryCard
              label="Pending Approvals"
              value={pendingCount ?? 0}
              subtext={
                isNewUser
                  ? "Resident requests will appear here"
                  : "Residents awaiting access"
              }
              icon={<Clock size={22} style={{ color: "var(--nly-warning)" }} />}
              accentColor="var(--nly-warning)"
              href={
                single
                  ? `/dashboard/communities/${firstId}/pending`
                  : (pendingCount ?? 0) > 0
                  ? "#pending-approvals"
                  : "/dashboard/communities"
              }
              trend={neutralDelta(newPendingWk, "new this week")}
              footer={
                <p
                  className="text-xs font-medium"
                  style={{
                    color:
                      (pendingCount ?? 0) > 0
                        ? "var(--nly-warning)"
                        : "var(--nly-success)",
                  }}
                >
                  {(pendingCount ?? 0) > 0
                    ? "Awaiting your review"
                    : "All caught up"}
                </p>
              }
              index={2}
            />
            <SummaryCard
              label="Open Alerts"
              value={alertCount ?? 0}
              subtext={
                isNewUser
                  ? "Create your first event to engage residents"
                  : "Community alerts"
              }
              icon={<AlertTriangle size={22} style={{ color: "var(--nly-error)" }} />}
              accentColor="var(--nly-error)"
              href={
                single
                  ? `/dashboard/communities/${firstId}/alerts`
                  : "/dashboard/communities"
              }
              trend={neutralDelta(newAlertsWk, "this week")}
              footer={
                <p
                  className="text-xs"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  {(alertCount ?? 0) > 0
                    ? "Visible in the resident app"
                    : "None active right now"}
                </p>
              }
              index={3}
            />
          </div>
        </DashboardSection>

        {/* Quick actions */}
        <DashboardSection delay={0.05}>
          <QuickActions singleCommunityId={single ? firstId : null} />
        </DashboardSection>

        {/* Smart nudges */}
        {nudges.length > 0 && (
          <DashboardSection delay={0.1}>
            <NudgeCards nudges={nudges} />
          </DashboardSection>
        )}

        {/* Pending approvals (inline) */}
        {pendingRows.length > 0 && (
          <DashboardSection delay={0.15}>
            <PendingApprovalsPanel
              rows={pendingRows}
              communityMap={communityMap}
              communityNameMap={communityNameMap}
              showCommunity={communities.length > 1}
            />
          </DashboardSection>
        )}

        {/* Communities list + Activity feed */}
        <DashboardSection delay={0.2}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Communities */}
            <div
              data-tour="community-card"
              className="nly-card-hover lg:col-span-2 rounded-2xl border"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: "var(--nly-border)" }}
              >
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  Your Communities
                </h3>
                <Link
                  href="/dashboard/communities"
                  className="text-xs hover:underline transition-colors duration-200"
                  style={{ color: "var(--nly-accent)" }}
                >
                  View all →
                </Link>
              </div>
              <div
                className="divide-y max-h-96 overflow-y-auto"
                style={{ borderColor: "var(--nly-divider)" }}
              >
                {communities.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/communities/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-all duration-200 hover:bg-[var(--nly-surface-hover)] group"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm transition-transform duration-200 group-hover:scale-105"
                      style={{ backgroundColor: c.primary_color ?? "var(--nly-brand)" }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        {c.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--nly-text-tertiary)" }}
                      >
                        {c.unit_count != null ? `${c.unit_count} units` : "Setup incomplete"}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor:
                          c.status === "active"
                            ? "rgba(16, 185, 129, 0.1)"
                            : c.status === "trial"
                            ? "rgba(245, 158, 11, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                        color:
                          c.status === "active"
                            ? "var(--nly-success)"
                            : c.status === "trial"
                            ? "var(--nly-warning)"
                            : "var(--nly-error)",
                      }}
                    >
                      {c.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div data-tour="activity-feed" className="lg:col-span-3">
              <ActivityFeed items={recentActivity} communityCodes={communityCodes} />
            </div>
          </div>
        </DashboardSection>
      </DashboardAnimatedShell>
    </div>
  );
}
