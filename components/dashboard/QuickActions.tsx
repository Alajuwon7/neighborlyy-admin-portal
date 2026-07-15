import Link from "next/link";
import { CalendarPlus, Megaphone, UserPlus } from "lucide-react";

export function QuickActions({
  singleCommunityId,
}: {
  singleCommunityId: string | null;
}) {
  const base = singleCommunityId
    ? `/dashboard/communities/${singleCommunityId}`
    : null;

  const actions = [
    {
      label: "Create event",
      icon: CalendarPlus,
      href: base ? `${base}/events` : "/dashboard/events",
    },
    {
      label: "Send alert",
      icon: Megaphone,
      href: base ? `${base}/alerts` : "/dashboard/communities",
    },
    {
      label: "Invite residents",
      icon: UserPlus,
      href: base ? `${base}/residents` : "/dashboard/communities",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
          style={{
            backgroundColor: "var(--nly-surface)",
            border: "1px solid var(--nly-border)",
            color: "var(--nly-text-primary)",
            boxShadow: "var(--nly-shadow-sm)",
          }}
        >
          <a.icon size={16} style={{ color: "var(--nly-brand)" }} />
          {a.label}
        </Link>
      ))}
    </div>
  );
}
