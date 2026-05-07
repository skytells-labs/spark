"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Palette,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type { DesignContext } from "@/lib/types";
import type { FigmaExtract } from "@/app/api/figma/extract/route";
import { cn } from "@/lib/utils";

interface DesignPanelProps {
  open: boolean;
  onSubmit: (ctx: DesignContext) => void;
  onDismiss: () => void;
}

const CAPABILITIES = [
  { icon: Palette, label: "Design Tokens" },
  { icon: Layers, label: "Component Library" },
  { icon: Zap, label: "Tailwind Config" },
  { icon: Sparkles, label: "Dark Mode" },
  { icon: FileText, label: "Storybook" },
] as const;

type FigmaState =
  | { status: "idle" }
  | { status: "extracting" }
  | { status: "done"; data: FigmaExtract }
  | { status: "error"; message: string }
  | { status: "no-token" };

export function DesignPanel({ open, onSubmit, onDismiss }: DesignPanelProps) {
  const [description, setDescription] = React.useState("");
  const [figmaUrl, setFigmaUrl] = React.useState("");
  const [figmaToken, setFigmaToken] = React.useState("");
  const [showTokenField, setShowTokenField] = React.useState(false);
  const [figmaState, setFigmaState] = React.useState<FigmaState>({ status: "idle" });
  const [attachment, setAttachment] = React.useState<{
    filename: string;
    mediaType: string;
    dataUrl: string;
  } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setDescription("");
      setFigmaUrl("");
      setFigmaToken("");
      setFigmaState({ status: "idle" });
      setAttachment(null);
      setShowTokenField(false);
    }
  }, [open]);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachment({
        filename: file.name,
        mediaType: file.type,
        dataUrl: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  async function extractFigma() {
    if (!figmaUrl.trim()) return;
    setFigmaState({ status: "extracting" });
    try {
      const res = await fetch("/api/figma/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figmaUrl: figmaUrl.trim(),
          figmaToken: figmaToken.trim() || undefined,
        }),
      });
      const json = (await res.json()) as
        | { extract: FigmaExtract }
        | { error: string; errorId?: string };

      if (!res.ok) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
        if ("errorId" in json && json.errorId === "MISSING_FIGMA_TOKEN") {
          setShowTokenField(true);
          setFigmaState({ status: "no-token" });
        } else {
          setFigmaState({ status: "error", message: msg });
        }
        return;
      }
      if ("extract" in json) {
        setFigmaState({ status: "done", data: json.extract });
      }
    } catch (err) {
      setFigmaState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  const canSubmit = description.trim().length > 0;
  const extracted = figmaState.status === "done" ? figmaState.data : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      description: description.trim(),
      figmaUrl: figmaUrl.trim() || undefined,
      figmaExtract: extracted ?? undefined,
      figmaToken: figmaToken.trim() || undefined,
      specAttachment: attachment ?? null,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-pink-500/20 bg-[#0d0d0d] shadow-2xl"
          >
            {/* Gradient top bar */}
            <div className="h-[2px] w-full bg-gradient-to-r from-pink-500/60 via-rose-400/80 to-fuchsia-500/60" />

            <div className="px-6 pb-6 pt-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/30 to-fuchsia-500/30">
                      <Palette className="size-3.5 text-pink-300" />
                    </div>
                    <span className="text-[13px] font-semibold text-white/90">
                      Design System Generator
                    </span>
                    <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-medium text-pink-300">
                      DESIGN MODE
                    </span>
                  </div>
                  <p className="text-[12px] leading-5 text-white/40">
                    Describe your product, optionally link a Figma file to extract real tokens, or
                    upload a spec. Generates a complete production design system.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="shrink-0 rounded-md p-1.5 text-white/30 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Capability badges */}
              <div className="mt-4 flex flex-wrap gap-2">
                {CAPABILITIES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/46"
                  >
                    <Icon className="size-3 text-pink-300/70" />
                    {label}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                {/* Description */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Describe your design / product{" "}
                    <span className="normal-case text-pink-400">*</span>
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. A SaaS dashboard with dark navy base, teal accent, Inter font, rounded cards and a data-heavy analytics feel..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm leading-6 text-white/88 placeholder-white/22 outline-none transition focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20"
                  />
                </label>

                {/* Figma URL + Extract */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Figma URL{" "}
                    <span className="normal-case text-white/28">(optional — extracts real tokens)</span>
                  </span>
                  <div className="flex gap-2">
                    <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition focus-within:border-pink-500/40 focus-within:ring-1 focus-within:ring-pink-500/20">
                      <svg className="size-3.5 shrink-0 text-white/30" viewBox="0 0 38 57" fill="currentColor">
                        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" opacity=".9"/>
                        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0z" opacity=".6"/>
                        <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" opacity=".6"/>
                        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" opacity=".6"/>
                        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" opacity=".6"/>
                      </svg>
                      <input
                        type="url"
                        value={figmaUrl}
                        onChange={(e) => {
                          setFigmaUrl(e.target.value);
                          setFigmaState({ status: "idle" });
                        }}
                        placeholder="https://www.figma.com/design/..."
                        className="flex-1 bg-transparent text-sm text-white/88 placeholder-white/22 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={extractFigma}
                      disabled={!figmaUrl.trim() || figmaState.status === "extracting"}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3.5 py-2.5 text-xs font-medium text-pink-300 transition hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {figmaState.status === "extracting" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : figmaState.status === "done" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      {figmaState.status === "extracting"
                        ? "Extracting…"
                        : figmaState.status === "done"
                          ? "Re-extract"
                          : "Extract tokens"}
                    </button>
                  </div>

                  {/* No-token prompt */}
                  <AnimatePresence>
                    {(figmaState.status === "no-token" || showTokenField) && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3"
                      >
                        <div className="flex items-center gap-2 text-xs text-amber-200/80">
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
                          No server-side Figma token found. Paste your personal Figma access token
                          below, or skip extraction and describe your design manually.
                        </div>
                        <input
                          type="password"
                          value={figmaToken}
                          onChange={(e) => setFigmaToken(e.target.value)}
                          placeholder="figd_xxxxxxxxxxxx"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder-white/22 outline-none transition focus:border-amber-400/40"
                        />
                        <p className="text-[11px] text-white/30">
                          Get your token at figma.com → Settings → Personal access tokens. Never stored.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Extraction error */}
                  <AnimatePresence>
                    {figmaState.status === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300/80"
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {figmaState.message}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Extraction success summary */}
                  <AnimatePresence>
                    {figmaState.status === "done" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3"
                      >
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
                          <CheckCircle2 className="size-3.5" />
                          Extracted from &ldquo;{figmaState.data.fileName}&rdquo;
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/46">
                          <span>{figmaState.data.colors.length} colours</span>
                          <span>{figmaState.data.textStyles.length} text styles</span>
                          <span>{figmaState.data.effects.length} shadows</span>
                          <span>{figmaState.data.namedStyles.length} named styles</span>
                        </div>
                        {figmaState.data.colors.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {figmaState.data.colors.slice(0, 16).map((c) => (
                              <div
                                key={c.name + c.hex}
                                title={`${c.name}: ${c.hex}`}
                                className="size-5 rounded-md border border-white/10 shadow"
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                            {figmaState.data.colors.length > 16 && (
                              <span className="self-center text-[10px] text-white/30">
                                +{figmaState.data.colors.length - 16} more
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* PDF / spec upload */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Design spec / screenshot{" "}
                    <span className="normal-case text-white/28">(optional)</span>
                  </span>
                  {attachment ? (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                      <FileText className="size-4 shrink-0 text-pink-300/70" />
                      <span className="flex-1 truncate text-sm text-white/72">
                        {attachment.filename}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="shrink-0 rounded p-1 text-white/30 transition hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed py-5 text-center transition",
                        dragging
                          ? "border-pink-500/50 bg-pink-500/[0.06]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                      )}
                    >
                      <Upload className="size-5 text-white/24" />
                      <span className="text-xs text-white/36">
                        Drop a PDF, PNG, or JPG spec — or click to browse
                      </span>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleFile}
                  />
                </label>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-lg px-3.5 py-2 text-sm text-white/46 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-pink-500/20 transition hover:from-pink-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles className="size-3.5" />
                    Generate Design System
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Build the enriched mega-prompt sent to the AI agent */
export function buildDesignPrompt(ctx: DesignContext): string {
  const lines: string[] = [
    "# Design System Generation Request",
    "",
    `**Product description:** ${ctx.description}`,
  ];

  // ── Real Figma data ──────────────────────────────────────────────────────
  if (ctx.figmaExtract) {
    const f = ctx.figmaExtract;
    lines.push("", `## Extracted Figma Data — "${f.fileName}"`, "");

    if (f.colors.length > 0) {
      lines.push(
        "### Color Tokens (use EXACTLY these values — do not invent new ones)",
        ...f.colors.map((c) => `- \`${c.name}\`: ${c.hex}`),
        "",
      );
    }

    if (f.textStyles.length > 0) {
      lines.push(
        "### Typography Styles (use EXACTLY these values)",
        ...f.textStyles.map(
          (t) =>
            `- \`${t.name}\`: font-family: ${t.fontFamily ?? "inherit"}, ` +
            `weight: ${t.fontWeight ?? "normal"}, ` +
            `size: ${t.fontSize ?? "inherit"}px, ` +
            `line-height: ${t.lineHeightPx ?? "normal"}px, ` +
            `letter-spacing: ${t.letterSpacing ?? 0}px`,
        ),
        "",
      );
    }

    if (f.effects.length > 0) {
      lines.push(
        "### Shadow Effects (map these to the shadow scale)",
        ...f.effects.flatMap((e) =>
          e.shadows.map(
            (s) =>
              `- \`${e.name}\` (${s.type}): color ${s.color ?? "inherit"}, ` +
              `blur ${s.radius ?? 0}px, spread ${s.spread ?? 0}px, ` +
              `offset ${s.offsetX ?? 0}px ${s.offsetY ?? 0}px`,
          ),
        ),
        "",
      );
    }

    if (f.namedStyles.length > 0) {
      lines.push(
        "### All Named Styles (reference for semantic mapping)",
        ...f.namedStyles.map(
          (s) => `- [${s.type}] ${s.name}${s.description ? ": " + s.description : ""}`,
        ),
        "",
      );
    }
  } else if (ctx.figmaUrl) {
    lines.push(
      "",
      `**Figma URL:** ${ctx.figmaUrl}`,
      "The Figma file could not be pre-extracted. Infer design intent from the URL name/slug and the product description.",
      "",
    );
  }

  if (ctx.specAttachment) {
    lines.push(
      `**Spec file attached:** \`${ctx.specAttachment.filename}\``,
      "Analyse the attached visual to extract brand colors, typographic scale, component patterns, spacing rhythm, and layout grid.",
      "",
    );
  }

  lines.push(
    "---",
    "",
    "## What you MUST generate",
    "",
    "Produce a complete, production-ready **design system** with ALL of the following — **do not skip any section**:",
    "",
    "### 1. `src/design-system/tokens.ts`",
    "- Export a `tokens` object with:",
    "  - `colors`: brand, neutral (50–950), semantic (success/warning/danger/info/muted) — use Figma-extracted hex values where available",
    "  - `typography`: fontFamily (heading + body), fontSizes (xs through 9xl), fontWeights, lineHeights, letterSpacings — use Figma text styles where available",
    "  - `spacing`: 4-px base grid (0–96)",
    "  - `radii`: none, sm, md, lg, xl, 2xl, full",
    "  - `shadows`: sm, md, lg, xl, 2xl, inner — use Figma shadow effects where available",
    "  - `zIndex`: auto, 0, 10, 20, 30, 40, 50",
    "  - `motion`: durations (75ms–700ms), easings (easeIn, easeOut, easeInOut, spring)",
    "",
    "### 2. `tailwind.config.ts`",
    "- Full `theme.extend` with every token from step 1",
    "- CSS variable references: `var(--color-brand-500)` etc.",
    "- Dark mode: `class` strategy",
    "- Content paths set",
    "",
    "### 3. `src/design-system/globals.css`",
    "- All color tokens as CSS custom properties on `:root`",
    "- `.dark {}` overrides for every token",
    "- `@layer base` with typography defaults",
    "",
    "### 4. Component Library (`src/design-system/components/`)",
    "Use `cva` (class-variance-authority) + `tailwind-merge`. Forward refs. Full JSDoc.",
    "Build **every** component below with variants, sizes, and disabled/loading/error states:",
    "",
    "**Primitives**",
    "- `Button` — variants: solid, outline, ghost, link, destructive; sizes: xs, sm, md, lg",
    "- `IconButton` — same variants",
    "- `Badge` — variants: default, success, warning, danger, info",
    "- `Spinner` — sizes: sm, md, lg",
    "- `Divider` — horizontal + vertical",
    "",
    "**Form**",
    "- `Input` — with left/right adornments, error state, helper text",
    "- `Textarea` — auto-resize option",
    "- `Select` — custom styled + accessible",
    "- `Checkbox`, `Radio`, `Switch`",
    "- `Slider` — min/max/step/value",
    "- `Label`, `FormField`, `FormMessage`",
    "",
    "**Feedback**",
    "- `Alert` — variants: info, success, warning, error",
    "- `Progress` — determinate + indeterminate",
    "- `Skeleton` — block + text variants",
    "- `Toast` (Sonner-compatible wrapper)",
    "",
    "**Layout**",
    "- `Card`, `CardHeader`, `CardContent`, `CardFooter`",
    "- `Dialog` / `Modal` — with backdrop, focus trap, keyboard close",
    "- `Drawer` — left/right/bottom variants",
    "- `Popover`, `Tooltip`",
    "- `Sheet` (mobile drawer)",
    "",
    "**Navigation**",
    "- `Navbar` — responsive, with logo slot + nav items + CTA slot",
    "- `Sidebar` — collapsible, with section groups",
    "- `Breadcrumb`",
    "- `Tabs` — underline + pill variants",
    "- `Pagination`",
    "",
    "**Data Display**",
    "- `Table` — sortable headers, striped, bordered variants",
    "- `Avatar`, `AvatarGroup`",
    "- `Tag` / `Chip` — with close button",
    "",
    "**Typography**",
    "- `Heading` (h1–h6 polymorphic)",
    "- `Text` (p, span, etc.)",
    "- `Code` (inline + block)",
    "",
    "### 5. `src/design-system/index.ts`",
    "- Barrel export of all components and tokens",
    "- Must be publishable as an npm package with `exports` pointing here",
    "",
    "### 6. `src/app/design-system/page.tsx`",
    "- Scrollable live showcase page with every component rendered in all variants",
    "- Color palette swatches (with hex label) from the token set",
    "- Typography scale display",
    "- Spacing/shadow/radius scale",
    "- Dark/light toggle",
    "",
    "### 7. `src/design-system/stories/` (Storybook)",
    "- One `*.stories.tsx` per component with all variants using CSF3 format",
    "",
    "---",
    "",
    "## Quality requirements",
    "- Use `cva` for all component variants",
    "- `tailwind-merge` for className merging",
    "- Every component forwards its ref",
    "- WCAG 2.1 AA contrast on all text",
    "- All interactive elements: keyboard accessible, `focus-visible` ring, `aria-*` labels",
    "- Zero hardcoded colours in components — every colour must use a CSS variable or Tailwind token",
    "- Export a `package.json` stub with `name`, `version`, `main`, `types` fields so it can be published as an npm package",
    "",
    "Start with `emit_reasoning`, then `update_todo_list` covering all sections, then execute section by section.",
  );

  return lines.join("\n");
}
