"use client";

import { motion } from "motion/react";
import { Lightbulb } from "lucide-react";

interface OnboardingTipProps {
  text: string;
  visible?: boolean;
}

export function OnboardingTip({ text, visible = true }: OnboardingTipProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
      style={{
        backgroundColor: "rgba(120, 166, 200, 0.06)",
        border: "1px solid rgba(120, 166, 200, 0.12)",
      }}
    >
      <Lightbulb
        size={14}
        className="shrink-0 mt-0.5"
        style={{ color: "var(--nly-accent)" }}
      />
      <p className="text-xs leading-relaxed" style={{ color: "var(--nly-text-secondary)" }}>
        {text}
      </p>
    </motion.div>
  );
}
