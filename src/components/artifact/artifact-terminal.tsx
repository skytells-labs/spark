"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, Loader2, Terminal } from "lucide-react";
import type { TerminalCommand } from "@/lib/types";
import { buildMockOutput } from "@/lib/terminal";
import { cn } from "@/lib/utils";

interface ArtifactTerminalProps {
  commands: TerminalCommand[];
  open: boolean;
  onToggle: () => void;
}

export function ArtifactTerminal({ commands, open, onToggle }: ArtifactTerminalProps) {
  const [approved, setApproved] = React.useState<Set<string>>(new Set());
  const [running, setRunning] = React.useState<string | null>(null);
  const [outputs, setOutputs] = React.useState<Record<string, string[]>>({});

  function runCommand(cmd: string) {
    if (approved.has(cmd) || running) return;
    setRunning(cmd);
    const lines = buildMockOutput(cmd);
    let i = 0;
    const tick = setInterval(() => {
      if (i < lines.length) {
        setOutputs((prev) => ({ ...prev, [cmd]: [...(prev[cmd] ?? []), lines[i]] }));
        i++;
      } else {
        clearInterval(tick);
        setRunning(null);
        setApproved((prev) => new Set([...prev, cmd]));
      }
    }, 110);
  }

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden border-t border-border bg-card transition-all",
        open ? "h-[200px]" : "h-[36px]",
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border/70 px-3 text-xs text-muted-foreground">
        <Terminal className="size-3.5" />
        <span className="text-foreground/70">Terminal</span>
        <span className="ml-auto text-muted-foreground/50">
          {approved.size}/{commands.length} run
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-0.5 transition hover:bg-white/10"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="flex h-[164px]">
          <div className="w-[220px] shrink-0 space-y-1 overflow-y-auto border-r border-border/70 p-2">
            {commands.map((cmd) => {
              const isDone = approved.has(cmd.command);
              const isRunning = running === cmd.command;
              return (
                <div
                  key={cmd.command}
                  className={cn(
                    "rounded-md border p-2 text-[11px]",
                    isDone
                      ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                      : "border-border bg-secondary/30",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
                    ) : isRunning ? (
                      <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground/60" />
                    ) : (
                      <Terminal className="size-3 shrink-0 text-muted-foreground/45" />
                    )}
                    <span className="truncate font-mono text-foreground/80">{cmd.command}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground/50">{cmd.reason}</p>
                  {!isDone && !isRunning && (
                    <button
                      type="button"
                      onClick={() => runCommand(cmd.command)}
                      disabled={Boolean(running)}
                      className="mt-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Approve &amp; Run
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mono flex-1 overflow-auto p-3 text-[12px] leading-[1.6] text-foreground/75">
            {Object.values(outputs).flat().length === 0 ? (
              <span className="text-muted-foreground/40">Approve a command to run it&hellip;</span>
            ) : (
              Object.entries(outputs).map(([, lines]) =>
                lines.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      line.startsWith("$") || line.startsWith("✓")
                        ? "text-emerald-500 dark:text-emerald-400"
                        : "text-foreground/75",
                    )}
                  >
                    {line}
                  </div>
                )),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
