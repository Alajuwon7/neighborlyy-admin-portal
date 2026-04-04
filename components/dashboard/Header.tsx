"use client";

import { Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  trialDaysLeft?: number | null;
}

export function Header({ title, subtitle, trialDaysLeft }: HeaderProps) {
  return (
    <header
      className="h-16 flex items-center justify-between px-6 border-b shrink-0"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
        boxShadow: "var(--nly-shadow-sm)",
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Trial badge */}
        {trialDaysLeft !== null && trialDaysLeft !== undefined && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor:
                trialDaysLeft <= 3
                  ? "rgba(239, 68, 68, 0.12)"
                  : trialDaysLeft <= 7
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(16, 185, 129, 0.12)",
              color:
                trialDaysLeft <= 3
                  ? "var(--nly-error)"
                  : trialDaysLeft <= 7
                  ? "var(--nly-warning)"
                  : "var(--nly-success)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {trialDaysLeft > 0 ? `${trialDaysLeft}d trial` : "Trial ended"}
          </div>
        )}

        {/* Notifications */}
        <button
          className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:opacity-80"
          style={{ color: "var(--nly-text-secondary)" }}
        >
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
