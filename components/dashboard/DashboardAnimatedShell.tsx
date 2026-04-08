"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

/**
 * Wraps dashboard sections with scroll-triggered reveal animations
 * and the gradient mesh background.
 */
export function DashboardAnimatedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="nly-mesh-bg flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
      {children}
    </div>
  );
}

/**
 * A section that reveals when scrolled into view.
 */
export function DashboardSection({
  children,
  delay = 0,
  direction = "up" as const,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  return (
    <ScrollReveal delay={delay} direction={direction} className={className}>
      {children}
    </ScrollReveal>
  );
}
