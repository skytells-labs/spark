import { cn } from "@/lib/utils";

/** Server Component — no "use client" needed. */
export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1 font-semibold", small ? "text-xs" : "text-base")}>
      <span className="pl-2 tracking-[-0.04em]">Skytells</span>
      <span className="text-muted-foreground">/</span>
      <span className="tracking-[-0.04em]">AI</span>
    </div>
  );
}
