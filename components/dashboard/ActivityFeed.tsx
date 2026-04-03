import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
  id: string;
  type:
    | "resident_joined"
    | "event_created"
    | "alert_sent"
    | "help_request"
    | "reservation";
  message: string;
  community_name?: string;
  created_at: string;
}

const ACTIVITY_ICONS: Record<ActivityItem["type"], { icon: string; color: string }> = {
  resident_joined: { icon: "👤", color: "var(--nly-success)" },
  event_created: { icon: "📅", color: "var(--nly-accent)" },
  alert_sent: { icon: "🚨", color: "var(--nly-warning)" },
  help_request: { icon: "🙋", color: "var(--nly-info)" },
  reservation: { icon: "📋", color: "var(--nly-brand)" },
};

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  return (
    <div
      className="rounded-2xl border"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--nly-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          Recent Activity
        </h3>
        <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          Live
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--nly-divider)" }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
              <div
                className="w-8 h-8 rounded-lg"
                style={{ backgroundColor: "var(--nly-surface-hover)" }}
              />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3 rounded"
                  style={{
                    backgroundColor: "var(--nly-surface-hover)",
                    width: `${60 + i * 8}%`,
                  }}
                />
                <div
                  className="h-2 rounded w-24"
                  style={{ backgroundColor: "var(--nly-surface-hover)" }}
                />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
              No activity yet. Activity will appear here as residents use the app.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const meta = ACTIVITY_ICONS[item.type];
            return (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: `${meta.color}15` }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-snug"
                    style={{ color: "var(--nly-text-primary)" }}
                  >
                    {item.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                    {item.community_name && (
                      <span className="mr-2" style={{ color: "var(--nly-text-tertiary)" }}>
                        {item.community_name} ·
                      </span>
                    )}
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
