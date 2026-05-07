"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type {
  Artifact,
  AgentStep,
  ChatAttachment,
  ChatMessage,
  CodeFile,
  LoadedChat,
  MediaGenerationModels,
  MediaGenerationModes,
  ModelOption,
  RuntimeConfig,
  SkytellsUsage,
} from "@/lib/types";
import { readEventStream } from "@/lib/stream";
import { Workspace } from "./workspace";

interface ChatPageClientProps {
  chatId: string;
}

function hydrateHistoricalMessages(chat: LoadedChat): ChatMessage[] {
  const merged: ChatMessage[] = chat.messages.map((message, index) => {
    const metadata = message.metadata ?? null;
    const isTimeline =
      message.role === "assistant" &&
      (metadata?.phase === "timeline" || metadata?.phase === "timeline-note");
    const timelineNoteStep =
      metadata?.phase === "timeline-note" && message.content.trim()
        ? [
            {
              id: `hist-note-${index}`,
              type: "tool" as const,
              title: message.content.trim(),
              detail: "",
              status: "done" as const,
            },
          ]
        : undefined;

    return {
      id: `hist-${index}`,
      role: message.role,
      content: message.content,
      steps: isTimeline && metadata?.steps?.length ? metadata.steps : timelineNoteStep,
      startedAt: metadata?.startedAt,
      finishedAt: metadata?.finishedAt,
      usage: metadata?.usage,
      modelId: metadata?.modelId,
    };
  });

  if (chat.artifact) {
    for (let i = merged.length - 1; i >= 0; i -= 1) {
      if (merged[i].role === "assistant") {
        merged[i] = { ...merged[i], artifact: chat.artifact ?? undefined };
        break;
      }
    }
  }

  return merged;
}

