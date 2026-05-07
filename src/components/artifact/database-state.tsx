import { Database } from "lucide-react";
import type { Artifact } from "@/lib/types";

/** Server Component — purely declarative database status view. */
export function DatabaseState({ artifact }: { artifact: Artifact }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md border border-border bg-card">
          <Database className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium">
          {artifact.databaseStatus === "connected" ? "Database Connected" : "No Database Connected"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{artifact.databaseNote}</p>
        <a
          href="https://console.skytells.ai"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Connect Database
        </a>
      </div>
    </div>
  );
}
