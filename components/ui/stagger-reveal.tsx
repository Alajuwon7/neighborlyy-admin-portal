"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  once?: boolean;
}

export function StaggerReveal({
  children,
  className,
  staggerDelay = 0.08,
  initialDelay = 0,
  duration = 0.45,
  direction = "up",
  distance = 20,
  once = true,
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-40px 0px" });

  const directionMap = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  const offset = directionMap[direction];

  return (
    <motion.div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: offset.x, y: offset.y }}
              animate={
                isInView
                  ? { opacity: 1, x: 0, y: 0 }
                  : undefined
              }
              transition={{
                duration,
                delay: initialDelay + i * staggerDelay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              {child}
            </motion.div>
          ))
        : (
          <motion.div
            initial={{ opacity: 0, x: offset.x, y: offset.y }}
            animate={isInView ? { opacity: 1, x: 0, y: 0 } : undefined}
            transition={{ duration, delay: initialDelay, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        )}
    </motion.div>
  );
}
