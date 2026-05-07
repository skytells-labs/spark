"use client";

import * as React from "react";
import {
  Brain,
  CheckCircle2,
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
  Zap,
} from "lucide-react";
import type { AgentStep, Artifact, ChatMessage } from "@/lib/types";
import { MessageResponse } from "@/components/ai-elements/message";
import { InlineArtifactCard } from "@/components/artifact/inline-artifact-card";
import { ShimmerLines } from "./shimmer-lines";
import { useElapsed } from "./use-elapsed";
import { MediaPredictionCard } from "./media-prediction-card";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai/chain-of-thought";
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai/context";

interface AssistantMessageProps {
  message: ChatMessage;
  isActive: boolean;
  onViewArtifact: (artifact: Artifact) => void;
}

export function AssistantMessage({ message, isActive, onViewArtifact }: AssistantMessageProps) {
  const elapsed = useElapsed(message.startedAt, message.finishedAt);

  const normalizedSteps = React.useMemo(
    () =>
      (message.steps ?? []).map((step) => {
        const normalizedStatus =
          !isActive && step.status === "running" ? ("done" as const) : step.status;
        if (!isActive && step.type === "todo" && step.todos) {
          return {
            ...step,
            status: normalizedStatus,
          };
        }
        return { ...step, status: normalizedStatus };
      }),
    [isActive, message.steps],
  );

  const chainSteps = normalizedSteps;
  const reasoningSteps = React.useMemo(
    () => chainSteps.filter((step) => step.type === "reasoning"),
    [chainSteps],
  );
  const activityItems = React.useMemo(() => {
    type ActivityItem =
      | { kind: "step"; step: AgentStep }
      | { kind: "coding"; steps: AgentStep[]; status: "complete" | "active" | "pending" };

    const items: ActivityItem[] = [];
    const codingMap = new Map<string, AgentStep>();

    const flushCoding = () => {
      if (!codingMap.size) return;
      const steps = Array.from(codingMap.values());
      const status = steps.some((step) => step.status === "running")
        ? "active"
        : steps.some((step) => step.status === "error")
          ? "pending"
          : "complete";
      items.push({ kind: "coding", steps, status });
      codingMap.clear();
    };

    for (const step of chainSteps) {
      if (step.type === "reasoning") continue;
      if (step.type === "file") {
        const key = step.detail || step.title || step.id;
        codingMap.set(key, step);
        continue;
      }
      flushCoding();
      items.push({ kind: "step", step });
    }

    flushCoding();
    return items;
  }, [chainSteps]);

  const hasContent = Boolean(message.content.trim());
  const showShimmer = isActive && !hasContent && chainSteps.length === 0;
  const mediaSteps = React.useMemo(
    () => chainSteps.filter((step) => step.type === "media"),
    [chainSteps],
  );

  const getStepIcon = (step: (typeof chainSteps)[number]) => {
    if (step.type === "reasoning") return Brain;
    if (step.type === "todo") return ListChecks;
    if (step.type === "file") return FileCode;
    if (step.type === "search") return Search;
    if (step.type === "deploy") return UploadCloud;
    if (step.type === "media") {
      if (step.mediaKind === "video") return Video;
      if (step.mediaKind === "audio") return Music2;
      return ImageIcon;
    }
    return Terminal;
  };

  const getStepStatus = (step: (typeof chainSteps)[number]) => {
    if (step.type === "todo") {
      const todos = step.todos ?? [];
      if (todos.some((todo) => todo.status === "in-progress")) return "active" as const;
      if (todos.some((todo) => todo.status === "pending") && isActive) return "active" as const;
      if (todos.some((todo) => todo.status === "error")) return "pending" as const;
      return "complete" as const;
    }

    if (step.status === "running") return "active" as const;
    if (step.status === "error") return "pending" as const;
    return "complete" as const;
  };

  const getSourceLabel = (value: string) => {
    try {
      return new URL(value).hostname;
    } catch {
      return value;
    }
  };

  return (
    <div className="mb-7 w-full px-1">
      {hasContent && (
        <div className="mt-1 rounded-[8px] border border-transparent text-[14px] leading-6 text-white/88">
          <MessageResponse isAnimating={isActive}>{message.content}</MessageResponse>
        </div>
      )}

      {chainSteps.length > 0 ? (
        <div className="mt-3 mb-4">
          <ChainOfThought defaultOpen className="w-full">
            <ChainOfThoughtHeader className="text-white/56 [&_svg]:text-white/42">
              {isActive ? "Thinking..." : `Thought for ${Math.max(0, elapsed)}s`}
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent className="space-y-3">
              {reasoningSteps.map((step) =>
                step.detail ? (
                  <p key={step.id} className="text-[13px] leading-6 text-white/58">
                    {step.detail}
                  </p>
                ) : null,
              )}
              {activityItems.length ? (
                <div className="space-y-0 pt-1">
                  {activityItems.map((item) => {
                    if (item.kind === "coding") {
                      return (
                        <ChainOfThoughtStep
                          icon={FileCode}
                          key={`coding-${item.steps.map((step) => step.detail || step.id).join("|")}`}
                          label="Coding..."
                          status={item.status}
                        >
                          <div className="space-y-1.5 text-xs text-white/62">
                            {item.steps.map((step) => (
                              <div
                                key={step.detail || step.id}
                                className="flex min-w-0 items-center gap-2"
                              >
                                <FileCode className="size-3.5 shrink-0 text-white/36" />
                                <span className="truncate font-mono text-[12px] text-white/74">
                                  {step.detail || step.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ChainOfThoughtStep>
                      );
                    }

                    const step = item.step;
                    const Icon = getStepIcon(step);
                    const status = getStepStatus(step);
                    const sources =
                      step.sources?.filter((source) => source.url.trim().length > 0) ?? [];

                    return (
                      <ChainOfThoughtStep
                        description={step.type === "todo" ? undefined : step.detail}
                        icon={Icon}
                        key={step.id}
                        label={step.title}
                        status={status}
                      >
                        {step.type === "todo" && step.todos?.length ? (
                          <div className="space-y-1.5 text-xs text-white/65">
                            {step.todos.map((todo) => (
                              <div key={todo.id} className="flex items-center gap-2">
                                {todo.status === "done" ? (
                                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400/80" />
                                ) : todo.status === "in-progress" ? (
                                  <Loader2 className="size-3.5 shrink-0 animate-spin text-white/70" />
                                ) : (
                                  <Circle className="size-3.5 shrink-0 text-white/40" />
                                )}
                                <span
                                  className={
                                    todo.status === "done" ? "text-white/42 line-through" : ""
                                  }
                                >
                                  {todo.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {sources.length ? (
                          <ChainOfThoughtSearchResults>
                            {sources.map((source) => (
                              <ChainOfThoughtSearchResult key={`${step.id}-${source.url}`}>
                                {getSourceLabel(source.url)}
                              </ChainOfThoughtSearchResult>
                            ))}
                          </ChainOfThoughtSearchResults>
                        ) : null}
                      </ChainOfThoughtStep>
                    );
                  })}
                </div>
              ) : null}
            </ChainOfThoughtContent>
          </ChainOfThought>
        </div>
      ) : null}

      {mediaSteps.length ? (
        <div className="mt-3 space-y-2">
          {mediaSteps.map((step) => (
            <MediaPredictionCard key={`prediction-${step.id}`} step={step} />
          ))}
        </div>
      ) : null}

      {showShimmer && <ShimmerLines />}

      {message.artifact && (
        <InlineArtifactCard
          artifact={message.artifact}
          onOpen={() => onViewArtifact(message.artifact!)}
        />
      )}

      {message.finishedAt && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-white/22">
          <span className="flex items-center gap-1">
            <Zap className="size-3" />
            Worked for {Math.max(0, elapsed)}s
          </span>
          <span>
            {new Date(message.finishedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.usage?.total_tokens ? (
            <Context
              maxTokens={Math.max(1, Math.ceil(message.usage.total_tokens * 1.25))}
              modelId={message.modelId}
              usage={{
                inputTokens: message.usage.prompt_tokens ?? 0,
                inputTokenDetails: {
                  cacheReadTokens: undefined,
                  cacheWriteTokens: undefined,
                  noCacheTokens: undefined,
                },
                outputTokens: message.usage.completion_tokens ?? 0,
                outputTokenDetails: {
                  reasoningTokens: undefined,
                  textTokens: undefined,
                },
                totalTokens: message.usage.total_tokens ?? 0,
              }}
              usedTokens={message.usage.total_tokens}
            >
              <ContextTrigger className="h-auto px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white/70" />
              <ContextContent className="border-white/10 bg-[#0f0f0f] text-white">
                <ContextContentHeader className="text-white" />
                <ContextContentBody className="space-y-2 text-white">
                  <ContextInputUsage className="text-white [&>span:first-child]:text-white/60" />
                  <ContextOutputUsage className="text-white [&>span:first-child]:text-white/60" />
                  <ContextReasoningUsage className="text-white [&>span:first-child]:text-white/60" />
                  <ContextCacheUsage className="text-white [&>span:first-child]:text-white/60" />
                </ContextContentBody>
                <ContextContentFooter className="bg-white/4 text-white" />
              </ContextContent>
            </Context>
          ) : null}
        </div>
      )}
    </div>
  );
}
