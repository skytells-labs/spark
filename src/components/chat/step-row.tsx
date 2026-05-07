"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Circle,
  FileCode,
  ImageIcon,
  ListChecks,
  Loader2,
  Music2,
  Search,
  Terminal,
  UploadCloud,
  Video,
} from "lucide-react";
import type { AgentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Reasoning step row ──────────────────────────────────────────────────────

export function ReasoningStepRow({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="py-0.5"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-start gap-2 text-left text-xs text-white/40 transition hover:text-white/62"
      >
        <Brain className="mt-0.5 size-3 shrink-0 text-white/28" />
        <span className="italic">{step.title}</span>
        {step.detail && (
          <ChevronDown
            className={cn("mt-0.5 size-3 shrink-0 transition-transform", expanded && "rotate-180")}
          />
        )}
      </button>
      <AnimatePresence>
        {expanded && step.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="mt-1 pl-5 text-[11px] leading-5 italic text-white/30">{step.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Todo step row ────────────────────────────────────────────────────────────

export function TodoStepRow({ step, isActive }: { step: AgentStep; isActive: boolean }) {
  const [expanded, setExpanded] = React.useState(true);
  const todos = step.todos ?? [];
  const done = todos.filter((t) => t.status === "done").length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="py-0.5"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-white/40 transition hover:text-white/62"
      >
        <ListChecks className="size-3 shrink-0 text-white/28" />
        <span>{step.title || "Tasks"}</span>
        {todos.length > 0 && (
          <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-white/30">
            {done}/{todos.length}
          </span>
        )}
        <ChevronDown
          className={cn("size-3 shrink-0 transition-transform", !expanded && "-rotate-90")}
        />
      </button>
      <AnimatePresence>
        {expanded && todos.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-0.5 pl-5">
              {todos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-1.5 text-[11px] text-white/32">
                  {todo.status === "done" ? (
                    <Check className="size-2.5 shrink-0 text-emerald-400/70" />
                  ) : todo.status === "in-progress" || isActive ? (
                    <Loader2 className="size-2.5 shrink-0 animate-spin text-white/30" />
                  ) : (
                    <Circle className="size-1.5 shrink-0 fill-white/14 text-transparent" />
                  )}
                  <span className={cn(todo.status === "done" && "line-through text-white/22")}>
                    {todo.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Generic step row ─────────────────────────────────────────────────────────

export function StepRow({ step, isActive }: { step: AgentStep; isActive: boolean }) {
  if (step.type === "reasoning") return <ReasoningStepRow step={step} />;
  if (step.type === "todo") return <TodoStepRow step={step} isActive={isActive} />;

  const running = step.status === "running";
  const label = step.detail || step.title;
  const icon =
    step.status === "error" ? (
      <AlertTriangle className="size-3 shrink-0 text-amber-400/60" />
    ) : running ? (
      <Loader2 className="size-3 shrink-0 animate-spin text-white/32" />
    ) : step.type === "file" ? (
      <FileCode className="size-3 shrink-0 text-white/22" />
    ) : step.type === "search" ? (
      <Search className="size-3 shrink-0 text-white/22" />
    ) : step.type === "media" ? (
      step.mediaKind === "video" ? (
        <Video className="size-3 shrink-0 text-white/22" />
      ) : step.mediaKind === "audio" ? (
        <Music2 className="size-3 shrink-0 text-white/22" />
      ) : (
        <ImageIcon className="size-3 shrink-0 text-white/22" />
      )
    ) : step.type === "deploy" ? (
      <UploadCloud className="size-3 shrink-0 text-white/22" />
    ) : (
      <Terminal className="size-3 shrink-0 text-white/22" />
    );

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-0.5 text-xs text-white/38"
    >
      {icon}
      <span
        className={cn(
          running ? "text-white/62" : step.status === "error" ? "text-amber-300/70" : "",
        )}
      >
        {label}
      </span>
    </motion.div>
  );
}
