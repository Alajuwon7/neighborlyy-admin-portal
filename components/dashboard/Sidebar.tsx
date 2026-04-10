"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Bell,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  X,
  Zap,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/communities", label: "Communities", icon: Building2 },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/account", label: "Account", icon: Settings },
  { href: "/dashboard/command-center", label: "Command Center", icon: Zap, premium: true },
] as const;

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
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: "var(--nly-overlay)" }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-60 flex flex-col border-r z-50
          transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
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
            className="lg:hidden p-1.5 rounded-lg transition-all duration-200 hover:opacity-80 hover:rotate-90"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.05,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="nly-nav-hover flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium group"
                  data-active={isActive}
                  style={{
                    backgroundColor: isActive
                      ? "rgba(230, 92, 79, 0.1)"
                      : "transparent",
                    color: isActive
                      ? "var(--nly-brand)"
                      : "var(--nly-text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "var(--nly-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Icon
                    size={17}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                  <span className="flex-1">{item.label}</span>
                  {"premium" in item && item.premium && (
                    <Lock size={11} style={{ color: "var(--nly-text-placeholder)" }} />
                  )}
                  <AnimatePresence mode="wait">
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, x: -4, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 4, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight
                          size={13}
                          style={{ color: "var(--nly-brand)" }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t" style={{ borderColor: "var(--nly-border)" }}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-200 hover:opacity-80 group"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            <LogOut
              size={17}
              className="transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
