import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { CommunityCard } from "@/components/dashboard/CommunityCard";
import { Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const { supabase, pm } = await getAuthenticatedPM();

  const { data: communitiesRaw } = await supabase
    .from("communities")
    .select(
      "id, name, community_code, city, state, unit_count, property_type, status, trial_ends_at, primary_color, property_manager_id, street_address"
    )
    .eq("property_manager_id", pm.id)
    .order("created_at", { ascending: false });

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

      <main className="flex-1 p-6 space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
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

        {communities.length === 0 ? (
          <div
            className="rounded-2xl border p-12 text-center"
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {communities.map((c) => (
              <CommunityCard key={c.id} {...c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
