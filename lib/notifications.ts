export type NotificationType =
  | "pending_resident"
  | "event_rsvp"
  | "facility_reservation"
  | "help_request";

export interface AdminNotification {
  id: string;
  community_code: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actor_name: string | null;
  reference_id: string | null;
  reference_table: string | null;
  is_read: boolean;
  created_at: string;
}

export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; icon: string; color: string }
> = {
  pending_resident: { label: "Residents", icon: "UserPlus", color: "var(--nly-warning)" },
  event_rsvp: { label: "RSVPs", icon: "CalendarCheck", color: "var(--nly-accent)" },
  facility_reservation: { label: "Reservations", icon: "ClipboardList", color: "var(--nly-brand)" },
  help_request: { label: "Help Requests", icon: "HelpCircle", color: "var(--nly-info)" },
};

export const NOTIFICATION_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending_resident", label: "Residents" },
  { value: "event_rsvp", label: "RSVPs" },
  { value: "facility_reservation", label: "Reservations" },
  { value: "help_request", label: "Help Requests" },
] as const;

/**
 * Resolve a notification to a deep link URL.
 * communityMap: community_code → community id
 */
export function getNotificationHref(
  notification: AdminNotification,
  communityMap: Map<string, string>,
): string {
  const communityId = communityMap.get(notification.community_code);
  if (!communityId) return "/dashboard/communities";

  switch (notification.type) {
    case "pending_resident":
      return `/dashboard/communities/${communityId}/pending`;
    case "event_rsvp":
      return `/dashboard/communities/${communityId}/events`;
    case "facility_reservation":
      return `/dashboard/communities/${communityId}/facilities`;
    case "help_request":
      return `/dashboard/communities/${communityId}`;
    default:
      return `/dashboard/communities/${communityId}`;
  }
}
