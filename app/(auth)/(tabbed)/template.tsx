"use client";

import { MotionConfig, motion } from "motion/react";

/**
 * Per-navigation fade for the Sign In / Sign Up form swap.
 *
 * A `template` (unlike a `layout`) is re-instantiated on every navigation, so the
 * incoming form mounts fresh and plays this enter animation. Because there is no
 * exit phase, the form cannot flash 1→0→1 the way `AnimatePresence mode="wait"`
 * does inside an App Router layout (it can't snapshot the outgoing route).
 *
 * The shell (background image, hero stats, tabs) lives in the persistent
 * `layout.tsx` and is untouched by this remount.
 *
 * Reduced motion is honoured via `MotionConfig reducedMotion="user"` rather
 * than branching on `useReducedMotion()`: that hook is null during SSR but
 * reads matchMedia synchronously on the first client render, so a structural
 * branch hydration-mismatches for reduced-motion users. With MotionConfig the
 * tree is identical on server and client; the y-translate is simply skipped
 * for them at animation time and only the brief fade plays.
 */
export default function TabbedAuthTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
