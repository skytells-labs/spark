"use client";

import * as React from "react";
import { Circle, Plus, Search, Trash2 } from "lucide-react";
import type { ChatMessage, PersistedChat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatSearchCommand } from "./chat-search-command";

interface SidebarProps {
  hidden: boolean;
  messages: ChatMessage[];
  persistedChats: PersistedChat[];
  onNewChat: () => void;
  onDeleteChat?: (id: string) => void;
}

export function Sidebar({ hidden, messages, persistedChats, onNewChat, onDeleteChat }: SidebarProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const userChats = messages.filter((m) => m.role === "user");
  const visibleChats =
    userChats.length > 0
      ? userChats.map((c) => ({ id: c.id, prompt: c.content }))
      : persistedChats.map((c) => ({ id: c.id, prompt: c.prompt }));

  return (
    <>
      <ChatSearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        messages={messages}
        persistedChats={persistedChats}
        onNewChat={onNewChat}
      />

      <aside
        className={cn(
          "relative hidden w-[241px] shrink-0 border-r border-border bg-background p-2 md:block",
          hidden && "md:hidden",
        )}
      >
        {/* New chat */}
        <button
          onClick={onNewChat}
          className="flex h-[35px] w-full items-center justify-center rounded-md border border-border bg-secondary px-3 text-sm text-foreground transition hover:bg-accent"
        >
          <span className="flex-1 text-center">New Chat</span>
          <Plus className="size-3.5 text-muted-foreground" />
        </button>

        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="mt-1.5 flex h-[32px] w-full items-center gap-2 rounded-md border border-border bg-secondary/50 px-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left text-xs">Search chats…</span>
          <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⌘K</kbd>
        </button>

        {/* Chat list */}
        <div className="mt-4 text-[13px] text-muted-foreground">
          <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">
            Chats
          </div>
          {visibleChats.length === 0 ? (
            <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground/50">
              Persisted chats appear here after the first successful generation.
            </p>
          ) : (
            visibleChats.map((item) => (
              <div key={item.id} className="group relative mt-1.5">
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs">
                    <span className="flex-1 truncate text-destructive/80">Delete this chat?</span>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDeleteId(null);
                        onDeleteChat?.(item.id);
                      }}
                      className="shrink-0 rounded bg-destructive/20 px-1.5 py-0.5 text-destructive transition hover:bg-destructive/30"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <>
                    <a
                      href={`/~/${item.id}`}
                      className="flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-left transition hover:bg-accent hover:text-foreground"
                    >
                      <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                      <span className="truncate">{item.prompt}</span>
                    </a>
                    {onDeleteChat && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setConfirmDeleteId(item.id);
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/0 transition hover:bg-accent hover:text-destructive group-hover:text-muted-foreground/50"
                        title="Delete chat"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer links */}
        <div className="absolute bottom-3 left-0 hidden w-[241px] px-4 text-xs text-muted-foreground/50 md:block">
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            <a className="transition hover:text-foreground" href="https://learn.skytells.ai/docs" target="_blank" rel="noreferrer">
              Docs
            </a>
            <a className="transition hover:text-foreground" href="https://console.skytells.ai/settings/api-keys" target="_blank" rel="noreferrer">
              API keys
            </a>
            <a className="transition hover:text-foreground" href="https://console.skytells.ai/explore/models" target="_blank" rel="noreferrer">
              Models
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

