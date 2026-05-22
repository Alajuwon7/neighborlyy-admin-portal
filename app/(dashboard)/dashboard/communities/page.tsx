import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { CommunityCard } from "@/components/dashboard/CommunityCard";
import { DashboardAnimatedShell, DashboardSection } from "@/components/dashboard/DashboardAnimatedShell";
import { Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const { supabase, pm } = await getAuthenticatedPM();

  let commQuery = supabase
    .from("communities")
    .select(
      "id, name, community_code, city, state, unit_count, property_type, status, trial_ends_at, primary_color, property_manager_id, street_address"
    )
    .order("created_at", { ascending: false });

  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }

  const { data: communitiesRaw } = await commQuery;

  const communities =
    (communitiesRaw as {
      id: string;
      name: string;
      community_code: string;
      city: string | null;
      state: string | null;
      unit_count: number | null;
      property_type: string | null;
      status: string;
      trial_ends_at: string | null;
      primary_color: string | null;
      property_manager_id: string | null;
      street_address: string | null;
    }[]) ?? [];

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Communities"
        subtitle={`${communities.length} ${communities.length === 1 ? "property" : "properties"} managed`}
      />

      <DashboardAnimatedShell>
        {/* Actions bar */}
        <DashboardSection delay={0}>
          <div className="flex items-center justify-between max-w-5xl">
            <h2
              className="text-sm font-medium"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              All Communities
            </h2>
            <Link
              href="/onboarding"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--nly-brand)" }}
            >
              <Plus size={16} />
              Add Community
            </Link>
          </div>
        </DashboardSection>

        {communities.length === 0 ? (
          <DashboardSection delay={0.1}>
            <div
              className="rounded-2xl border p-12 text-center max-w-5xl"
              style={{
                backgroundColor: "var(--nly-surface)",
                borderColor: "var(--nly-border)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--nly-text-tertiary)" }}
              >
                No communities yet. Add your first property to get started.
              </p>
            </div>
          </DashboardSection>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
            {communities.map((c, i) => (
              <CommunityCard key={c.id} {...c} index={i} />
            ))}
          </div>
        )}
      </DashboardAnimatedShell>
    </div>
  );
}
