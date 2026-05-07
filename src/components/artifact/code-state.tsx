"use client";

import { Boxes, File, Search } from "lucide-react";
import type { Artifact, CodeFile } from "@/lib/types";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { FileTreeNode, buildFileTree } from "./file-tree";

interface CodeStateProps {
  artifact: Artifact;
  activeFile: CodeFile | null;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
}

export function CodeState({ artifact, activeFile, activeFilePath, setActiveFilePath }: CodeStateProps) {
  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[294px] shrink-0 border-r border-border bg-background lg:block">
        <div className="flex h-9 items-center gap-3 border-b border-border px-3 text-muted-foreground">
          <File className="size-4" />
          <Search className="size-4" />
          <Boxes className="size-4" />
          <span className="ml-auto text-xs uppercase text-muted-foreground/60">{artifact.title}</span>
        </div>
        <div className="overflow-y-auto p-1.5 text-sm">
          <FileTreeNode
            items={buildFileTree(artifact.files)}
            depth={0}
            activeFilePath={activeFilePath}
            setActiveFilePath={setActiveFilePath}
          />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {activeFile && <CodeBlock code={activeFile.content} language={activeFile.language} />}
      </div>
    </div>
  );
}
