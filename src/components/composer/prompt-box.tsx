"use client";

import * as React from "react";
import {
  Boxes,
  BotMessageSquare,
  ChevronDown,
  ImageIcon,
  Lightbulb,
  MessageCircle,
  Mic,
  Music2,
  Palette,
  Paperclip,
  Plus,
  Send,
  SlidersHorizontal,
  Square,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type {
  AgentMode,
  ChatAttachment,
  GenerationMode,
  MediaGenerationModels,
  MediaGenerationModes,
  ModelOption,
} from "@/lib/types";
import { ModelSelector } from "./model-selector";
import { cn } from "@/lib/utils";

interface PromptBoxProps {
  prompt: string;
  setPrompt: (value: string) => void;
  submit: (value?: string) => void;
  loading: boolean;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  models: ModelOption[];
  defaultModel?: string | null;
  canSend?: boolean;
  large?: boolean;
  compact?: boolean;
  attachments?: ChatAttachment[];
  setAttachments?: (next: ChatAttachment[]) => void;
  onStop?: () => void;
  generationModes: MediaGenerationModes;
  setGenerationModes: (next: MediaGenerationModes) => void;
  generationModels: MediaGenerationModels;
  agentMode?: AgentMode;
  setAgentMode?: (mode: AgentMode) => void;
  designFigmaUrl?: string;
  setDesignFigmaUrl?: (v: string) => void;
}

export function PromptBox({
  prompt,
  setPrompt,
  submit,
  loading,
  selectedModel,
  setSelectedModel,
  models,
  defaultModel,
  canSend,
  large,
  compact,
  attachments = [],
  setAttachments,
  onStop,
  generationModes,
  setGenerationModes,
  generationModels,
  agentMode = "agent",
  setAgentMode,
  designFigmaUrl = "",
  setDesignFigmaUrl,
}: PromptBoxProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const mediaMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modeMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = React.useState(false);
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);
  const modesInOrder: GenerationMode[] = ["auto", "ask", "off"];

  const agentModes: { value: AgentMode; label: string; desc: string; color: string; icon: React.ElementType }[] = [
    { value: "ask", label: "Ask", desc: "Read-only Q&A, never executes", color: "text-sky-300", icon: MessageCircle },
    { value: "plan", label: "Plan", desc: "Builds a plan, asks for clarification", color: "text-violet-300", icon: Lightbulb },
    { value: "agent", label: "Agent", desc: "Executes & asks when needed", color: "text-emerald-300", icon: BotMessageSquare },
    { value: "design", label: "Design", desc: "Generates a full design system", color: "text-pink-300", icon: Palette },
  ];

  const currentAgentMode = agentModes.find((m) => m.value === agentMode) ?? agentModes[2]!;

  const agentModeDropdown = (
    <AnimatePresence>
      {modeMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute bottom-full left-0 z-50 mb-2 w-[220px] overflow-hidden rounded-[10px] border border-white/12 bg-[#111] p-1.5 shadow-2xl"
        >
          {agentModes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setAgentMode?.(m.value);
                  setModeMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-white/[0.07]",
                  agentMode === m.value && "bg-white/[0.05]",
                )}
              >
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", agentMode === m.value ? m.color : "text-white/36")} />
                <div>
                  <div className={cn("text-xs font-medium", agentMode === m.value ? m.color : "text-white/70")}>
                    {m.label}
                  </div>
                  <div className="text-[11px] leading-4 text-white/36">{m.desc}</div>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  React.useEffect(() => {
    if (!mediaMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        mediaMenuRef.current &&
        !mediaMenuRef.current.contains(event.target as Node)
      ) {
        setMediaMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mediaMenuOpen]);

  React.useEffect(() => {
    if (!modeMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        modeMenuRef.current &&
        !modeMenuRef.current.contains(event.target as Node)
      ) {
        setModeMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [modeMenuOpen]);

  const cycleMode = React.useCallback(
    (key: keyof MediaGenerationModes) => {
      const current = generationModes[key];
      const index = modesInOrder.indexOf(current);
      const next = modesInOrder[(index + 1) % modesInOrder.length] ?? "auto";
      setGenerationModes({
        ...generationModes,
        [key]: next,
      });
    },
    [generationModes, setGenerationModes],
  );

  const modeTone = (mode: GenerationMode) => {
    if (mode === "auto") return "text-emerald-300";
    if (mode === "ask") return "text-amber-200";
    return "text-white/42";
  };

  const modeLabel = (mode: GenerationMode) => {
    if (mode === "auto") return "Auto";
    if (mode === "ask") return "Ask";
    return "Off";
  };

  const addFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !setAttachments) return;

      const incoming = Array.from(files);
      const converted = await Promise.all(
        incoming.map(
          (file) =>
            // FileReader uses callback-based API, wrapping in Promise is necessary
            // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
            new Promise<ChatAttachment | null>((resolve) => {
              const reader = new FileReader();
              // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
              reader.onload = () => {
                const dataUrl =
                  typeof reader.result === "string" ? reader.result : "";
                if (!dataUrl.startsWith("data:")) {
                  resolve(null);
                  return;
                }
                resolve({
                  dataUrl,
                  filename: file.name,
                  id: crypto.randomUUID(),
                  mediaType: file.type || "application/octet-stream",
                });
              };
              // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            }),
        ),
      );

      const next = [...attachments, ...converted.filter(Boolean)].slice(0, 8);
      setAttachments(next as ChatAttachment[]);
    },
    [attachments, setAttachments],
  );

  const mediaItems = [
    {
      key: "image" as const,
      label: "Images",
      icon: ImageIcon,
      model: generationModels.image,
    },
    {
      key: "video" as const,
      label: "Videos",
      icon: Video,
      model: generationModels.video,
    },
    {
      key: "audio" as const,
      label: "Audio",
      icon: Music2,
      model: generationModels.audio,
    },
  ];

  const mediaDropdown = mediaMenuOpen ? (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-[260px] overflow-hidden rounded-[10px] border border-white/12 bg-[#111] p-1.5 shadow-2xl">
      {mediaItems.map((item) => {
        const Icon = item.icon;
        const mode = generationModes[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => cycleMode(item.key)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-white/68 transition hover:bg-white/[0.07] hover:text-white"
            title={`${item.label}: ${modeLabel(mode)} using ${item.model}`}
          >
            <Icon className="size-4 text-white/46" />
            <span className="min-w-0 flex-1">
              <span className="block text-white/78">{item.label}</span>
              <span className="block truncate text-[11px] text-white/36">
                {item.model}
              </span>
            </span>
            <span className={cn("rounded bg-white/[0.06] px-1.5 py-0.5", modeTone(mode))}>
              {modeLabel(mode)}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  if (compact) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-[10px] border border-white/14 bg-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-white/24"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,application/pdf,text/*"
          onChange={(e) => {
            void addFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
        {attachments.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-white/[0.07] px-2.5 py-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex max-w-[180px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/58"
              >
                <Paperclip className="size-3 shrink-0" />
                <span className="truncate">{attachment.filename}</span>
                {setAttachments ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments(attachments.filter((item) => item.id !== attachment.id))
                    }
                    className="ml-0.5 rounded p-0.5 text-white/36 transition hover:bg-white/10 hover:text-white"
                    aria-label={`Remove ${attachment.filename}`}
                    title="Remove"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex min-h-11 items-center gap-1 px-2">
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/58 transition hover:bg-white/[0.07] hover:text-white"
            title="Attach"
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="size-4" />
          </button>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading) submit();
              }
            }}
            placeholder="Ask a follow-up..."
            rows={1}
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[13px] leading-5 text-white outline-none placeholder:text-white/42"
          />
          <div ref={mediaMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setMediaMenuOpen((value) => !value)}
              className="flex size-8 items-center justify-center rounded-md text-white/48 transition hover:bg-white/[0.07] hover:text-white"
              title="Media generation"
            >
              <SlidersHorizontal className="size-4" />
            </button>
            {mediaDropdown}
          </div>
          {setAgentMode && (
            <div ref={modeMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setModeMenuOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition hover:bg-white/[0.07]",
                  currentAgentMode.color,
                )}
                title={`Mode: ${currentAgentMode.label}`}
              >
                <currentAgentMode.icon className="size-3.5" />
                <span className="text-[11px]">{currentAgentMode.label}</span>
              </button>
              {agentModeDropdown}
            </div>
          )}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-white/48 transition hover:bg-white/[0.07] hover:text-white"
            title="Voice"
          >
            <Mic className="size-4" />
          </button>
          <button
            type="submit"
            onClick={(event) => {
              if (!loading) return;
              event.preventDefault();
              onStop?.();
            }}
            disabled={(!loading && !prompt.trim()) || canSend === false}
            className="flex size-8 items-center justify-center rounded-md bg-white text-black transition hover:bg-white/86 disabled:cursor-not-allowed disabled:opacity-35"
            title={loading ? "Stop" : "Send"}
          >
            {loading ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "rounded-[12px] border border-white/12 bg-[#111111] shadow-[0_10px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-white/20",
        large && "min-h-[128px]",
        compact && "rounded-[10px] bg-[#101010]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,application/pdf,text/*"
        onChange={(e) => {
          void addFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!loading) submit();
          }
        }}
        placeholder={
          agentMode === "design"
            ? "Describe your product's look & feel, brand, and components..."
            : compact
              ? "Ask a follow-up..."
              : "Ask Skytells to build..."
        }
        rows={large ? 2 : 1}
        className={cn(
          "w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-6 text-white outline-none placeholder:text-white/34",
          large ? "min-h-[76px]" : "min-h-[48px]",
        )}
      />
      {/* Design mode: inline Figma URL row */}
      <AnimatePresence>
        {agentMode === "design" && setDesignFigmaUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-t border-pink-500/10 bg-pink-500/[0.03] px-4 py-2.5">
              <svg className="size-3.5 shrink-0 text-pink-300/50" viewBox="0 0 38 57" fill="currentColor">
                <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" opacity=".9"/>
                <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0z" opacity=".6"/>
                <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" opacity=".6"/>
                <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" opacity=".6"/>
                <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" opacity=".6"/>
              </svg>
              <input
                type="url"
                value={designFigmaUrl}
                onChange={(e) => setDesignFigmaUrl(e.target.value)}
                placeholder="Figma URL (optional) — extracts real design tokens"
                className="flex-1 bg-transparent text-[13px] text-white/70 outline-none placeholder:text-white/28"
              />
              {designFigmaUrl && (
                <button
                  type="button"
                  onClick={() => setDesignFigmaUrl("")}
                  className="shrink-0 text-white/28 transition hover:text-white/60"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {attachments.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex max-w-[180px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/58"
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate">{attachment.filename}</span>
              {setAttachments ? (
                <button
                  type="button"
                  onClick={() =>
                    setAttachments(attachments.filter((item) => item.id !== attachment.id))
                  }
                  className="ml-0.5 rounded p-0.5 text-white/36 transition hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${attachment.filename}`}
                  title="Remove"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 border-t border-white/[0.07] px-3 py-2.5">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-white/54 transition hover:bg-white/[0.07] hover:text-white"
          title="Attach"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-white/54 transition hover:bg-white/[0.07] hover:text-white"
          title="Artifacts"
        >
          <Boxes className="size-4" />
        </button>
        <div ref={mediaMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setMediaMenuOpen((value) => !value)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white/54 transition hover:bg-white/[0.07] hover:text-white",
              mediaMenuOpen && "bg-white/[0.07] text-white",
            )}
            title="Media generation"
          >
            <SlidersHorizontal className="size-4" />
            <ChevronDown
              className={cn("size-3 transition-transform", mediaMenuOpen && "rotate-180")}
            />
          </button>
          {mediaDropdown}
        </div>
        {models.length ? (
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            defaultModel={defaultModel}
          />
        ) : (
          <span className="text-xs text-white/58">
            {compact ? "Skytells" : "Add API key to load models"}
          </span>
        )}
        {/* Agent mode picker — large prompt box only */}
        {!compact && setAgentMode ? (
          <div ref={modeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModeMenuOpen((v) => !v)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs transition hover:border-white/10 hover:bg-white/[0.07]",
                currentAgentMode.color,
              )}
              title="Agent mode"
            >
              {React.createElement(currentAgentMode.icon, { className: "size-3.5" })}
              {currentAgentMode.label}
              <ChevronDown className={cn("size-3 text-white/40 transition-transform", modeMenuOpen && "rotate-180")} />
            </button>
            {agentModeDropdown}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/62 transition hover:bg-white/[0.08] hover:text-white"
            title="Voice"
          >
            <Mic className="size-4" />
          </button>
          <button
            type="submit"
            onClick={(event) => {
              if (!loading) return;
              event.preventDefault();
              onStop?.();
            }}
            disabled={(!loading && !prompt.trim()) || canSend === false}
            className="flex size-8 items-center justify-center rounded-md bg-white text-black transition hover:bg-white/86 disabled:cursor-not-allowed disabled:opacity-35"
            title={loading ? "Stop" : "Send"}
          >
            {loading ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </form>
  );
}
