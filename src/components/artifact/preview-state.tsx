"use client";

import * as React from "react";
import { Terminal } from "lucide-react";
import type { Artifact, TerminalCommand } from "@/lib/types";
import { WebPreview } from "@/components/ai-elements/web-preview";

interface PreviewStateProps {
  artifact: Artifact;
  terminalCommands?: TerminalCommand[];
  onShowTerminal?: () => void;
}

export function PreviewState({ artifact, terminalCommands, onShowTerminal }: PreviewStateProps) {
  const hasCommands = Boolean(terminalCommands?.length);
  const [showStatic, setShowStatic] = React.useState(!hasCommands);

  React.useEffect(() => {
    setShowStatic(!terminalCommands?.length);
  }, [artifact, terminalCommands]);

  if (hasCommands && !showStatic) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <div className="relative mb-8 flex size-24 items-center justify-center">
          <div
            className="absolute size-24 animate-ping rounded-full border border-border/40"
            style={{ animationDuration: "2.4s" }}
          />
          <div
            className="absolute size-16 animate-ping rounded-full border border-border/25"
            style={{ animationDuration: "2.4s", animationDelay: "0.7s" }}
          />
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
            <Terminal className="size-4 text-muted-foreground/60" />
          </div>
        </div>
        <h2 className="text-[15px] font-medium text-foreground/80">Dev server not running</h2>
        <p className="mt-2 max-w-[290px] text-center text-[13px] leading-6 text-muted-foreground">
          Approve the terminal commands below to install dependencies and start the dev server.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onShowTerminal?.()}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Terminal className="size-3.5" />
            Open Terminal
          </button>
          <button
            type="button"
            onClick={() => setShowStatic(true)}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground/50 transition hover:text-muted-foreground"
          >
            Static preview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {hasCommands && (
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-2 border-b border-amber-500/15 bg-amber-500/[0.06] px-3 py-1.5">
          <div className="size-1.5 rounded-full bg-amber-400/80" />
          <span className="text-[11px] text-amber-300/60">Static preview</span>
          <span className="text-[11px] text-white/28">
            — run terminal commands to start the live app
          </span>
          <button
            type="button"
            onClick={() => setShowStatic(false)}
            className="ml-auto text-white/24 transition hover:text-white/60"
            title="Back to not-running screen"
          >
            ×
          </button>
        </div>
      )}
      <WebPreview html={artifact.previewHtml} />
    </div>
  );
}
