"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Code2, FileCode } from "lucide-react";
import type { Artifact } from "@/lib/types";

interface InlineArtifactCardProps {
  artifact: Artifact;
  onOpen: () => void;
}

export function InlineArtifactCard({ artifact, onOpen }: InlineArtifactCardProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="mt-4 overflow-hidden rounded-[10px] border border-[#0070f3]/80 bg-[#111] shadow-[0_0_0_3px_rgba(0,112,243,0.24),0_10px_30px_rgba(0,0,0,0.22)]"
    >
      <div
        className="flex cursor-pointer items-center justify-between px-3.5 py-3 transition hover:bg-white/[0.03]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-md bg-[#0070f3]/14 ring-1 ring-[#0070f3]/28">
            <Code2 className="size-3.5 text-[#4da3ff]" />
          </div>
          <span className="text-[13px] font-medium text-white/86">{artifact.title}</span>
          <span className="font-mono text-[11px] text-white/42">
            v1
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/58 transition hover:bg-white/8 hover:text-white"
          >
            Open
          </button>
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            <ChevronDown className="size-4 text-white/22" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-3.5 py-2">
              {artifact.files.slice(0, 6).map((file) => (
                <div key={file.path} className="flex items-center gap-2 py-1 text-xs">
                  <FileCode className="size-3.5 shrink-0 text-white/22" />
                  <span className="text-white/56">{file.path.split("/").pop()}</span>
                  <span className="ml-auto font-mono text-[11px] text-white/24">{file.path}</span>
                </div>
              ))}
              {artifact.files.length > 6 && (
                <p className="py-1 text-xs text-white/26">
                  +{artifact.files.length - 6} more files
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
