"use client";

import * as React from "react";
import { ChevronDown, File, Folder } from "lucide-react";
import type { CodeFile } from "@/lib/types";
import { cn } from "@/lib/utils";

type FileTreeItem =
  | { kind: "file"; path: string }
  | { kind: "dir"; name: string; path: string; children: FileTreeItem[] };

export function buildFileTree(files: CodeFile[]): FileTreeItem[] {
  type Dir = Extract<FileTreeItem, { kind: "dir" }>;
  const dirMap = new Map<string, Dir>();
  const root: FileTreeItem[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    if (parts.length === 1) {
      root.push({ kind: "file", path: file.path });
      continue;
    }
    let nodes = root;
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      if (!dirMap.has(currentPath)) {
        const dir: Dir = { kind: "dir", name: parts[i], path: currentPath, children: [] };
        dirMap.set(currentPath, dir);
        nodes.push(dir);
      }
      nodes = dirMap.get(currentPath)!.children;
    }
    nodes.push({ kind: "file", path: file.path });
  }
  return root;
}

function FileTreeFolder({
  dir,
  depth,
  activeFilePath,
  setActiveFilePath,
}: {
  dir: Extract<FileTreeItem, { kind: "dir" }>;
  depth: number;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm text-muted-foreground transition hover:bg-accent/50 hover:text-foreground"
      >
        <ChevronDown className={cn("size-3 shrink-0 transition-transform", !open && "-rotate-90")} />
        <Folder className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span>{dir.name}</span>
      </button>
      {open && (
        <FileTreeNode
          items={dir.children}
          depth={depth + 1}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
        />
      )}
    </>
  );
}

export function FileTreeNode({
  items,
  depth,
  activeFilePath,
  setActiveFilePath,
}: {
  items: FileTreeItem[];
  depth: number;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
}) {
  return (
    <>
      {items.map((item) =>
        item.kind === "dir" ? (
          <FileTreeFolder
            key={item.path}
            dir={item}
            depth={depth}
            activeFilePath={activeFilePath}
            setActiveFilePath={setActiveFilePath}
          />
        ) : (
          <button
            key={item.path}
            type="button"
            onClick={() => setActiveFilePath(item.path)}
            style={{ paddingLeft: `${depth * 14 + 22}px` }}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-muted-foreground transition hover:bg-accent/40 hover:text-foreground",
              item.path === activeFilePath && "bg-accent text-foreground",
            )}
          >
            <File className="size-3.5 shrink-0" />
            <span className="truncate">{item.path.split("/").pop()}</span>
          </button>
        ),
      )}
    </>
  );
}
