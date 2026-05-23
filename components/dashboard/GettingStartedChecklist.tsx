"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useClientValue } from "@/hooks/useClientValue";
import {
  CheckCircle2,
  Circle,
  X,
  Building2,
  Users,
  CalendarPlus,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Building2;
  href?: string;
  action?: () => void;
  completed: boolean;
}

interface GettingStartedChecklistProps {
  hasResidents: boolean;
  hasEvents: boolean;
  hasPendingUsers: boolean;
  communityCreatedAt: string;
  onShareCode?: () => void;
}

const DISMISSED_KEY = "nly-getting-started-dismissed";
const COLLAPSED_KEY = "nly-getting-started-collapsed";

export function GettingStartedChecklist({
  hasResidents,
  hasEvents,
  hasPendingUsers,
  communityCreatedAt,
  onShareCode,
}: GettingStartedChecklistProps) {
  const router = useRouter();
  // User actions taken this session (override the persisted/computed defaults).
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);

  const items: ChecklistItem[] = [
    {
      id: "community",
      label: "Create your community",
      description: "Your community is set up and ready",
      icon: Building2,
      completed: true,
    },
    {
      id: "invite",
      label: "Invite your first residents",
      description: "Share your community code so residents can join",
      icon: Users,
      action: onShareCode,
      completed: hasResidents || hasPendingUsers,
    },
    {
      id: "event",
      label: "Create your first event",
      description: "Engage your community with an upcoming event",
      icon: CalendarPlus,
      href: "/dashboard/events",
      completed: hasEvents,
    },
    {
      id: "announcement",
      label: "Post a welcome announcement",
      description: "Let residents know what to expect",
      icon: Megaphone,
      href: "/dashboard/feed",
      completed: false,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const allDone = completedCount === items.length;
  const progress = (completedCount / items.length) * 100;

  // Hidden by default (also on the server) until hydration reveals the real
  // state, so the card never flashes before localStorage/age checks run.
  const storedDismissed = useClientValue(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return true;
    const hoursSinceCreation =
      (Date.now() - new Date(communityCreatedAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  }, true);
  const storedCollapsed = useClientValue(
    () => localStorage.getItem(COLLAPSED_KEY) === "true",
    false,
  );

  const dismissed = storedDismissed || manuallyDismissed;
  const collapsed =
    manualCollapsed ?? (storedCollapsed || (allDone && !dismissed));

  // Persist the auto-collapse decision (localStorage write only — no setState).
  useEffect(() => {
    if (allDone && !dismissed && manualCollapsed === null && !storedCollapsed) {
      localStorage.setItem(COLLAPSED_KEY, "true");
    }
  }, [allDone, dismissed, manualCollapsed, storedCollapsed]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setManuallyDismissed(true);
  }, []);

  const toggleCollapse = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(COLLAPSED_KEY, String(next));
    setManualCollapsed(next);
  }, [collapsed]);

  if (dismissed) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between cursor-pointer"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(47, 196, 211, 0.12)" }}
          >
            <span className="text-base">
              {allDone ? "✅" : "🚀"}
            </span>
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--nly-text-primary)" }}
            >
              {allDone ? "You're all set!" : "Getting Started"}
            </h3>
            <p
              className="text-xs"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              {completedCount} of {items.length} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "var(--nly-text-tertiary)" }}
            aria-label="Dismiss getting started"
          >
            <X size={14} />
          </button>
          {collapsed ? (
            <ChevronDown
              size={16}
              style={{ color: "var(--nly-text-tertiary)" }}
            />
          ) : (
            <ChevronUp
              size={16}
              style={{ color: "var(--nly-text-tertiary)" }}
            />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mx-4 sm:mx-5 h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--nly-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: allDone
              ? "var(--nly-success)"
              : "var(--nly-brand)",
          }}
        />
      </div>

      {/* Checklist items */}
      {!collapsed && (
        <div className="px-3 sm:px-5 py-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isClickable = !item.completed && (item.href || item.action);

            return (
              <button
                key={item.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-opacity"
                style={{
                  opacity: item.completed ? 0.6 : 1,
                  cursor: isClickable ? "pointer" : "default",
                }}
                onClick={() => {
                  if (item.completed) return;
                  if (item.action) item.action();
                  else if (item.href) router.push(item.href);
                }}
                disabled={item.completed}
              >
                {item.completed ? (
                  <CheckCircle2
                    size={20}
                    style={{ color: "var(--nly-success)" }}
                    className="shrink-0"
                  />
                ) : (
                  <Circle
                    size={20}
                    style={{ color: "var(--nly-text-tertiary)" }}
                    className="shrink-0"
                  />
                )}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: item.completed
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(47, 196, 211, 0.08)",
                  }}
                >
                  <Icon
                    size={16}
                    style={{
                      color: item.completed
                        ? "var(--nly-success)"
                        : "var(--nly-text-secondary)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: "var(--nly-text-primary)",
                      textDecoration: item.completed
                        ? "line-through"
                        : "none",
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--nly-text-tertiary)" }}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
