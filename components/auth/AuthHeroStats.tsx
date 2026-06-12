"use client";

import { MotionConfig, motion } from "motion/react";

const STATS = [
  { label: "Avg. Engagement", value: "68%" },
  { label: "Renewal Lift", value: "+12%" },
  { label: "Setup Time", value: "<10 min" },
];

export function AuthHeroStats() {
  // Reduced-motion preference (carried over from the a11y audit) is honoured
  // via MotionConfig rather than useReducedMotion() branching — the hook is
  // null on the server but reads matchMedia on the first client render, so
  // branching on it hydration-mismatches for reduced-motion users. With
  // MotionConfig the entrance translate and hover lift (transforms) are
  // dropped for them automatically and only the fade plays.
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-wrap gap-4 xl:gap-6">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: 0.2 + i * 0.13,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{
              y: -6,
              transition: { duration: 0.2, ease: "easeOut" },
            }}
            className="px-5 py-4 rounded-2xl border"
            style={{
              backgroundColor: "rgba(10, 22, 40, 0.5)",
              borderColor: "rgba(255, 255, 255, 0.14)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28)",
            }}
          >
            <p
              className="text-3xl font-bold leading-none"
              style={{ color: "var(--nly-brand)" }}
            >
              {stat.value}
            </p>
            <p
              className="text-xs mt-1.5 tracking-wide"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>
    </MotionConfig>
  );
}
