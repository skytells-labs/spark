import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createMcpConfig,
  deleteMcpConfig,
  listMcpConfigs,
} from "@/lib/infrastructure";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(80, "Name must be under 80 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes, or underscores."),
  config: z.unknown().superRefine((value, ctx) => {
    const result = validateMcpConfig(value);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
      });
    }
  }),
});

export async function GET() {
  if (process.env.MCP_ENABLED !== "true") {
    return NextResponse.json({ error: { message: "MCP disabled." } }, { status: 404 });
  }
  const mcps = await listMcpConfigs();
  return NextResponse.json({
    mcps: mcps.map((mcp) => enrichMcpConfig(mcp)),
  });
}

export async function POST(request: NextRequest) {
  if (process.env.MCP_ENABLED !== "true") {
    return NextResponse.json({ error: { message: "MCP disabled." } }, { status: 404 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid MCP payload.", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const created = await createMcpConfig(parsed.data);
  return NextResponse.json({ mcp: enrichMcpConfig(created) });
}

export async function DELETE(request: NextRequest) {
  if (process.env.MCP_ENABLED !== "true") {
    return NextResponse.json({ error: { message: "MCP disabled." } }, { status: 404 });
  }
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json({ error: { message: "Missing id." } }, { status: 400 });
  }
  const ok = await deleteMcpConfig(id);
  return NextResponse.json({ ok });
}

function validateMcpConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Config must be a JSON object." };
  }

  const config = value as Record<string, unknown>;
  const hasCommand = typeof config.command === "string" && config.command.trim().length > 0;
  const hasUrl = typeof config.url === "string" && isHttpUrl(config.url);

  if (!hasCommand && !hasUrl) {
    return {
      ok: false,
      message: "Config must include either a command for stdio MCP or an http(s) url.",
    };
  }

  if ("args" in config && !Array.isArray(config.args)) {
    return { ok: false, message: "args must be an array when provided." };
  }

  if ("env" in config && (!config.env || typeof config.env !== "object" || Array.isArray(config.env))) {
    return { ok: false, message: "env must be an object when provided." };
  }

  if ("headers" in config && (!config.headers || typeof config.headers !== "object" || Array.isArray(config.headers))) {
    return { ok: false, message: "headers must be an object when provided." };
  }

  if ("tools" in config && !Array.isArray(config.tools)) {
    return { ok: false, message: "tools must be an array when provided." };
  }

  return { ok: true, message: "Config looks valid." };
}

function enrichMcpConfig(mcp: Awaited<ReturnType<typeof listMcpConfigs>>[number]) {
  const config = mcp.config as Record<string, unknown>;
  const validation = validateMcpConfig(mcp.config);
  return {
    ...mcp,
    status: validation.ok ? "ready" : "invalid",
    validationMessage: validation.message,
    transport: typeof config?.url === "string" ? "http" : "stdio",
    tools: extractToolNames(mcp.config),
  };
}

function extractToolNames(value: unknown) {
  if (!value || typeof value !== "object") return [] as string[];
  const config = value as Record<string, unknown>;
  const tools = config.tools;
  if (!Array.isArray(tools)) return [] as string[];

  return tools
    .map((tool) => {
      if (typeof tool === "string") return tool;
      if (tool && typeof tool === "object") {
        const record = tool as Record<string, unknown>;
        return typeof record.name === "string" ? record.name : "";
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 50);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
