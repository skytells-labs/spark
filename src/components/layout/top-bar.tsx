"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "@/components/layout/providers";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Code2,
  KeyRound,
  Moon,
  Pencil,
  PlugZap,
  Plus,
  RefreshCcw,
  Rocket,
  Server,
  Sparkles,
  Sun,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import type { ModelOption } from "@/lib/types";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { openOnboarding } from "@/components/onboarding/onboarding-overlay";

interface TopBarProps {
  apiKey: string;
  setApiKey: (value: string) => void;
  selectedModel: string;
  models: ModelOption[];
  serverConfigured: boolean;
}

export const TopBar = React.memo(function TopBar({ apiKey, setApiKey, selectedModel, models, serverConfigured }: TopBarProps) {
  const [open, setOpen] = React.useState(false);
  const [mcpOpen, setMcpOpen] = React.useState(false);
  const [mcpEnabled, setMcpEnabled] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const model = models.find((item) => item.id === selectedModel);

  React.useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: { mcpEnabled?: boolean }) => setMcpEnabled(Boolean(data.mcpEnabled)))
      .catch(() => setMcpEnabled(false));
  }, []);

  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-background px-2">
      <div className="flex items-center gap-2">
        <div className="flex h-7 items-center gap-2 border-r border-border pr-3">
          <Logo />
          <span className="hidden text-[13px] text-foreground sm:inline">Coder</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </div>
        <div className="hidden items-center gap-2 text-[13px] text-muted-foreground md:flex">
          <Circle
            className={cn(
              "size-3.5 fill-secondary text-muted-foreground/30",
              serverConfigured && "fill-emerald-950 text-emerald-500/60",
            )}
          />
          <span>{serverConfigured || apiKey ? "Skytells" : "No key"}</span>
          <span>/</span>
          <span className="text-foreground/80">{model?.name || selectedModel || "No text model"}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/deploy"
          className="hidden h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground transition hover:border-[#0070f3]/50 hover:bg-[#0070f3]/10 hover:text-foreground sm:inline-flex"
        >
          <Rocket className="size-3.5" />
          Deploy
        </Link>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border border-border bg-secondary p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Toggle theme"
          title="Toggle light/dark mode"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {mcpEnabled && (
          <button
            type="button"
            onClick={() => setMcpOpen((v) => !v)}
            className="rounded-full border border-border bg-secondary p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="MCP configuration"
            title="MCP configuration"
          >
            <PlugZap className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={openOnboarding}
          className="rounded-full border border-border bg-secondary p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Setup wizard"
          title="Setup wizard"
        >
          <Sparkles className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "rounded-full border p-1 transition",
            apiKey || serverConfigured
              ? "border-[#0070f3]/60 bg-[#0070f3]/10 text-[#65adff]"
              : "border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-label="Skytells API key"
          title="Skytells API key"
        >
          <KeyRound className="size-4" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute right-3 top-12 z-50 w-[min(420px,calc(100vw-24px))] rounded-[8px] border border-border bg-card p-3 shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <label className="text-xs font-medium text-muted-foreground">Skytells API key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              type="password"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-[#0070f3] focus:ring-1 focus:ring-[#0070f3]/30"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <a className="hover:text-foreground" href="https://console.skytells.ai/settings/api-keys" target="_blank" rel="noreferrer">
                API keys
              </a>
              <a className="hover:text-foreground" href="https://console.skytells.ai/explore/models" target="_blank" rel="noreferrer">
                Models
              </a>
              <a className="hover:text-foreground" href="https://learn.skytells.ai/docs" target="_blank" rel="noreferrer">
                Docs
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mcpOpen && (
          <McpManager onClose={() => setMcpOpen(false)} />
        )}
      </AnimatePresence>
    </header>
  );
});

type McpRow = {
  id: string;
  name: string;
  config: unknown;
  createdAt: string;
  status?: "ready" | "invalid";
  validationMessage?: string;
  transport?: "stdio" | "http";
  tools?: string[];
};

const emptyMcpConfig = `{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "tools": [
    { "name": "read_file" },
    { "name": "list_directory" }
  ]
}`;

