"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { AgentStep } from "@/lib/types";
import { ReasoningStepRow } from "./step-row";
import { ThinkingDots } from "./thinking-dots";
import { ShimmerLines } from "./shimmer-lines";
import { useElapsed } from "./use-elapsed";
import { cn } from "@/lib/utils";

interface StepsSectionProps {
  steps: AgentStep[];
  isActive: boolean;
  startedAt?: number;
  finishedAt?: number;
}

/** Collapsible reasoning section displayed above the assistant's response text. */
export function StepsSection({ steps, isActive, startedAt, finishedAt }: StepsSectionProps) {
  const [open, setOpen] = React.useState(isActive);
  const elapsed = useElapsed(startedAt, finishedAt);

  React.useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  if (!isActive && steps.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] text-white/36 transition hover:text-white/62"
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="inline-flex"
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
        {isActive ? (
          <span className="flex items-center gap-0.5">
            Thinking
            <ThinkingDots />
          </span>
        ) : (
          <span>Thought for {elapsed}s</span>
        )}
        {!open && steps.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-white/30">
            {steps.length}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className={cn("mt-2 space-y-0.5 border-l border-white/8 pl-3")}>
              {steps.length > 0 ? (
                steps.map((step) => <ReasoningStepRow key={step.id} step={step} />)
              ) : (
                <ShimmerLines />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
