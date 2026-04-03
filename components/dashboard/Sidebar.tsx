"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/communities", label: "Communities", icon: Building2 },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/account", label: "Account", icon: Settings },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed");
    } else {
      router.push("/login");
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "var(--nly-overlay)" }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-60 flex flex-col border-r z-50
          transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Logo + mobile close */}
        <div
          className="p-5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--nly-border)" }}
        >
          <div>
            <h1
              className="text-base font-bold tracking-wide"
              style={{ color: "var(--nly-brand)" }}
            >
              NEIGHBORLYY
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Property Manager Portal
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
                style={{
                  backgroundColor: isActive
                    ? "rgba(230, 92, 79, 0.1)"
                    : "transparent",
                  color: isActive
                    ? "var(--nly-brand)"
                    : "var(--nly-text-secondary)",
                }}
              >
                <Icon size={17} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight
                    size={13}
                    style={{ color: "var(--nly-brand)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t" style={{ borderColor: "var(--nly-border)" }}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-opacity hover:opacity-80"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
