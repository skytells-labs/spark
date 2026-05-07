"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertTriangle,
  Server,
  Sparkles,
} from "lucide-react";
import type {
  AgentMode,
  ChatAttachment,
  DesignContext,
  HealthStatus,
  MediaGenerationModels,
  MediaGenerationModes,
  ModelOption,
} from "@/lib/types";
import { PromptBox } from "./prompt-box";
import { StatusPill } from "./status-pill";
import {
  ClarificationPanel,
  generateClarificationQuestions,
  type ClarificationQuestion,
} from "./clarification-panel";
import { buildDesignPrompt } from "./design-panel";

const recommendedPrompts = [
  "Build a Skytells SaaS app with users, credits, bundles, and billing-ready database schema",
  "Create a Skytells model usage dashboard with Postgres analytics and libSQL state",
  "Generate an AI workflow app connected to Skytells Orchestrator webhooks",
  "Build a deploy-ready Next.js app with Skytells models, database, and GitHub instructions",
];

interface HomeComposerProps {
  prompt: string;
  setPrompt: (value: string) => void;
  submit: (value?: string) => void;
  onStop?: () => void;
  loading: boolean;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  models: ModelOption[];
  defaultModel?: string | null;
  error: string | null;
  canSend: boolean;
  health: HealthStatus | null;
  generationModes: MediaGenerationModes;
  setGenerationModes: (next: MediaGenerationModes) => void;
  generationModels: MediaGenerationModels;
  attachments?: ChatAttachment[];
  setAttachments?: (next: ChatAttachment[]) => void;
  agentMode?: AgentMode;
  setAgentMode?: (mode: AgentMode) => void;
}

