import Link from "next/link";
import { getAuthenticatedPM } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { NotificationList } from "@/components/dashboard/NotificationList";
import { getNotifications, getNotificationCount } from "./actions";
import { NOTIFICATION_FILTERS } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const filter = (typeof resolvedParams.filter === "string" ? resolvedParams.filter : null);

  const { pm } = await getAuthenticatedPM();
  const supabase = await createClient();

  let commQuery = supabase
    .from("communities")
    .select("id, community_code, name");

  if (pm.organization_id) {
    commQuery = commQuery.eq("organization_id", pm.organization_id);
  } else {
    commQuery = commQuery.eq("property_manager_id", pm.id);
  }

  const { data: communitiesRaw } = await commQuery;
  const communities = (communitiesRaw as { id: string; community_code: string; name: string }[] | null) ?? [];

  if (communities.length === 0) redirect("/onboarding");

  const communityCodes = communities.map((c) => c.community_code);
  const communityMap: Record<string, string> = {};
  const communityNameMap: Record<string, string> = {};
  for (const c of communities) {
    communityMap[c.community_code] = c.id;
    communityNameMap[c.community_code] = c.name;
  }

  const notificationCount = await getNotificationCount(communityCodes);
  const { notifications, total } = await getNotifications(communityCodes, filter);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Notifications"
        subtitle={`${notificationCount} unread`}
        notificationCount={notificationCount}
        communityCodes={communityCodes}
        communityMap={communityMap}
        communityNameMap={communityNameMap}
      />
      <main className="flex-1 p-4 sm:p-6 space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            {NOTIFICATION_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "all" ? "/dashboard/notifications" : `/dashboard/notifications?filter=${f.value}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor:
                    (filter ?? "all") === f.value
                      ? "rgba(47, 196, 211, 0.1)"
                      : "transparent",
                  color:
                    (filter ?? "all") === f.value
                      ? "var(--nly-brand)"
                      : "var(--nly-text-secondary)",
                  border: `1px solid ${(filter ?? "all") === f.value ? "var(--nly-brand)" : "var(--nly-border)"}`,
                }}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <RefreshButton />
        </div>

        <NotificationList
          key={filter ?? "all"}
          notifications={notifications}
          total={total}
          communityCodes={communityCodes}
          communityMap={communityMap}
          communityNameMap={communityNameMap}
          filter={filter}
        />
      </main>
    </div>
  );
}
