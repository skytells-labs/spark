import { cn } from "@/lib/utils";

export function StatusPill({
  label,
  ok,
  muted,
}: {
  label: string;
  ok: boolean;
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1">
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok
            ? "bg-emerald-500"
            : muted
              ? "bg-muted-foreground/30"
              : "bg-amber-400",
        )}
      />
      {label}
    </span>
  );
}