export function HomeComposer({
  prompt,
  setPrompt,
  submit,
  onStop,
  loading,
  selectedModel,
  setSelectedModel,
  models,
  defaultModel,
  error,
  canSend,
  health,
  generationModes,
  setGenerationModes,
  generationModels,
  attachments = [],
  setAttachments,
  agentMode: agentModeProp,
  setAgentMode: setAgentModeProp,
}: HomeComposerProps) {
  const [agentModeInternal, setAgentModeInternal] = React.useState<AgentMode>("agent");
  const agentMode = agentModeProp ?? agentModeInternal;
  const setAgentMode = setAgentModeProp ?? setAgentModeInternal;
  const [clarifying, setClarifying] = React.useState(false);
  const [clarificationPrompt, setClarificationPrompt] = React.useState("");
  const [clarificationQuestions, setClarificationQuestions] = React.useState<ClarificationQuestion[]>([]);
  const [designFigmaUrl, setDesignFigmaUrl] = React.useState("");

  // Intercept submit: plan mode shows clarification; design mode builds enriched prompt inline
  const handleSubmit = React.useCallback(
    (value?: string) => {
      const text = (value ?? prompt).trim();
      if (!text) return;

      if (agentMode === "plan") {
        const questions = generateClarificationQuestions(text);
        setClarificationPrompt(text);
        setClarificationQuestions(questions);
        setClarifying(true);
        return;
      }

      if (agentMode === "design") {
        const specAttachment = attachments[0]
          ? { filename: attachments[0].filename, mediaType: attachments[0].mediaType, dataUrl: attachments[0].dataUrl }
          : null;
        const enriched = buildDesignPrompt({
          description: text,
          figmaUrl: designFigmaUrl.trim() || undefined,
          specAttachment,
        } as DesignContext);
        void submit(enriched);
        return;
      }

      void submit(value);
    },
    [agentMode, attachments, designFigmaUrl, prompt, submit],
  );

  const handleClarificationSubmit = React.useCallback(
    (answers: Record<string, string>) => {
      setClarifying(false);
      const answerBlock = Object.entries(answers)
        .map(([, v]) => `- ${v}`)
        .join("\n");
      const enriched = `${clarificationPrompt}\n\nAdditional context from user:\n${answerBlock}`;
      void submit(enriched);
    },
    [clarificationPrompt, submit],
  );

  const handleClarificationDismiss = React.useCallback(() => {
    setClarifying(false);
    void submit(clarificationPrompt);
  }, [clarificationPrompt, submit]);

  const postgresReady = Boolean(health?.databases.postgres.ok);
  const libsqlReady = Boolean(health?.databases.libsql.ok);
  const redisReady = Boolean(health?.databases.redis.ok);
  const skytellsReady = Boolean(health?.skytells.ok);
  const saasEnabled = Boolean(health?.saas.enabled);
  const saasReady = Boolean(health?.saas.ok);
  const readyCount = [
    skytellsReady,
    postgresReady,
    libsqlReady,
    redisReady,
    !saasEnabled || saasReady,
  ].filter(Boolean).length;

  return (
    <div className="relative h-full overflow-y-auto">
      <ClarificationPanel
        open={clarifying}
        questions={clarificationQuestions}
        originalPrompt={clarificationPrompt}
        onSubmit={handleClarificationSubmit}
        onDismiss={handleClarificationDismiss}
      />
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="bf-enter-1 mb-5 inline-flex h-7 items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 text-[12px] text-muted-foreground">
              <Sparkles className="size-3.5 text-[#65adff]" />
              Skytells / AI
            </div>
            <h1 className="bf-enter-2 w-full text-balance text-2xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[54px]">
              <span className="skytells-shimmer-text">
                Build with Skytells.
              </span>
            </h1>
            <p className="bf-enter-3 mx-auto mt-5 max-w-[520px] text-pretty text-[14px] leading-[1.7] text-muted-foreground">
              Production infrastructure for AI-native apps — model inference, relational
              databases, usage metering, and one-click deploys, unified through a single
              coherent platform.
            </p>
          </div>

        <PromptBox
          prompt={prompt}
          setPrompt={setPrompt}
          submit={handleSubmit}
          onStop={onStop}
          loading={loading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={models}
          defaultModel={defaultModel}
          canSend={canSend}
          large
          generationModes={generationModes}
          setGenerationModes={setGenerationModes}
          generationModels={generationModels}
          agentMode={agentMode}
          setAgentMode={setAgentMode}
          attachments={attachments}
          setAttachments={setAttachments}
          designFigmaUrl={designFigmaUrl}
          setDesignFigmaUrl={setDesignFigmaUrl}
        />
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-card px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <StatusPill label="Skytells" ok={skytellsReady} />
            <StatusPill label="Postgres" ok={postgresReady} />
            <StatusPill label="libSQL" ok={libsqlReady} />
            <StatusPill label="Redis" ok={redisReady} />
            <StatusPill label="SaaS" ok={saasEnabled ? saasReady : true} muted={!saasEnabled} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
            <Server className="size-3.5" />
            {readyCount}/{saasEnabled ? 5 : 4} required
          </div>
        </div>

        {(!postgresReady || !libsqlReady || !redisReady) && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/76">
            <span>Deploy Postgres, libSQL, and Redis before generation — all three are required.</span>
            <a
              href="https://console.skytells.ai/projects"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md border border-amber-200/20 px-2 py-1 text-amber-100 transition hover:bg-amber-200/10"
            >
              Open Console
            </a>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {recommendedPrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPrompt(item);
                if (canSend) void submit(item);
              }}
              disabled={loading}
              className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-left text-[12px] leading-4 text-muted-foreground transition hover:border-[#0070f3]/45 hover:bg-[#0070f3]/[0.08] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground/50">
          <a
            href="https://console.skytells.ai/explore/models"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Models
          </a>
          <a
            href="https://orchestrator.skytells.ai"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Orchestrator
          </a>
          <Link
            href="/deploy"
            className="transition hover:text-foreground"
          >
            Deploy
          </Link>
          <a className="transition hover:text-foreground" href="https://learn.skytells.ai/docs" target="_blank" rel="noreferrer">
            Docs
          </a>
          <a className="transition hover:text-foreground" href="https://console.skytells.ai/settings/api-keys" target="_blank" rel="noreferrer">
            API keys
          </a>
          <a className="transition hover:text-foreground" href="https://console.skytells.ai/projects" target="_blank" rel="noreferrer">
            Databases
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
