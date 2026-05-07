"use client";

import * as React from "react";
import type {
  Artifact,
  AgentMode,
  AgentStep,
  ChatAttachment,
  ChatMessage,
  HealthStatus,
  MediaGenerationModels,
  MediaGenerationModes,
  ModelOption,
  PersistedChat,
  RuntimeConfig,
  SkytellsUsage,
} from "@/lib/types";
import { readEventStream } from "@/lib/stream";
import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { HomeComposer } from "@/components/composer/home-composer";
import { buildDesignPrompt } from "@/components/composer/design-panel";
import {
  generateClarificationQuestions,
  type ClarificationQuestion,
} from "@/components/composer/clarification-panel";
import { Workspace } from "./workspace";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { cn } from "@/lib/utils";

export function HomeClient() {
  const [prompt, setPrompt] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [selectedModel, setSelectedModel] = React.useState("");
  const [defaultModel, setDefaultModel] = React.useState<string | null>(null);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [serverConfigured, setServerConfigured] = React.useState(false);
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [persistedChats, setPersistedChats] = React.useState<PersistedChat[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = React.useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [activeArtifact, setActiveArtifact] = React.useState<Artifact | null>(null);
  const [activeTab, setActiveTab] =
    React.useState<"preview" | "code" | "database" | "flow">("preview");
  const [activeFilePath, setActiveFilePath] = React.useState("app/page.tsx");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [generationModes, setGenerationModes] = React.useState<MediaGenerationModes>({
    image: "auto",
    video: "auto",
    audio: "auto",
  });
  const [generationModels, setGenerationModels] = React.useState<MediaGenerationModels>({
    image: "FLUX.2-pro",
    video: "mera",
    audio: "beatfusion-2.0",
  });
  const streamAbortRef = React.useRef<AbortController | null>(null);

  // ── Agent mode (lifted so workspace can also switch modes) ────────────
  const [agentMode, setAgentMode] = React.useState<AgentMode>("agent");

  // ── Workspace clarification state ─────────────────────────────────────
  const [pendingClarification, setPendingClarification] = React.useState<{
    prompt: string;
    questions: ClarificationQuestion[];
  } | null>(null);

  // Stable onboarding callbacks — never change identity
  const handleOnboardingClose = React.useCallback(() => {
    window.localStorage.setItem("skytells-onboarding-done", "1");
  }, []);

  const handleSetApiKey = React.useCallback((value: string) => {
    setApiKey(value);
    if (value) {
      window.localStorage.setItem("skytells-builder-key", value);
    } else {
      window.localStorage.removeItem("skytells-builder-key");
    }
  }, []);

  // ── Restore API key from localStorage ─────────────────────────────────

  React.useEffect(() => {
    const stored = window.localStorage.getItem("skytells-builder-key");
    if (stored) setApiKey(stored);
  }, []);

  // ── Load models and health on mount / apiKey change ───────────────────

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadModels() {
      const headers: HeadersInit = apiKey ? { "x-skytells-api-key": apiKey } : {};

      const [modelsResponse, healthResponse, configResponse] = await Promise.all([
        fetch("/api/models", { headers, signal: controller.signal }).catch(() => null),
        fetch("/api/health", { headers, signal: controller.signal }).catch(() => null),
        fetch("/api/config", { signal: controller.signal }).catch(() => null),
      ]);

      if (configResponse?.ok) {
        const configData = (await configResponse.json().catch(() => null)) as RuntimeConfig | null;
        if (configData?.mediaGeneration?.modes) {
          setGenerationModes(configData.mediaGeneration.modes);
        }
        if (configData?.mediaGeneration?.models) {
          setGenerationModels(configData.mediaGeneration.models);
        }
      }

      if (healthResponse) {
        const healthData = (await healthResponse.json()) as HealthStatus;
        setHealth(healthData);

        if (healthData.databases.postgres.ok) {
          const chatsResponse = await fetch("/api/chats", {
            signal: controller.signal,
          }).catch(() => null);
          if (chatsResponse?.ok) {
            const chatsData = (await chatsResponse.json()) as { chats: PersistedChat[] };
            setPersistedChats(chatsData.chats);
          }
        }
      }

      if (!modelsResponse) return;

      const data = (await modelsResponse.json()) as {
        configured?: boolean;
        models?: ModelOption[];
        message?: string;
        error?: { message: string; errorId: string };
        defaultModel?: string | null;
      };

      setServerConfigured(Boolean(data.configured));
      if (data.defaultModel) setDefaultModel(data.defaultModel);

      if (data.models?.length) {
        setModels(data.models);
        setSelectedModel((current) => {
          if (
            data.defaultModel &&
            data.models!.some((m) => m.id === data.defaultModel)
          ) {
            return data.defaultModel;
          }
          return data.models!.some((m) => m.id === current)
            ? current
            : data.models![0].id;
        });
      } else {
        setModels([]);
        setSelectedModel("");
      }

      if (data.error) {
        setError(`${data.error.errorId}: ${data.error.message}`);
      }
    }

    void loadModels();
    return () => controller.abort();
  }, [apiKey]);

  // ── Derived values ────────────────────────────────────────────────────

  const infrastructureReady = Boolean(
    health?.ok && selectedModel && (serverConfigured || apiKey.trim()),
  );

  const activeFile = React.useMemo(
    () =>
      activeArtifact?.files.find((f) => f.path === activeFilePath) ??
      activeArtifact?.files[0] ??
      null,
    [activeArtifact, activeFilePath],
  );

  const hasChat = messages.length > 0;

  const stopStreaming = React.useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────

  const submit = React.useCallback(
    async (value?: string) => {
      const message = (value ?? prompt).trim();
      if (!message || loading) return;

      if (!serverConfigured && !apiKey.trim()) {
        setError("Add a Skytells API key or set SKYTELLS_API_KEY on the server.");
        return;
      }
      if (!health?.databases.postgres.ok) {
        setError(
          "Deploy and configure Postgres, libSQL, and Redis before generating. All three databases are required.",
        );
        return;
      }
      if (!selectedModel) {
        setError("Load and select a Skytells text model before sending.");
        return;
      }

      setPrompt("");
      setLoading(true);
      setError(null);
      const streamController = new AbortController();
      streamAbortRef.current = streamController;

      const currentHistory = conversationHistory;
      let timelineMessageId: string | null = null;
      let finalMessageId: string | null = null;
      let pendingUsage: { usage: SkytellsUsage; modelId?: string } | null = null;
      let currentProgressNote = "";
      const openAssistantMessageIds = new Set<string>();

      const closeAssistantMessage = (id: string | null) => {
        if (!id) return;
        openAssistantMessageIds.delete(id);
        const finishedAt = Date.now();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id && !m.finishedAt ? { ...m, finishedAt } : m,
          ),
        );
      };

      const appendAssistantMessage = () => {
        const id = crypto.randomUUID();
        openAssistantMessageIds.add(id);
        setMessages((prev) => [
          ...prev,
          { id, role: "assistant", content: "", steps: [], startedAt: Date.now() },
        ]);
        return id;
      };

      const upsertStepIntoMessage = (targetId: string, step: AgentStep) => {
        setMessages((prev) =>
          prev.map((m) => {
            const withoutStep = (m.steps ?? []).filter((existing) => existing.id !== step.id);
            if (m.id !== targetId) {
              return m.steps?.length === withoutStep.length ? m : { ...m, steps: withoutStep };
            }
            return {
              ...m,
              steps: [...withoutStep, step],
            };
          }),
        );
      };

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          attachments: attachments.length ? attachments : undefined,
        },
      ]);
      setAttachments([]);

      let assembledContent = "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: streamController.signal,
          body: JSON.stringify({
            message,
            mode: agentMode,
            attachments: attachments.length ? attachments : undefined,
            model: selectedModel,
            apiKey: apiKey || undefined,
            history: currentHistory,
            generation: generationModes,
          }),
        });

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as {
            error?: { message: string; errorId: string; details?: unknown };
          } | null;
          throw new Error(
            data?.error
              ? `${data.error.errorId}: ${data.error.message}`
              : "Skytells request failed.",
          );
        }

        await readEventStream(response.body, {
          progress: ({ content }) => {
            if (finalMessageId) return;
            const note = content.trim();
            if (!note) return;

            if (timelineMessageId && currentProgressNote === note) {
              return;
            }

            closeAssistantMessage(timelineMessageId);
            timelineMessageId = appendAssistantMessage();
            currentProgressNote = note;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === timelineMessageId
                  ? {
                      ...m,
                      content: note,
                      steps: [],
                    }
                  : m,
              ),
            );
          },
          delta: ({ token }) => {
            if (!finalMessageId) {
              closeAssistantMessage(timelineMessageId);
              timelineMessageId = null;
              currentProgressNote = "";
              finalMessageId = appendAssistantMessage();

              if (pendingUsage) {
                const usageSnapshot = pendingUsage;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === finalMessageId
                      ? {
                          ...m,
                          usage: usageSnapshot.usage,
                          modelId: usageSnapshot.modelId ?? selectedModel,
                        }
                      : m,
                  ),
                );
              }
            }

            assembledContent += token;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalMessageId ? { ...m, content: m.content + token } : m,
              ),
            );
          },
          usage: (data) => {
            const usage = (data.usage || {}) as SkytellsUsage;
            if (!finalMessageId) {
              pendingUsage = { usage, modelId: data.modelId };
              return;
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalMessageId
                  ? { ...m, usage, modelId: data.modelId ?? selectedModel }
                  : m,
              ),
            );
          },
          step: (step) => {
            if (finalMessageId) return;

            if (!timelineMessageId) {
              timelineMessageId = appendAssistantMessage();
            }

            upsertStepIntoMessage(timelineMessageId, step);

          },
          artifact: ({ artifact }) => {
            if (!artifact) return;
            setActiveArtifact(artifact);
            if (artifact.flowDiagram) {
              setActiveTab("flow");
              const targetId = finalMessageId ?? timelineMessageId;
              if (targetId) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === targetId ? { ...m, artifact } : m)),
                );
              }
              return;
            }
            setActiveFilePath((current) =>
              artifact.files.some((file) => file.path === current)
                ? current
                : artifact.files[0]?.path ?? "",
            );
            setActiveTab((current) =>
              artifact.files.some((file) => /app\/.*page\.tsx$/.test(file.path))
                ? current
                : "code",
            );
            const targetId = finalMessageId ?? timelineMessageId;
            if (!targetId) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === targetId ? { ...m, artifact } : m)),
            );
          },
          error: (streamError) => {
            throw new Error(`${streamError.errorId}: ${streamError.message}`);
          },
          done: ({ chatId }) => {
            window.history.replaceState(null, "", `/~/${chatId}`);
          },
        });

        setConversationHistory((prev) => [
          ...prev,
          { role: "user" as const, content: message },
          { role: "assistant" as const, content: assembledContent },
        ]);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          setError(null);
          return;
        }
        const messageText =
          caught instanceof Error
            ? caught.message
            : "The request failed before Skytells Spark could respond.";
        setError(messageText);
        if (!timelineMessageId && !finalMessageId) {
          const errorMessageId = appendAssistantMessage();
          closeAssistantMessage(errorMessageId);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === errorMessageId ? { ...m, content: `**Error:** ${messageText}` } : m,
            ),
          );
        }
      } finally {
        if (streamAbortRef.current === streamController) {
          streamAbortRef.current = null;
        }
        closeAssistantMessage(timelineMessageId);
        closeAssistantMessage(finalMessageId);
        const finishedAt = Date.now();
        for (const openId of Array.from(openAssistantMessageIds)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === openId && !m.finishedAt ? { ...m, finishedAt } : m,
            ),
          );
          openAssistantMessageIds.delete(openId);
        }
        setLoading(false);
      }
    },
    [
      agentMode,
      apiKey,
      attachments,
      conversationHistory,
      generationModes,
      health,
      loading,
      prompt,
      selectedModel,
      serverConfigured,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────

  // Mode-aware submit for the workspace compact input
  const modeAwareSubmit = React.useCallback(
    (value?: string) => {
      const text = (value ?? prompt).trim();
      if (!text) return;

      if (agentMode === "plan") {
        const questions = generateClarificationQuestions(text);
        setPendingClarification({ prompt: text, questions });
        return;
      }

      if (agentMode === "design") {
        const enriched = buildDesignPrompt({ description: text });
        void submit(enriched);
        return;
      }

      void submit(value);
    },
    [agentMode, prompt, submit],
  );

  const handleWorkspaceClarificationSubmit = React.useCallback(
    (answers: Record<string, string>) => {
      if (!pendingClarification) return;
      const answerBlock = Object.entries(answers)
        .map(([, v]) => `- ${v}`)
        .join("\n");
      const enriched = `${pendingClarification.prompt}\n\nAdditional context from user:\n${answerBlock}`;
      setPendingClarification(null);
      void submit(enriched);
    },
    [pendingClarification, submit],
  );

  const handleWorkspaceClarificationDismiss = React.useCallback(() => {
    if (!pendingClarification) return;
    const saved = pendingClarification.prompt;
    setPendingClarification(null);
    void submit(saved);
  }, [pendingClarification, submit]);

  // Retry: remove the last assistant error message and re-submit the last user message
  const handleRetry = React.useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg || loading) return;
    setMessages((prev) => prev.filter((m) => m.id !== lastUserMsg.id));
    setError(null);
    void submit(lastUserMsg.content);
  }, [messages, loading, submit]);

  // ── Onboarding derived health shape ─────────────────────────────────
  const onboardingHealth = health
    ? {
        postgres: Boolean(health.databases.postgres.ok),
        libsql: Boolean(health.databases.libsql.ok),
        redis: Boolean(health.databases.redis.ok),
      }
    : null;

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      {/* Self-managing onboarding overlay — isolated state, no parent rerender */}
      <OnboardingOverlay
        apiKey={apiKey}
        onApiKeyChange={handleSetApiKey}
        serverConfigured={serverConfigured}
        health={onboardingHealth}
        onClose={handleOnboardingClose}
      />
      <TopBar
        apiKey={apiKey}
        setApiKey={handleSetApiKey}
        selectedModel={selectedModel}
        models={models}
        serverConfigured={serverConfigured}
      />

      <div className="flex h-[calc(100vh-40px)] min-h-0">
        <Sidebar
          hidden={hasChat}
          messages={messages}
          persistedChats={persistedChats}
          onNewChat={() => {
            stopStreaming();
            setMessages([]);
            setActiveArtifact(null);
            setConversationHistory([]);
          }}
          onDeleteChat={async (id) => {
            await fetch(`/api/chats/${id}`, { method: "DELETE" });
            setPersistedChats((prev) => prev.filter((c) => c.id !== id));
          }}
        />

        <section
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden border-t border-border",
            !hasChat &&
              "m-4 ml-2 rounded-[7px] border border-border bg-card",
          )}
        >
          {!hasChat ? (
            <HomeComposer
              prompt={prompt}
              setPrompt={setPrompt}
              submit={submit}
              onStop={stopStreaming}
              loading={loading}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              models={models}
              defaultModel={defaultModel}
              error={error}
              canSend={infrastructureReady}
              health={health}
              generationModes={generationModes}
              setGenerationModes={setGenerationModes}
              generationModels={generationModels}
              attachments={attachments}
              setAttachments={setAttachments}
              agentMode={agentMode}
              setAgentMode={setAgentMode}
            />
          ) : (
            <Workspace
              messages={messages}
              prompt={prompt}
              setPrompt={setPrompt}
              submit={modeAwareSubmit}
              onStop={stopStreaming}
              loading={loading}
              error={error}
              onRetry={handleRetry}
              attachments={attachments}
              setAttachments={setAttachments}
              artifact={activeArtifact}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              activeFile={activeFile}
              activeFilePath={activeFilePath}
              setActiveFilePath={setActiveFilePath}
              setArtifact={setActiveArtifact}
              selectedModel={selectedModel}
              models={models}
              setSelectedModel={setSelectedModel}
              defaultModel={defaultModel}
              generationModes={generationModes}
              setGenerationModes={setGenerationModes}
              generationModels={generationModels}
              agentMode={agentMode}
              setAgentMode={setAgentMode}
              clarification={pendingClarification}
              onClarificationSubmit={handleWorkspaceClarificationSubmit}
              onClarificationDismiss={handleWorkspaceClarificationDismiss}
              onBack={() => {
                stopStreaming();
                setMessages([]);
                setActiveArtifact(null);
                setConversationHistory([]);
              }}
            />
          )}
        </section>
      </div>
    </main>
  );
}
