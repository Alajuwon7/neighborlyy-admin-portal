import { getCommunityWithAuth } from "@/lib/queries";
import { PendingUsersTable } from "@/components/community/PendingUsersTable";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

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
    <main className="flex-1 p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Pending Approvals
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {pendingUsers.length} {pendingUsers.length === 1 ? "request" : "requests"} waiting
          </p>
        </div>
        <RefreshButton />
      </div>

      <PendingUsersTable users={pendingUsers} communityId={id} />
    </main>
  );
}
