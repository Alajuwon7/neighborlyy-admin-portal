import { getAuthenticatedPM } from "@/lib/queries";
import { Header } from "@/components/dashboard/Header";
import { TeamTable } from "@/components/dashboard/TeamTable";
import { InviteTeamMemberDialog } from "@/components/dashboard/InviteTeamMemberDialog";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, pm } = await getAuthenticatedPM();

  // Fetch PM's communities
  const { data: communitiesRaw } = await supabase
    .from("communities")
    .select("id, name")
    .eq("property_manager_id", pm.id);

  const communities =
    (communitiesRaw as { id: string; name: string }[] | null) ?? [];
  const communityIds = communities.map((c) => c.id);

  // Fetch team members across all communities
  const { data: membersRaw } = communityIds.length
    ? await supabase
        .from("team_members")
        .select("id, full_name, email, role, status, community_id, invited_at")
        .in("community_id", communityIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const communityMap = new Map(communities.map((c) => [c.id, c.name]));

  const members = (
    (membersRaw as {
      id: string;
      full_name: string;
      email: string;
      role: string;
      status: string;
      community_id: string;
      invited_at: string;
    }[]) ?? []
  ).map((m) => ({
    ...m,
    community_name: communityMap.get(m.community_id) ?? "Unknown",
  }));

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Team"
        subtitle={`${members.length} ${members.length === 1 ? "member" : "members"} across ${communities.length} ${communities.length === 1 ? "community" : "communities"}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            All Team Members
          </h2>
          <InviteTeamMemberDialog communities={communities} />
        </div>

        <TeamTable members={members} />
      </main>
    </div>
  );
}
