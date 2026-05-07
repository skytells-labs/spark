"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  Code2,
  Database,
  Download,
  ExternalLink,
  Eye,
  GitFork,
  MoreHorizontal,
  PanelLeft,
  Terminal,
} from "lucide-react";
import type { Artifact, CodeFile } from "@/lib/types";
import { PreviewState } from "./preview-state";
import { CodeState } from "./code-state";
import { DatabaseState } from "./database-state";
import { FlowState } from "./flow-state";
import { ArtifactTerminal } from "./artifact-terminal";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

interface ArtifactPanelProps {
  artifact: Artifact | null;
  activeTab: "preview" | "code" | "database" | "flow";
  setActiveTab: (tab: "preview" | "code" | "database" | "flow") => void;
  activeFile: CodeFile | null;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
  setArtifact?: (artifact: Artifact | null) => void;
  generating?: boolean;
}

export function ArtifactPanel({
  artifact,
  activeTab,
  setActiveTab,
  activeFile,
  activeFilePath,
  setActiveFilePath,
  setArtifact,
  generating = false,
}: ArtifactPanelProps) {
  const [terminalOpen, setTerminalOpen] = React.useState(true);

  React.useEffect(() => {
    if (artifact?.terminalCommands?.length) {
      setTerminalOpen(true);
    }
  }, [artifact?.terminalCommands?.length, artifact?.title]);

  const openPreview = React.useCallback(() => {
    if (!artifact) return;
    const url = URL.createObjectURL(new Blob([artifact.previewHtml], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [artifact]);

  const downloadZip = React.useCallback(async () => {
    if (!artifact) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const file of artifact.files) zip.file(file.path, file.content);
    zip.file("preview.html", artifact.previewHtml);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${artifact.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "skytells-project"}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }, [artifact]);

  const tabs = [
    [Eye, "preview", "Preview"],
    [Code2, "code", "Code"],
    [Database, "database", "Data"],
    [GitFork, "flow", "Flow"],
  ] as const;

  const toolbarTabs = (
    <div className="flex rounded-md border border-border bg-secondary/60 p-0.5">
      {tabs.map(([Icon, tab, label]) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={cn(
            "rounded-[5px] p-1.5 text-muted-foreground transition hover:text-foreground",
            activeTab === tab && "bg-accent text-foreground",
          )}
          title={label}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );

  return (
    <section className="min-w-0 flex-1 bg-background max-lg:hidden">
      <AnimatePresence mode="wait">
        {artifact ? (
          <motion.div
            key="artifact"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex h-full flex-col"
          >
            {/* Toolbar */}
            <div className="flex h-[51px] items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                {setArtifact && (
                  <button
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    onClick={() => setArtifact(null)}
                    title="Close artifact"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                {toolbarTabs}
              </div>

              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground lg:flex">
                <ChevronLeft className="size-3" />
                <span>/</span>
                <Logo small />
                <span>{artifact.route}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    artifact.terminalCommands?.length ? setTerminalOpen((v) => !v) : undefined
                  }
                  className={cn(
                    "relative rounded-md p-1.5 transition",
                    artifact.terminalCommands?.length
                      ? terminalOpen
                        ? "text-emerald-500 hover:bg-accent hover:text-emerald-400"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      : "cursor-default text-muted-foreground/25",
                  )}
                  title={
                    artifact.terminalCommands?.length
                      ? "Toggle terminal"
                      : "No terminal commands"
                  }
                >
                  <Terminal className="size-4" />
                  {artifact.terminalCommands?.length && !terminalOpen ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-2 items-center justify-center rounded-full bg-amber-400" />
                  ) : null}
                </button>
                <button
                  onClick={openPreview}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="Open in new tab"
                >
                  <ExternalLink className="size-4" />
                </button>
                <button
                  onClick={downloadZip}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="Download source ZIP"
                >
                  <Download className="size-4" />
                </button>
                <button
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="More"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">
                {activeTab === "preview" ? (
                  <PreviewState
                    artifact={artifact}
                    terminalCommands={artifact.terminalCommands}
                    onShowTerminal={() => setTerminalOpen(true)}
                  />
                ) : activeTab === "code" ? (
                  <CodeState
                    artifact={artifact}
                    activeFile={activeFile}
                    activeFilePath={activeFilePath}
                    setActiveFilePath={setActiveFilePath}
                  />
                ) : activeTab === "flow" ? (
                  <FlowState artifact={artifact} />
                ) : (
                  <DatabaseState artifact={artifact} />
                )}
              </div>
              {artifact.terminalCommands?.length ? (
                <ArtifactTerminal
                  commands={artifact.terminalCommands}
                  open={terminalOpen}
                  onToggle={() => setTerminalOpen((v) => !v)}
                />
              ) : null}
            </div>
          </motion.div>
        ) : generating ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex h-full flex-col"
          >
            <div className="flex h-[51px] items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <ChevronLeft className="size-4 text-muted-foreground/50" />
                {toolbarTabs}
              </div>
              <div className="hidden h-8 w-[360px] items-center justify-center rounded-md border border-border bg-card px-2 text-xs text-muted-foreground/50 lg:flex">
                <span className="mr-2 text-muted-foreground/35">/</span>
                <span>setting up preview</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/50">
                <Terminal className="size-4" />
                <MoreHorizontal className="size-4" />
              </div>
            </div>
            <GeneratingPreview />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid h-full place-items-center text-center"
          >
            <div>
              <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-[8px] border border-border bg-card">
                <PanelLeft className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">Artifact closed</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Ask Skytells Spark for a change and the preview, files, and database surfaces
                will reopen here.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function GeneratingPreview() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-background text-center">
      <div className="flex flex-col items-center">
        <div className="setup-project-card" aria-hidden="true">
          <div className="setup-project-window">
            <div className="setup-project-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="setup-project-grid" />
            <div className="setup-project-peak" />
            <div className="setup-project-scan" />
          </div>
        </div>
        <p className="mt-10 text-[18px] font-medium text-foreground/85">Setting up project...</p>
      </div>
    </div>
  );
}
