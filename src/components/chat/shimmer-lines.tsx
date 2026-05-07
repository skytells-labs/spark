"use client";

export function ShimmerLines() {
  return (
    <div className="my-3 space-y-2.5">
      {[88, 72, 80].map((width, index) => (
        <div
          key={index}
          className="relative h-[11px] overflow-hidden rounded-full bg-white/[0.05]"
          style={{ width: `${width}%` }}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.13] to-transparent" />
        </div>
      ))}
    </div>
  );
}
