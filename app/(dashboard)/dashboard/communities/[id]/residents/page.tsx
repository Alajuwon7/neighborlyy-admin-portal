import { getCommunityWithAuth } from "@/lib/queries";
import { filterResidents } from "@/lib/residents";
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

  // Email, phone and the real unit number are no longer readable from the
  // profiles table by any signed-in client: residents could read each other's
  // through the same grant (Miyora-App privacy migrations 20261126231915+).
  // The roster comes from the neighbour-safe columns, and the private fields
  // from get_resident_private_fields, which returns them only to this
  // community's PM or admin.
  const { data: rosterRaw } = await filterResidents(
    supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("community_code", community.community_code),
  ).order("full_name", { ascending: true });

  const roster =
    (rosterRaw as { id: string; full_name: string; created_at: string }[]) ?? [];

  const { data: privateRaw, error: privateError } = roster.length
    ? await supabase.rpc("get_resident_private_fields", {
        p_ids: roster.map((r) => r.id),
      })
    : { data: [], error: null };
  if (privateError) throw privateError;

  const privateById = new Map(
    ((privateRaw ?? []) as {
      id: string;
      email: string;
      phone: string | null;
      unit_number: string | null;
    }[]).map((p) => [p.id, p]),
  );

  const residents = roster.map((r) => {
    const p = privateById.get(r.id);
    return {
      ...r,
      email: p?.email ?? "",
      phone: p?.phone ?? null,
      unit_number: p?.unit_number ?? null,
    };
  });

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