function McpManager({ onClose }: { onClose: () => void }) {
  const [mcps, setMcps] = React.useState<McpRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<McpRow | null>(null);
  const [name, setName] = React.useState("");
  const [configText, setConfigText] = React.useState(emptyMcpConfig);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<McpRow | null>(null);

  const validation = React.useMemo(() => validateMcpForm(name, configText), [name, configText]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/mcps").catch(() => null);
    if (!res?.ok) {
      setError("Could not load MCP configs from the backend.");
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => null)) as { mcps?: McpRow[] } | null;
    const rows = data?.mcps ?? [];
    setMcps(rows);
    setSelected((current) => {
      if (!rows.length) return null;
      return rows.find((row) => row.id === current?.id) ?? rows[0];
    });
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const openAddDialog = () => {
    setEditing(null);
    setName("");
    setConfigText(emptyMcpConfig);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (row: McpRow) => {
    setEditing(row);
    setName(row.name);
    setConfigText(JSON.stringify(row.config, null, 2));
    setError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    setError(null);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSaving(true);
    const parsed = JSON.parse(configText) as unknown;
    if (editing) {
      await fetch(`/api/mcps?id=${encodeURIComponent(editing.id)}`, { method: "DELETE" }).catch(
        () => null,
      );
    }

    const res = await fetch("/api/mcps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), config: parsed }),
    }).catch(() => null);

    if (!res?.ok) {
      const payload = (await res?.json().catch(() => null)) as {
        error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      } | null;
      const fieldErrors = payload?.error?.details?.fieldErrors;
      setError(
        fieldErrors?.config?.[0] ||
          fieldErrors?.name?.[0] ||
          payload?.error?.message ||
          "Failed to save MCP config.",
      );
      setSaving(false);
      return;
    }

    setDialogOpen(false);
    setSaving(false);
    await refresh();
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/mcps?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    await refresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className="absolute right-3 top-12 z-50 w-[min(780px,calc(100vw-24px))] overflow-hidden rounded-[8px] border border-border bg-card shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <PlugZap className="size-4 text-[#65adff]" />
          <div>
            <h2 className="text-sm font-medium text-foreground/84">MCP integrations</h2>
            <p className="text-[11px] text-muted-foreground">Live configs from /api/mcps</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <RefreshCcw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAddDialog}
            className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background transition hover:opacity-90"
          >
            <Plus className="size-3.5" />
            Add MCP
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Close MCP manager"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid max-h-[min(560px,calc(100vh-90px))] min-h-[340px] grid-cols-[minmax(0,1fr)_260px] overflow-hidden max-md:grid-cols-1">
        <div className="min-w-0 overflow-auto">
          <div className="grid grid-cols-[1.2fr_90px_90px_1fr_96px] border-b border-border px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground/50 max-md:hidden">
            <span>Name</span>
            <span>Status</span>
            <span>Transport</span>
            <span>Tools</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
              <RefreshCcw className="mr-2 size-4 animate-spin" />
              Loading MCP configs...
            </div>
          ) : mcps.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center px-6 text-center">
              <Server className="mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground/80">No MCP integrations yet</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Add a stdio command or HTTP MCP endpoint. Saved configs are injected into the agent runtime on the next chat request.
              </p>
              <button
                type="button"
                onClick={openAddDialog}
                className="mt-4 flex h-8 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background"
              >
                <Plus className="size-3.5" />
                Add MCP
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {mcps.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={cn(
                    "grid w-full grid-cols-[1.2fr_90px_90px_1fr_86px] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-accent max-md:grid-cols-1 max-md:gap-2",
                    selected?.id === row.id && "bg-accent",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground/80">{row.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={row.status ?? "invalid"} />
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Server className="size-3.5" />
                    {row.transport ?? "stdio"}
                  </span>
                  <ToolChips tools={row.tools ?? []} compact />
                  <span className="flex items-center justify-end gap-1 max-md:justify-start">
                    <IconButton
                      label="Edit MCP"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDialog(row);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </IconButton>
                    <IconButton
                      label="Delete MCP"
                      disabled={deletingId === row.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void remove(row.id);
                      }}
                    >
                      {deletingId === row.id ? (
                        <RefreshCcw className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </IconButton>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 border-l border-border bg-secondary/30 p-3 max-md:hidden">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-sm font-medium text-foreground/80">{selected.name}</h3>
                  <StatusPill status={selected.status ?? "invalid"} />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {selected.validationMessage || "Config loaded from backend."}
                </p>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wrench className="size-3.5" />
                  Tools
                </p>
                <ToolChips tools={selected.tools ?? []} />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Code2 className="size-3.5" />
                  Config
                </p>
                <pre className="max-h-[300px] overflow-auto rounded-md border border-border bg-background p-2.5 text-[11px] leading-5 text-foreground/60">
                  {JSON.stringify(selected.config, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
              Select an MCP to inspect config and tools.
            </div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {dialogOpen && (
          <McpEditorDialog
            configText={configText}
            editing={editing}
            error={error}
            name={name}
            saving={saving}
            validation={validation}
            onClose={() => setDialogOpen(false)}
            onConfigText={setConfigText}
            onName={setName}
            onSave={() => void save()}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function McpEditorDialog({
  configText,
  editing,
  error,
  name,
  saving,
  validation,
  onClose,
  onConfigText,
  onName,
  onSave,
}: {
  configText: string;
  editing: McpRow | null;
  error: string | null;
  name: string;
  saving: boolean;
  validation: { ok: boolean; message: string; tools: string[]; transport: "stdio" | "http" | "unknown" };
  onClose: () => void;
  onConfigText: (value: string) => void;
  onName: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-[8px] border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div>
            <h3 className="text-sm font-medium text-foreground/84">
              {editing ? "Edit MCP" : "Add MCP"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Validate stdio or HTTP MCP config before saving.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3 p-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Name</span>
            <input
              value={name}
              onChange={(event) => onName(event.target.value)}
              placeholder="e.g. filesystem"
              className="h-9 rounded-md border border-border bg-background px-2.5 text-[16px] text-foreground outline-none transition placeholder:text-muted-foreground/40 focus:border-[#0070f3] focus:ring-1 focus:ring-[#0070f3]/30 md:text-[12px]"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Config JSON</span>
            <textarea
              value={configText}
              onChange={(event) => onConfigText(event.target.value)}
              rows={7}
              spellCheck={false}
              className="min-h-[150px] resize-none rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[12px] leading-5 text-foreground/80 outline-none transition placeholder:text-muted-foreground/40 focus:border-[#0070f3] focus:ring-1 focus:ring-[#0070f3]/30"
            />
          </label>

          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px]",
              validation.ok
                ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200"
                : "border-amber-500/20 bg-amber-500/[0.06] text-amber-200",
            )}
          >
            {validation.ok ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <div>
              <p>{validation.message}</p>
              <p className="mt-0.5 text-muted-foreground/60">
                Transport: {validation.transport}. Tools detected:{" "}
                {validation.tools.length ? validation.tools.join(", ") : "none declared"}.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!validation.ok || saving}
            onClick={onSave}
            className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <RefreshCcw className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save MCP
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function validateMcpForm(name: string, configText: string) {
  if (!name.trim()) {
    return { ok: false, message: "Enter a name to validate this MCP.", tools: [] as string[], transport: "unknown" as const };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name.trim())) {
    return {
      ok: false,
      message: "Name can only contain letters, numbers, dots, dashes, or underscores.",
      tools: [] as string[],
      transport: "unknown" as const,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    return { ok: false, message: "Config must be valid JSON.", tools: [] as string[], transport: "unknown" as const };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "Config must be a JSON object.", tools: [] as string[], transport: "unknown" as const };
  }

  const config = parsed as Record<string, unknown>;
  const hasCommand = typeof config.command === "string" && config.command.trim().length > 0;
  const hasUrl = typeof config.url === "string" && /^https?:\/\//.test(config.url);
  const tools = extractTools(config);

  if (!hasCommand && !hasUrl) {
    return {
      ok: false,
      message: "Add either a stdio command or an http(s) url.",
      tools,
      transport: "unknown" as const,
    };
  }
  if ("args" in config && !Array.isArray(config.args)) {
    return { ok: false, message: "args must be an array.", tools, transport: hasUrl ? "http" as const : "stdio" as const };
  }
  if ("tools" in config && !Array.isArray(config.tools)) {
    return { ok: false, message: "tools must be an array.", tools, transport: hasUrl ? "http" as const : "stdio" as const };
  }

  return {
    ok: true,
    message: "Config is valid and ready to save.",
    tools,
    transport: hasUrl ? "http" as const : "stdio" as const,
  };
}

function extractTools(config: Record<string, unknown>) {
  if (!Array.isArray(config.tools)) return [];
  return config.tools
    .map((tool) => {
      if (typeof tool === "string") return tool;
      if (tool && typeof tool === "object") {
        const value = tool as Record<string, unknown>;
        return typeof value.name === "string" ? value.name : "";
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 12);
}

function StatusPill({ status }: { status: "ready" | "invalid" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
        status === "ready"
          ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
          : "border-amber-500/20 bg-amber-500/[0.07] text-amber-300",
      )}
    >
      {status === "ready" ? <CheckCircle2 className="size-3" /> : <Clock3 className="size-3" />}
      {status}
    </span>
  );
}

function ToolChips({ tools, compact = false }: { tools: string[]; compact?: boolean }) {
  if (!tools.length) {
    return <span className="text-xs text-muted-foreground/50">No tools declared</span>;
  }

  const visible = compact ? tools.slice(0, 3) : tools;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {visible.map((tool) => (
        <span
          key={tool}
          className="max-w-[150px] truncate rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
        >
          {tool}
        </span>
      ))}
      {compact && tools.length > visible.length ? (
        <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground/50">
          +{tools.length - visible.length}
        </span>
      ) : null}
    </div>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
