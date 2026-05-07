"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, Circle, Loader2, X } from "lucide-react";
import type { ChatMessage, TodoItem } from "@/lib/types";

interface StickyTodoPanelProps {
  messages: ChatMessage[];
  loading: boolean;
}

function getLatestTodos(messages: ChatMessage[]): TodoItem[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const steps = message.steps ?? [];
    for (let j = steps.length - 1; j >= 0; j -= 1) {
      const step = steps[j];
      if (step.type === "todo" && step.todos?.length) {
        return step.todos;
      }
    }
  }

  return [];
}

function statusIcon(status: TodoItem["status"], loading: boolean) {
  if (status === "done") {
    return <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400/80" />;
  }
  if (status === "in-progress") {
    return loading ? (
      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-sky-300/90" />
    ) : (
      <Circle className="mt-0.5 size-3.5 shrink-0 text-sky-300/80" />
    );
  }
  if (status === "error") {
    return <Circle className="mt-0.5 size-3.5 shrink-0 text-red-300/90" />;
  }
  return <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />;
}

export function StickyTodoPanel({ messages, loading }: StickyTodoPanelProps) {
  const todos = React.useMemo(() => getLatestTodos(messages), [messages]);
  const [expanded, setExpanded] = React.useState(true);
  const [closed, setClosed] = React.useState(false);

  if (!todos.length) return null;

  if (closed) {
    return (
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setClosed(false)}
          className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground transition hover:border-border/60 hover:text-foreground"
        >
          Show Live TODO
        </button>
      </div>
    );
  }

  const done = todos.filter((todo) => todo.status === "done").length;
  const complete = done === todos.length;

  return (
    <div className="mb-2.5 rounded-[10px] border border-border bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : complete ? (
          <CheckCircle2 className="size-3.5 text-emerald-400/70" />
        ) : (
          <Circle className="size-3.5 text-muted-foreground/60" />
        )}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-1 text-[12px] font-medium text-foreground/75 transition hover:text-foreground"
        >
          <span>Live TODO</span>
          <ChevronDown
            className={`size-3 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
        <div className="ml-auto text-[10px] text-muted-foreground/60">
          {done}/{todos.length} complete
        </div>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="rounded p-0.5 text-muted-foreground/60 transition hover:bg-accent hover:text-foreground"
          aria-label="Close Live TODO"
          title="Close Live TODO"
        >
          <X className="size-3" />
        </button>
      </div>

      {expanded ? (
        <ul className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-start gap-2 text-[11px] leading-5 text-foreground/70">
              {statusIcon(todo.status, loading)}
              <span className={todo.status === "done" ? "text-muted-foreground/50 line-through" : "text-foreground/75"}>
                {todo.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
