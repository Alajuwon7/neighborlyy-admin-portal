"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { label: "Sign In", href: "/login" },
  { label: "Sign Up", href: "/signup" },
];

export function AuthToggleTabs() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className="flex rounded-full p-1 mb-8"
      style={{ backgroundColor: "var(--nly-surface)" }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="flex-1 py-2.5 px-6 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: isActive ? "var(--nly-brand)" : "transparent",
              color: isActive ? "var(--nly-brand-text)" : "var(--nly-text-tertiary)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
