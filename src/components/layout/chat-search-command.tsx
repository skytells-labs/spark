"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { Clock, MessageSquare, Plus, Search, X } from "lucide-react";
import type { ChatMessage, PersistedChat } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  persistedChats: PersistedChat[];
  onNewChat: () => void;
}

export function ChatSearchCommand({
  open,
  onOpenChange,
  messages,
  persistedChats,
  onNewChat,
}: ChatSearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  // Use a ref so the listener never needs to be re-registered on open/close
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Register once — never re-register unless onOpenChange identity changes
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!openRef.current);
      }
      if (e.key === "Escape" && openRef.current) onOpenChange(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]); // onOpenChange is setState — stable reference

  // Reset query when closed
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Build unified chat list (active session messages + persisted chats)
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => ({ id: m.id, prompt: m.content, isActive: true }));

  const persistedItems = persistedChats.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    isActive: false,
  }));

  const allChats = userMessages.length > 0 ? userMessages : persistedItems;

  const filtered = query.trim()
    ? allChats.filter((c) =>
        c.prompt.toLowerCase().includes(query.toLowerCase()),
      )
    : allChats;

  function handleSelect(chatId: string, isActive: boolean) {
    onOpenChange(false);
    if (isActive) return; // already in current session
    router.push(`/~/${chatId}`);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black/75 dark:bg-black/80"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="fixed left-1/2 top-[12vh] z-50 w-[min(540px,calc(100vw-32px))] -translate-x-1/2"
          >
            <Command
              className={cn(
                "overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
                "dark:bg-[#0a0a0a] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_64px_rgba(0,0,0,0.7)]",
              )}
              shouldFilter={false}
            >
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search chats…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
                {/* New chat action */}
                <Command.Group>
                  <Command.Item
                    onSelect={() => {
                      onOpenChange(false);
                      onNewChat();
                    }}
                    className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition hover:bg-accent aria-selected:bg-accent"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition group-hover:border-[#0070f3]/50 group-hover:bg-[#0070f3]/10 group-hover:text-[#65adff]">
                      <Plus className="size-3.5" />
                    </div>
                    <span className="font-medium">New chat</span>
                    <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      ⌘N
                    </kbd>
                  </Command.Item>
                </Command.Group>

                {/* Chat list */}
                {filtered.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {query ? "Results" : "Recent chats"}
                      </span>
                    }
                    className="mt-1"
                  >
                    {filtered.map((chat) => (
                      <Command.Item
                        key={chat.id}
                        value={chat.prompt}
                        onSelect={() => handleSelect(chat.id, chat.isActive)}
                        className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition hover:bg-accent aria-selected:bg-accent"
                      >
                        <div className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                          {chat.isActive ? (
                            <MessageSquare className="size-3.5 text-[#65adff]" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                        </div>
                        <span className="flex-1 truncate">{chat.prompt}</span>
                        {chat.isActive && (
                          <span className="ml-auto rounded-full bg-[#0070f3]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#65adff]">
                            active
                          </span>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {filtered.length === 0 && query && (
                  <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                    No chats matching "{query}"
                  </Command.Empty>
                )}

                {allChats.length === 0 && !query && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No chats yet. Start a conversation!
                  </p>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border px-1 py-0.5">↵</kbd>
                  open
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <kbd className="rounded border border-border px-1 py-0.5">⌘K</kbd>
                  toggle
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