export function ChatPageClient({ chatId }: ChatPageClientProps) {
  const router = useRouter();
  const [loadState, setLoadState] = React.useState<"loading" | "loaded" | "error">("loading");
  const [chat, setChat] = React.useState<LoadedChat | null>(null);
  const [liveMessages, setLiveMessages] = React.useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = React.useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [activeArtifact, setActiveArtifact] = React.useState<Artifact | null>(null);
  const [activeTab, setActiveTab] = React.useState<"preview" | "code" | "database" | "flow">("preview");
  const [activeFilePath, setActiveFilePath] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("");
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

  React.useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data: RuntimeConfig) => {
        if (data.mediaGeneration?.modes) {
          setGenerationModes(data.mediaGeneration.modes);
        }
        if (data.mediaGeneration?.models) {
          setGenerationModels(data.mediaGeneration.models);
        }
      })
      .catch(() => {
        // Keep local defaults when runtime config is unavailable.
      });
  }, []);

  React.useEffect(() => {
    fetch(`/api/chats/${chatId}`)
      .then((response) => response.json())
      .then((data: { chat?: LoadedChat }) => {
        if (!data.chat) {
          setLoadState("error");
          return;
        }

        setChat(data.chat);
        setSelectedModel(data.chat.model);
        setConversationHistory(
          data.chat.messages
            .filter((message) => {
              if (message.role === "user") return true;
              if (!message.content.trim()) return false;
              const phase = message.metadata?.phase;
              return phase !== "timeline" && phase !== "timeline-note";
            })
            .map((message) => ({ role: message.role, content: message.content })),
        );

        if (data.chat.artifact) {
          setActiveArtifact(data.chat.artifact);
          setActiveFilePath(data.chat.artifact.files[0]?.path ?? "");
        }

        setLoadState("loaded");
      })
      .catch(() => setLoadState("error"));
  }, [chatId]);

  const historicalMessages = React.useMemo(
    () => (chat ? hydrateHistoricalMessages(chat) : []),
    [chat],
  );

  const allMessages = React.useMemo(
    () => [...historicalMessages, ...liveMessages],
    [historicalMessages, liveMessages],
  );

  const activeFile = React.useMemo<CodeFile | null>(
    () =>
      activeArtifact?.files.find((file) => file.path === activeFilePath) ??
      activeArtifact?.files[0] ??
      null,
    [activeArtifact, activeFilePath],
  );

  const stopStreaming = React.useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  const submit = React.useCallback(async () => {
    const message = prompt.trim();
    if (!message || loading || !chat) return;

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
      setLiveMessages((prev) =>
        prev.map((item) =>
          item.id === id && !item.finishedAt ? { ...item, finishedAt } : item,
        ),
      );
    };

    const appendAssistantMessage = () => {
      const id = crypto.randomUUID();
      openAssistantMessageIds.add(id);
      setLiveMessages((prev) => [
        ...prev,
        { id, role: "assistant", content: "", steps: [], startedAt: Date.now() },
      ]);
      return id;
    };

    const upsertStepIntoMessage = (targetId: string, step: AgentStep) => {
      setLiveMessages((prev) =>
        prev.map((item) => {
          const withoutStep = (item.steps ?? []).filter(
            (existing) => existing.id !== step.id,
          );
          if (item.id !== targetId) {
            return item.steps?.length === withoutStep.length
              ? item
              : { ...item, steps: withoutStep };
          }
          return {
            ...item,
            steps: [...withoutStep, step],
          };
        }),
      );
    };

    setLiveMessages((prev) => [
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
          attachments: attachments.length ? attachments : undefined,
          model: selectedModel || chat.model,
          history: currentHistory,
          generation: generationModes,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message: string; errorId: string };
        } | null;
        throw new Error(
          payload?.error
            ? `${payload.error.errorId}: ${payload.error.message}`
            : "Request failed.",
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
          setLiveMessages((prev) =>
            prev.map((item) =>
              item.id === timelineMessageId
                ? {
                    ...item,
                    content: note,
                    steps: [],
                  }
                : item,
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
              setLiveMessages((prev) =>
                prev.map((item) =>
                  item.id === finalMessageId
                    ? {
                        ...item,
                        usage: usageSnapshot.usage,
                        modelId: usageSnapshot.modelId ?? selectedModel,
                      }
                    : item,
                ),
              );
            }
          }

          assembledContent += token;
          setLiveMessages((prev) =>
            prev.map((item) =>
              item.id === finalMessageId
                ? { ...item, content: item.content + token }
                : item,
            ),
          );
        },
        usage: (payload) => {
          const usage = (payload.usage || {}) as SkytellsUsage;
          if (!finalMessageId) {
            pendingUsage = { usage, modelId: payload.modelId };
            return;
          }
          setLiveMessages((prev) =>
            prev.map((item) =>
              item.id === finalMessageId
                ? {
                    ...item,
                    usage,
                    modelId: payload.modelId ?? selectedModel,
                  }
                : item,
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

          setLiveMessages((prev) =>
            prev.map((item) =>
              item.id === targetId ? { ...item, artifact } : item,
            ),
          );
        },
        error: (streamError) => {
          throw new Error(`${streamError.errorId}: ${streamError.message}`);
        },
        done: ({ chatId: newChatId }) => {
          window.history.replaceState(null, "", `/~/${newChatId}`);
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
      const messageText = caught instanceof Error ? caught.message : "Request failed.";
      setError(messageText);
      if (!timelineMessageId && !finalMessageId) {
        const errorMessageId = appendAssistantMessage();
        closeAssistantMessage(errorMessageId);
        setLiveMessages((prev) =>
          prev.map((item) =>
            item.id === errorMessageId ? { ...item, content: `**Error:** ${messageText}` } : item,
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
        setLiveMessages((prev) =>
          prev.map((item) =>
            item.id === openId && !item.finishedAt ? { ...item, finishedAt } : item,
          ),
        );
        openAssistantMessageIds.delete(openId);
      }
      setLoading(false);
    }
  }, [attachments, chat, conversationHistory, generationModes, loading, prompt, selectedModel]);

  if (loadState === "loading") {
    return (
      <div className="grid h-screen place-items-center bg-black text-white">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (loadState === "error" || !chat) {
    return (
      <div className="grid h-screen place-items-center bg-black text-white">
        <div className="text-center">
          <p className="text-white/60">Chat not found.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
          >
            New chat
          </button>
        </div>
      </div>
    );
  }

  const models: ModelOption[] = [
    {
      id: chat.model,
      name: chat.model,
      source: "saved-chat",
      type: "text",
    },
  ];

  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      <header className="flex h-10 items-center gap-3 border-b border-white/10 bg-black px-3">
        <button
          onClick={() => router.push("/")}
          className="rounded-md p-1 text-white/54 transition hover:bg-white/10 hover:text-white"
          title="Back to home"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-[13px] text-white/54">
          {chat.messages[0]?.content.slice(0, 60) || "Chat"}
        </span>
        <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-white/32">
          {chat.model}
        </span>
      </header>

      <div className="h-[calc(100vh-40px)] min-h-0">
        <Workspace
          messages={allMessages}
          prompt={prompt}
          setPrompt={setPrompt}
          submit={submit}
          onStop={stopStreaming}
          loading={loading}
          error={error}
          attachments={attachments}
          setAttachments={setAttachments}
          artifact={activeArtifact}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeFile={activeFile}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
          setArtifact={setActiveArtifact}
          selectedModel={selectedModel || chat.model}
          models={models}
          setSelectedModel={setSelectedModel}
          defaultModel={chat.model}
          generationModes={generationModes}
          setGenerationModes={setGenerationModes}
          generationModels={generationModels}
        />
      </div>
    </main>
  );
}
