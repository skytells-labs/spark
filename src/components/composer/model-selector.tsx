"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import type { ModelOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  models: ModelOption[];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  defaultModel?: string | null;
}

export function ModelSelector({
  models,
  selectedModel,
  setSelectedModel,
  defaultModel,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const selected = models.find((m) => m.id === selectedModel);

  const groups: Record<string, ModelOption[]> = {};
  for (const model of models) {
    const key = (model.type || "other").toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(model);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs text-white/58 transition hover:border-white/10 hover:bg-white/[0.07] hover:text-white"
      >
        <span className="max-w-[120px] truncate">{selected?.name ?? "Select model"}</span>
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 z-50 mb-2 w-[240px] overflow-hidden rounded-[10px] border border-white/12 bg-[#111] shadow-2xl"
          >
            {defaultModel && (
              <div className="border-b border-white/[0.07] px-3 py-2 text-[10px] text-white/40">
                Server default:{" "}
                <span className="rounded bg-white/10 px-1 py-0.5 text-white/60">
                  {models.find((m) => m.id === defaultModel)?.name ?? defaultModel}
                </span>
              </div>
            )}
            <div className="max-h-[260px] overflow-y-auto py-1">
              {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 pb-0.5 pt-2 text-[10px] font-medium tracking-wider text-white/30">
                    {group}
                  </div>
                  {items.map((model) => {
                    const isSelected = model.id === selectedModel;
                    const isDefault = model.id === defaultModel;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition",
                          isSelected
                            ? "bg-white/10 text-white"
                            : "text-white/65 hover:bg-white/[0.07] hover:text-white",
                        )}
                      >
                        <span className="flex-1 truncate">{model.name}</span>
                        {isDefault && (
                          <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-white/50">
                            env
                          </span>
                        )}
                        {isSelected && <Check className="size-3 shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
