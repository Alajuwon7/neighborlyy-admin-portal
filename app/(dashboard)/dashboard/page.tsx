import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { differenceInDays, differenceInHours } from "date-fns";
import { Building2, Users, Clock, AlertTriangle } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardClientShell } from "@/components/dashboard/DashboardClientShell";
import { CommunityThemeProvider } from "@/components/dashboard/CommunityThemeProvider";

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
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  const pm = pmData as { id: string; full_name: string } | null;
  if (!pm) redirect("/onboarding");

  // Fetch communities (includes migrated communities that may have null admin fields)
  const { data: communitiesRaw } = await supabase
    .from("communities")
    .select("id, name, status, unit_count, trial_ends_at, onboarding_completed, property_manager_id, community_code, created_at, primary_color, accent_color")
    .eq("property_manager_id", pm.id);

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

  // Compute trial days left (use first community)
  const firstCommunity = communities[0];
  const trialDaysLeft = firstCommunity.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(firstCommunity.trial_ends_at), new Date()))
    : null;

  const totalUnits = communities.reduce((sum, c) => sum + (c.unit_count ?? 0), 0);
  const activeCommunities = communities.filter((c) => c.status !== "cancelled").length;

  // Determine if this is a new user (community created within last 24 hours)
  const hoursSinceCreation = differenceInHours(
    new Date(),
    new Date(firstCommunity.created_at)
  );
  const isNewUser = hoursSinceCreation <= 24;

  // Check for onboarding=complete query param
  const showOnboardingModal = resolvedSearchParams.onboarding === "complete";

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = pm.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={`${greeting}, ${firstName} 👋`}
        subtitle="Here's what's happening across your communities"
        trialDaysLeft={firstCommunity.status === "trial" ? trialDaysLeft : null}
      />

      <CommunityThemeProvider
        primaryColor={firstCommunity.primary_color}
        accentColor={firstCommunity.accent_color}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Client-side onboarding shell (checklist, modals) */}
        <DashboardClientShell
          showOnboardingModal={showOnboardingModal}
          isNewUser={isNewUser}
          communityName={firstCommunity.name}
          communityCode={firstCommunity.community_code}
          communityCreatedAt={firstCommunity.created_at}
          hasResidents={false}
          hasEvents={false}
          hasPendingUsers={false}
        />

        {/* Summary cards */}
        <div data-tour="summary-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            label="Active Communities"
            value={activeCommunities}
            subtext={`${totalUnits.toLocaleString()} total units`}
            icon={Building2}
            accentColor="var(--nly-brand)"
          />
          <SummaryCard
            label="Total Units"
            value={totalUnits.toLocaleString()}
            subtext={
              totalUnits === 0
                ? "No residents yet — share your community code"
                : "Across all properties"
            }
            icon={Users}
            accentColor="var(--nly-accent)"
          />
          <SummaryCard
            label="Pending Approvals"
            value={0}
            subtext={
              isNewUser
                ? "Help requests from residents will appear here"
                : "Residents awaiting access"
            }
            icon={Clock}
            accentColor="var(--nly-warning)"
          />
          <SummaryCard
            label="Open Alerts"
            value={0}
            subtext={
              isNewUser
                ? "Create your first event to engage residents"
                : "Unresolved community alerts"
            }
            icon={AlertTriangle}
            accentColor="var(--nly-error)"
          />
        </div>

        {/* Communities list + Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Communities */}
          <div
            data-tour="community-card"
            className="lg:col-span-2 rounded-2xl border"
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
              <a
                href="/dashboard/communities"
                className="text-xs hover:underline"
                style={{ color: "var(--nly-accent)" }}
              >
                View all →
              </a>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
              {communities.map((c) => (
                <a
                  key={c.id}
                  href={`/dashboard/communities/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-opacity hover:opacity-80"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: "var(--nly-brand)" }}
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
                </a>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div data-tour="activity-feed" className="lg:col-span-3">
            <ActivityFeed items={[]} />
          </div>
        </div>
      </main>
    </div>
  );
}
