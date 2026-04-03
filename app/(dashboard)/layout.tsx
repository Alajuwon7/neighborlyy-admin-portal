"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "var(--nly-background)" }}
    >
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col lg:ml-60 min-h-screen">
        {/* Mobile top bar with hamburger */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ color: "var(--nly-text-secondary)" }}
          >
            <Menu size={20} />
          </button>
          <h1
            className="text-sm font-bold tracking-wide"
            style={{ color: "var(--nly-brand)" }}
          >
            NEIGHBORLYY
          </h1>
        </div>

        {children}
      </div>
    </div>
  );
}
