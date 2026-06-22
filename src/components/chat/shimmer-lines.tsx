"use client";

import { memo } from "react";

const SHIMMER_WIDTHS = [88, 72, 80] as const;

/** Animated shimmer skeleton lines displayed while waiting for the first token. */
export const ShimmerLines = memo(function ShimmerLines() {
  return (
    <div className="my-3 space-y-2.5">
      {SHIMMER_WIDTHS.map((w, i) => (
        <div
          key={i}
          className="relative h-[11px] overflow-hidden rounded-full bg-white/[0.05]"
          style={{ width: `${w}%` }}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.13] to-transparent" />
        </div>
      ))}
    </div>
  );
});
