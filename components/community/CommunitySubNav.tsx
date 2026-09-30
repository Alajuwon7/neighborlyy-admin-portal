"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Users,
  Calendar,
  Bell,
  Dumbbell,
  BarChart3,
} from "lucide-react";

const TABS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/summary", label: "Weekly Summary", icon: BarChart3 },
  { href: "/pending", label: "Pending", icon: Clock },
  { href: "/residents", label: "Residents", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/facilities", label: "Facilities", icon: Dumbbell },
];

interface CommunitySubNavProps {
  communityId: string;
}

export function CommunitySubNav({ communityId }: CommunitySubNavProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/communities/${communityId}`;

  return (
    <nav
      className="flex items-center gap-1 px-4 sm:px-6 border-b overflow-x-auto"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {TABS.map((tab) => {
        const fullHref = basePath + tab.href;
        const isActive =
          tab.href === ""
            ? pathname === basePath
            : pathname.startsWith(fullHref);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={fullHref}
            className="nly-tab-indicator flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-all duration-200 whitespace-nowrap group"
            data-active={isActive}
            style={{
              borderColor: isActive ? "var(--nly-brand)" : "transparent",
              color: isActive
                ? "var(--nly-brand)"
                : "var(--nly-text-tertiary)",
            }}
          >
            <Icon
              size={14}
              className="transition-transform duration-200 group-hover:scale-110"
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
