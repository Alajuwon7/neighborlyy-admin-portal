import { getCommunityWithAuth } from "@/lib/queries";
import { CreateAlertDialog } from "@/components/community/CreateAlertDialog";
import { AlertsList } from "@/components/community/AlertsList";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: alertsRaw } = await supabase
    .from("alerts")
    .select(
      "id, title, message, priority, is_pinned, pin_expires_at, valid_until, created_at"
    )
    .eq("community_code", community.community_code)
    .order("created_at", { ascending: false });

  const alerts =
    (alertsRaw as {
      id: string;
      title: string;
      message: string;
      priority: string;
      is_pinned: boolean | null;
      pin_expires_at: string | null;
      valid_until: string | null;
      created_at: string;
    }[]) ?? [];

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--nly-text-secondary)" }}>
            Alerts
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {alerts.length} {alerts.length === 1 ? "alert" : "alerts"} sent
          </p>
        </div>
        <CreateAlertDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      <AlertsList alerts={alerts} communityId={id} />
    </main>
  );
}
