"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Nudge } from "@/lib/nudges";

const DISMISSED_KEY = "nly-dismissed-nudges";

function getDismissedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismissNudge(id: string) {
  const dismissed = getDismissedIds();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}

export function NudgeCards({ nudges }: { nudges: Nudge[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissedIds());
  }, []);

  const visible = nudges.filter((n) => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    dismissNudge(id);
    setDismissed((prev) => [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence mode="popLayout">
        {visible.map((nudge, i) => (
          <motion.div
            key={nudge.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="flex items-start gap-3.5 px-4 py-3.5 rounded-xl border group"
            style={{
              backgroundColor: `color-mix(in srgb, ${nudge.color} 5%, var(--nly-surface))`,
              borderColor: `color-mix(in srgb, ${nudge.color} 12%, transparent)`,
            }}
          >
            <span className="text-xl mt-0.5 shrink-0">{nudge.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--nly-text-primary)" }}>
                {nudge.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--nly-text-tertiary)" }}>
                {nudge.subtitle}{" "}
                <a
                  href={nudge.actionHref}
                  className="font-medium transition-colors hover:underline"
                  style={{ color: "var(--nly-accent)" }}
                >
                  {nudge.actionLabel} →
                </a>
              </p>
            </div>
            <button
              onClick={() => handleDismiss(nudge.id)}
              className="opacity-0 group-hover:opacity-60 transition-opacity text-xs px-1.5 py-0.5 rounded"
              style={{ color: "var(--nly-text-tertiary)" }}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
