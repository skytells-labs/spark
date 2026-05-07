import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Figma REST API types (minimal surface) ───────────────────────────────────

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaPaint {
  type: string;
  color?: FigmaColor;
  opacity?: number;
}

interface FigmaTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  lineHeightUnit?: string;
  letterSpacing?: number;
  textCase?: string;
  textDecoration?: string;
}

interface FigmaEffect {
  type: string;
  radius?: number;
  spread?: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  blendMode?: string;
}

interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  style?: FigmaTypeStyle;
  cornerRadius?: number;
  children?: FigmaNode[];
  styles?: Record<string, string>;
}

interface FigmaFileResponse {
  document: FigmaNode;
  styles: Record<string, FigmaStyle>;
  name: string;
  lastModified: string;
  version: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function figmaToHex(c: FigmaColor): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const a = Math.round((c.a ?? 1) * 255);
  const hex = [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const alpha = a < 255 ? a.toString(16).padStart(2, "0") : "";
  return `#${hex}${alpha}`;
}

function parseFigmaFileKey(url: string): string | null {
  // Handles:
  //   https://www.figma.com/file/{key}/...
  //   https://www.figma.com/design/{key}/...
  //   https://www.figma.com/proto/{key}/...
  const match = /figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9_-]{1,64})/i.exec(url);
  return match?.[1] ?? null;
}

// Recursively walk nodes to collect fills (colors) and text styles
function walkNodes(
  node: FigmaNode,
  colors: Map<string, string>,
  textStyles: Map<string, FigmaTypeStyle>,
  effects: Map<string, FigmaEffect[]>,
  depth = 0,
) {
  if (depth > 8) return; // safety cap

  // Collect fill colours named "color/" or any fill on a named node
  if (node.fills?.length) {
    for (const fill of node.fills) {
      if (fill.type === "SOLID" && fill.color) {
        colors.set(node.name, figmaToHex(fill.color));
      }
    }
  }

  // Collect text styles
  if (node.type === "TEXT" && node.style) {
    textStyles.set(node.name, node.style);
  }

  // Collect effects
  if (node.effects?.length) {
    effects.set(node.name, node.effects);
  }

  for (const child of node.children ?? []) {
    walkNodes(child, colors, textStyles, effects, depth + 1);
  }
}

// ── Exported token shape ──────────────────────────────────────────────────────

export interface FigmaExtract {
  fileName: string;
  lastModified: string;
  colors: Array<{ name: string; hex: string }>;
  textStyles: Array<{
    name: string;
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
  }>;
  effects: Array<{
    name: string;
    shadows: Array<{
      type: string;
      color?: string;
      radius?: number;
      spread?: number;
      offsetX?: number;
      offsetY?: number;
    }>;
  }>;
  namedStyles: Array<{ name: string; type: string; description: string }>;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { figmaUrl?: unknown; figmaToken?: unknown };
  try {
    body = (await request.json()) as { figmaUrl?: unknown; figmaToken?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { figmaUrl, figmaToken } = body;

  if (typeof figmaUrl !== "string" || !figmaUrl.trim()) {
    return NextResponse.json(
      { error: "figmaUrl is required" },
      { status: 400 },
    );
  }

  const fileKey = parseFigmaFileKey(figmaUrl);
  if (!fileKey) {
    return NextResponse.json(
      { error: "Could not parse a Figma file key from the provided URL." },
      { status: 422 },
    );
  }

  // Prefer user-supplied token, fall back to server env var
  const token =
    (typeof figmaToken === "string" && figmaToken.trim()) ||
    process.env.FIGMA_ACCESS_TOKEN ||
    "";

  if (!token) {
    return NextResponse.json(
      {
        error:
          "No Figma access token found. Set FIGMA_ACCESS_TOKEN in your environment or provide figmaToken in the request.",
        errorId: "MISSING_FIGMA_TOKEN",
      },
      { status: 401 },
    );
  }

  let figmaData: FigmaFileResponse;
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=5`, {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Figma API error ${res.status}: ${txt.slice(0, 200)}` },
        { status: res.status >= 400 && res.status < 500 ? res.status : 502 },
      );
    }
    figmaData = (await res.json()) as FigmaFileResponse;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Failed to fetch Figma file: ${err.message}`
            : "Failed to fetch Figma file.",
      },
      { status: 502 },
    );
  }

  // Extract from the document tree
  const colorMap = new Map<string, string>();
  const textStyleMap = new Map<string, FigmaTypeStyle>();
  const effectMap = new Map<string, FigmaEffect[]>();
  walkNodes(figmaData.document, colorMap, textStyleMap, effectMap);

  // Also pull named styles from the top-level styles registry
  const namedStyles = Object.values(figmaData.styles ?? {}).map((s) => ({
    name: s.name,
    type: s.styleType,
    description: s.description,
  }));

  const extract: FigmaExtract = {
    fileName: figmaData.name,
    lastModified: figmaData.lastModified,
    colors: Array.from(colorMap.entries())
      .slice(0, 120)
      .map(([name, hex]) => ({ name, hex })),
    textStyles: Array.from(textStyleMap.entries())
      .slice(0, 40)
      .map(([name, s]) => ({
        name,
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        lineHeightPx: s.lineHeightPx,
        letterSpacing: s.letterSpacing,
      })),
    effects: Array.from(effectMap.entries())
      .slice(0, 30)
      .map(([name, effs]) => ({
        name,
        shadows: effs
          .filter((e) => e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
          .map((e) => ({
            type: e.type,
            color: e.color ? figmaToHex(e.color) : undefined,
            radius: e.radius,
            spread: e.spread,
            offsetX: e.offset?.x,
            offsetY: e.offset?.y,
          })),
      }))
      .filter((e) => e.shadows.length > 0),
    namedStyles,
  };

  return NextResponse.json({ extract });
}
