"use client";

import * as React from "react";
import type {
  AgentMode,
  Artifact,
  ChatAttachment,
  ChatMessage,
  CodeFile,
  MediaGenerationModels,
  MediaGenerationModes,
  ModelOption,
} from "@/lib/types";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { ArtifactPanel } from "@/components/artifact/artifact-panel";
import { PromptBox } from "@/components/composer/prompt-box";
import { StickyTodoPanel } from "./sticky-todo-panel";
import { type ClarificationQuestion } from "@/components/composer/clarification-panel";
import { ArrowLeft, GitFork, Send } from "lucide-react";

/* ── Inline clarification panel (workspace variant — no full-screen overlay) ── */
function InlineClarificationPanel({
  questions,
  originalPrompt,
  onSubmit,
  onDismiss,
}: {
  questions: ClarificationQuestion[];
  originalPrompt: string;
  onSubmit: (answers: Record<string, string>) => void;
  onDismiss: () => void;
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setAnswers({});
  }, [questions]);

  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-lg bg-violet-500/10">
          <GitFork className="size-3.5 text-violet-400" />
        </div>
        <p className="text-xs font-medium text-white/75">A few quick questions before planning…</p>
      </div>
      {/* Prompt preview */}
      <div className="mx-3.5 mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
        <p className="line-clamp-2 text-[11px] leading-5 text-white/40">{originalPrompt}</p>
      </div>
      {/* Questions */}
      <div className="grid gap-3 p-3.5 pt-3">
        {questions.map((q, i) => (
          <label key={q.id} className="grid gap-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-semibold text-violet-400/70">{i + 1}.</span>
              <span className="text-xs text-white/70">{q.question}</span>
            </div>
            {q.hint && <p className="text-[10px] leading-4 text-white/30 pl-3.5">{q.hint}</p>}
            <textarea
              rows={2}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Your answer…"
              className="w-full resize-none rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-white/20 focus:border-violet-500/40 focus:bg-white/[0.04] transition"
            />
          </label>
        ))}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-white/30 transition hover:text-white/55"
          >
            Skip — proceed without answers
          </button>
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => onSubmit(answers)}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send className="size-3" />
            Continue to plan
          </button>
        </div>
      </div>
    </div>
  );
}

interface WorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
  setPrompt: (value: string) => void;
  submit: (value?: string) => void;
  onStop?: () => void;
  loading: boolean;
  error: string | null;
  attachments: ChatAttachment[];
  setAttachments: (next: ChatAttachment[]) => void;
  artifact: Artifact | null;
  activeTab: "preview" | "code" | "database" | "flow";
  setActiveTab: (tab: "preview" | "code" | "database" | "flow") => void;
  activeFile: CodeFile | null;
  activeFilePath: string;
  setActiveFilePath: (path: string) => void;
  setArtifact: (artifact: Artifact | null) => void;
  selectedModel: string;
  models: ModelOption[];
  setSelectedModel: (value: string) => void;
  defaultModel?: string | null;
  generationModes: MediaGenerationModes;
  setGenerationModes: (next: MediaGenerationModes) => void;
  generationModels: MediaGenerationModels;
  onBack?: () => void;
  onRetry?: () => void;
  agentMode?: AgentMode;
  setAgentMode?: (mode: AgentMode) => void;
  clarification?: { prompt: string; questions: ClarificationQuestion[] } | null;
  onClarificationSubmit?: (answers: Record<string, string>) => void;
  onClarificationDismiss?: () => void;
}

export function Workspace({
  messages,
  prompt,
  setPrompt,
  submit,
  onStop,
  loading,
  error,
  attachments,
  setAttachments,
  artifact,
  activeTab,
  setActiveTab,
  activeFile,
  activeFilePath,
  setActiveFilePath,
  setArtifact,
  selectedModel,
  models,
  setSelectedModel,
  defaultModel,
  generationModes,
  setGenerationModes,
  generationModels,
  onBack,
  onRetry,
  agentMode,
  setAgentMode,
  clarification,
  onClarificationSubmit,
  onClarificationDismiss,
}: WorkspaceProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = bottomRef.current?.parentElement;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: loading ? "auto" : "smooth",
    });
  }, [messages.length, loading]);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Chat panel */}
      <aside className="flex w-[414px] shrink-0 flex-col border-r border-border bg-background max-lg:w-full max-lg:border-r-0">
        {onBack && (
          <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
            <button
              type="button"
              onClick={onBack}
              className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
              New chat
            </button>
          </div>
        )}
        <Conversation className="min-h-0">
          <ConversationContent className="px-3 py-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <UserMessage key={message.id} message={message} />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  isActive={loading && !message.finishedAt}
                  onViewArtifact={(a) => {
                    setArtifact(a);
                    setActiveTab("preview");
                  }}
                />
              ),
            )}
            {error && (
              <div className="mx-1 mt-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-2.5 text-sm leading-6 text-red-300/90 flex items-center justify-between gap-3">
                <span>{error}</span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="shrink-0 rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-500/15"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </ConversationContent>
        </Conversation>
        <div className="border-t border-border bg-background p-2">
          <StickyTodoPanel messages={messages} loading={loading} />
          {clarification && onClarificationSubmit && onClarificationDismiss && (
            <InlineClarificationPanel
              questions={clarification.questions}
              originalPrompt={clarification.prompt}
              onSubmit={onClarificationSubmit}
              onDismiss={onClarificationDismiss}
            />
          )}
          <PromptBox
            prompt={prompt}
            setPrompt={setPrompt}
            submit={submit}
            onStop={onStop}
            loading={loading}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            models={models}
            defaultModel={defaultModel}
            canSend={Boolean(selectedModel)}
            attachments={attachments}
            setAttachments={setAttachments}
            compact
            generationModes={generationModes}
            setGenerationModes={setGenerationModes}
            generationModels={generationModels}
            agentMode={agentMode}
            setAgentMode={setAgentMode}
          />
        </div>
      </aside>

      {/* Artifact viewer */}
      <ArtifactPanel
        artifact={artifact}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeFile={activeFile}
        activeFilePath={activeFilePath}
        setActiveFilePath={setActiveFilePath}
        setArtifact={setArtifact}
        generating={loading && !artifact}
      />
    </div>
  );
}
