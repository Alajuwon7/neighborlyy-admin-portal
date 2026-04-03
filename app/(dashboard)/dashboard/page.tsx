import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { differenceInDays } from "date-fns";
import { Building2, Users, Clock, AlertTriangle } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
    .select("id, name, status, unit_count, trial_ends_at, onboarding_completed, property_manager_id")
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

      <main className="flex-1 p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
            subtext="Across all properties"
            icon={Users}
            accentColor="var(--nly-accent)"
          />
          <SummaryCard
            label="Pending Approvals"
            value={0}
            subtext="Residents awaiting access"
            icon={Clock}
            accentColor="var(--nly-warning)"
          />
          <SummaryCard
            label="Open Alerts"
            value={0}
            subtext="Unresolved community alerts"
            icon={AlertTriangle}
            accentColor="var(--nly-error)"
          />
        </div>

        {/* Communities list + Activity feed */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Communities */}
          <div
            className="xl:col-span-2 rounded-2xl border"
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
          <div className="xl:col-span-3">
            <ActivityFeed items={[]} />
          </div>
        </div>
      </main>
    </div>
  );
}
