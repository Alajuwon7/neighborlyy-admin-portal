import { getCommunityWithAuth } from "@/lib/queries";
import { CreateAlertDialog } from "@/components/community/CreateAlertDialog";

export const dynamic = "force-dynamic";

const PRIORITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  urgent: {
    color: "var(--nly-alert-urgent)",
    bg: "rgba(239, 68, 68, 0.1)",
    label: "Urgent",
  },
  high: {
    color: "var(--nly-alert-high)",
    bg: "rgba(249, 115, 22, 0.1)",
    label: "High",
  },
  medium: {
    color: "var(--nly-alert-medium)",
    bg: "rgba(245, 158, 11, 0.1)",
    label: "Medium",
  },
  low: {
    color: "var(--nly-alert-low)",
    bg: "rgba(6, 182, 212, 0.1)",
    label: "Low",
  },
};

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, community } = await getCommunityWithAuth(id);

  const { data: alertsRaw } = await supabase
    .from("alerts")
    .select("*")
    .eq("community_code", community.community_code)
    .order("created_at", { ascending: false });

  const alerts =
    (alertsRaw as {
      id: string;
      title: string;
      message: string;
      priority: string;
      created_at: string;
    }[]) ?? [];

  return (
    <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            Alerts
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            {alerts.length} {alerts.length === 1 ? "alert" : "alerts"} sent
          </p>
        </div>
        <CreateAlertDialog
          communityCode={community.community_code}
          communityId={id}
        />
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
            No alerts have been sent yet.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          {alerts.map((a) => {
            const config = PRIORITY_CONFIG[a.priority] ?? PRIORITY_CONFIG.low;
            return (
              <div
                key={a.id}
                className="px-5 py-4 space-y-1.5"
                style={{ borderColor: "var(--nly-divider)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className="text-sm font-semibold"
                        style={{ color: "var(--nly-text-primary)" }}
                      >
                        {a.title}
                      </h4>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: config.bg,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: "var(--nly-text-secondary)" }}
                    >
                      {a.message}
                    </p>
                  </div>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--nly-text-tertiary)" }}
                  >
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
