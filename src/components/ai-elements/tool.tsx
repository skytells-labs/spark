"use client";

import {
  Check,
  Circle,
  FileCode,
  ImageIcon,
  Loader2,
  Music2,
  Search,
  Terminal,
  UploadCloud,
  Video,
} from "lucide-react";
import type { AgentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const icons = {
  reasoning: Terminal,
  search: Search,
  tool: Terminal,
  file: FileCode,
  deploy: UploadCloud,
  todo: Check,
  media: ImageIcon,
};

const todoStatusIcon = {
  pending: <Circle className="size-3 shrink-0 text-white/30" />,
  "in-progress": <Loader2 className="size-3 shrink-0 animate-spin text-blue-400" />,
  done: <Check className="size-3 shrink-0 text-emerald-400" />,
  error: <Circle className="size-3 shrink-0 text-red-400" />,
};

export function ToolCall({ step }: { step: AgentStep }) {
  if (step.type === "todo" && step.todos?.length) {
    return (
      <div className="relative flex items-start gap-2 text-sm text-white/62">
        <Check className="mt-0.5 size-3.5 shrink-0 text-white/45" />
        <div className="min-w-0 flex-1">
          <span className="text-white/72">{step.title}</span>
          <ul className="mt-2 space-y-1.5">
            {step.todos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-2 text-xs">
                {todoStatusIcon[todo.status]}
                <span
                  className={cn(
                    "leading-5",
                    todo.status === "done"
                      ? "text-white/45 line-through"
                      : todo.status === "error"
                        ? "text-red-300"
                        : todo.status === "in-progress"
                          ? "text-white/86"
                          : "text-white/55",
                  )}
                >
                  {todo.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (step.type === "reasoning") {
    return (
      <div className="relative flex items-start gap-2 text-sm text-white/62">
        <Terminal className="mt-0.5 size-3.5 shrink-0 text-blue-400/70" />
        <div className="min-w-0 flex-1">
          <span className="text-blue-300/80">{step.title}</span>
          {step.detail ? (
            <p className="mt-1 text-xs leading-5 text-white/48 italic">{step.detail}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const Icon =
    step.type === "media"
      ? step.mediaKind === "video"
        ? Video
        : step.mediaKind === "audio"
          ? Music2
          : ImageIcon
      : icons[step.type] ?? Terminal;

  return (
    <div className="relative flex items-start gap-2 text-sm text-white/62">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-white/45" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate", step.status === "error" ? "text-red-200" : "text-white/72")}>
            {step.title}
          </span>
          {step.status === "running" ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-white/36" />
          ) : null}
          {step.status === "done" ? (
            <Check className="size-3.5 shrink-0 text-white/36" />
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-white/42">{step.detail}</p>
      </div>
    </div>
  );
}
