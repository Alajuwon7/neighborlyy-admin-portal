import { getCommunityWithAuth } from "@/lib/queries";
import { ResidentsTable } from "@/components/community/ResidentsTable";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

export default async function ResidentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: residentsRaw } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, unit_number, created_at")
    .eq("community_code", community.community_code)
    .eq("status", "approved")
    // Exclude admin/PM profiles (a PM who also signed up on the mobile app has a
    // role='admin' profiles row in the same community) — they aren't residents.
    .or("role.is.null,role.neq.admin")
    .order("full_name", { ascending: true });

  const residents =
    (residentsRaw as {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
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
            Residents
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {residents.length} approved {residents.length === 1 ? "resident" : "residents"}
          </p>
        </div>
        <RefreshButton />
      </div>

      <ResidentsTable residents={residents} />
    </main>
  );
}
