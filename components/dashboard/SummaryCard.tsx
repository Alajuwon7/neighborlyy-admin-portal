"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

interface SummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  trend?: { value: string; tone?: "positive" | "neutral" | "negative"; label?: string };
  footer?: ReactNode;
  accentColor?: string;
  index?: number;
  href?: string;
}

export function SummaryCard({
  label,
  value,
  subtext,
  icon,
  trend,
  footer,
  accentColor = "var(--nly-brand)",
  index = 0,
  href,
}: SummaryCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px" });

  const card = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{
        duration: 0.45,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="nly-card-hover nly-gradient-border rounded-2xl pt-4 px-5 pb-5 flex flex-col gap-2 relative overflow-hidden h-full"
      style={{
        backgroundColor: "var(--nly-surface)",
        boxShadow: "var(--nly-shadow-sm)",
      }}
    >
      {/* Subtle accent glow in corner */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-[0.06] blur-2xl pointer-events-none"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-center justify-between relative">
        <p className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {label}
        </p>
        <motion.div
          className="w-11 h-11 rounded-xl flex items-center justify-center nly-hover-icon-spin"
          style={{ backgroundColor: `${accentColor}18` }}
          whileHover={{ scale: 1.1, rotate: 8 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {icon}
        </motion.div>
      </div>

      <div className="relative">
        <motion.p
          className="text-4xl font-bold tabular-nums leading-none"
          style={{ color: "var(--nly-text-primary)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.4, delay: index * 0.08 + 0.15 }}
        >
          {value}
        </motion.p>
        {subtext && (
          <p className="text-xs mt-1.5" style={{ color: "var(--nly-text-tertiary)" }}>
            {subtext}
          </p>
        )}
      </div>

      {footer && <div className="relative mt-auto pt-1">{footer}</div>}

      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold"
            style={{
              color:
                trend.tone === "negative"
                  ? "var(--nly-error)"
                  : trend.tone === "neutral"
                  ? "var(--nly-text-secondary)"
                  : "var(--nly-success)",
            }}
          >
            {trend.tone === "negative"
              ? "\u2193 "
              : trend.tone === "neutral"
              ? ""
              : "\u2191 "}
            {trend.value}
          </span>
          <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            {trend.label ?? "vs last month"}
          </span>
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nly-brand)]"
      >
        {card}
      </Link>
    );
  }
  return card;
}
