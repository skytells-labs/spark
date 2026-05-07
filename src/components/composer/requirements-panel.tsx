import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { HealthStatus } from "@/lib/types";

/** Server Component — renders a read-only requirements checklist. */
export function RequirementsPanel({ health }: { health: HealthStatus | null }) {
  const statuses = [
    {
      label: "Skytells API key",
      ok: health?.skytells.ok,
      message: health?.skytells.message || "Validates live text models.",
    },
    {
      label: "Postgres",
      ok: health?.databases.postgres.ok,
      message:
        health?.databases.postgres.message ||
        "User accounts, billing events, credit ledger, usage analytics, SaaS organizations and subscriptions.",
    },
    {
      label: "libSQL",
      ok: health?.databases.libsql.ok,
      message:
        health?.databases.libsql.message ||
        "Builder state, chats, artifacts, MCP configurations, and low-latency edge reads.",
    },
    {
      label: "Redis",
      ok: health?.databases.redis.ok,
      message:
        health?.databases.redis.message ||
        "Recommended for generation state cache, SSE stream management, model response cache, rate limiting, and fast counters.",
    },
  ];

  return (
    <aside className="rounded-[10px] border border-border bg-card p-4 text-left shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground/90">
            Production requirements
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Generation is blocked until required services validate live.
          </p>
        </div>
        <a
          href="https://console.skytells.ai/projects"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
        >
          Open Console
        </a>
      </div>
      <div className="space-y-2">
        {statuses.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-secondary/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              {item.ok ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-300" />
              )}
              <span>{item.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.message}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[8px] border border-border bg-secondary/20 p-3">
        <h3 className="text-sm font-medium text-foreground/80">Skytells database setup</h3>
        <ol className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
          <li>
            <span className="text-foreground/70">1.</span> Open Skytells Console and create or choose a
            project.
          </li>
          <li>
            <span className="text-foreground/70">2.</span> Go to Databases and deploy Postgres,
            libSQL, and Redis for production caching.
          </li>
          <li>
            <span className="text-foreground/70">3.</span> Postgres and libSQL are required. Redis is
            recommended, and can be enforced with{" "}
            <code className="rounded bg-secondary px-1 text-muted-foreground">REDIS_REQUIRED=true</code>.
          </li>
          <li>
            <span className="text-foreground/70">4.</span> Set{" "}
            <code className="rounded bg-secondary px-1 text-muted-foreground">POSTGRES_URL</code>,{" "}
            <code className="rounded bg-secondary px-1 text-muted-foreground">LIBSQL_URL</code>,{" "}
            <code className="rounded bg-secondary px-1 text-muted-foreground">REDIS_URL</code>, and{" "}
            <code className="rounded bg-secondary px-1 text-muted-foreground">.env</code>.
          </li>
        </ol>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href="https://console.skytells.ai/projects"
            target="_blank"
            rel="noreferrer"
          className="rounded-md border border-border px-2.5 py-2 text-center text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Projects
          </a>
          <a
            href="https://console.skytells.ai/projects/{project_name}/databases/new"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-2.5 py-2 text-center text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            New database
          </a>
        </div>
      </div>
    </aside>
  );
}
