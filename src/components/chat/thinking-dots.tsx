"use client";

import { memo } from "react";
import { motion } from "motion/react";

const DOT_DELAYS = [0, 150, 300] as const;

/** Animated three-dot indicator for active thinking/loading states. */
export const ThinkingDots = memo(function ThinkingDots() {
  return (
    <span className="ml-0.5 inline-flex items-center gap-0.5">
      {DOT_DELAYS.map((delay) => (
        <motion.span
          key={delay}
          className="inline-block size-1 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: delay / 1000, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
});
