import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const executeSchema = z.object({
  workflowId: z.string().trim().min(1, "Workflow ID is required."),
  apiKey: z.string().trim().optional(),
  payload: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = executeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid Orchestrator request.",
      },
      { status: 400 },
    );
  }

  const { workflowId, payload } = parsed.data;
  const apiKey =
    parsed.data.apiKey?.trim() ||
    process.env.SKYTELLS_ORCHESTRATOR_API_KEY?.trim() ||
    process.env.ORCHESTRATOR_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Webhook API key is required. Set SKYTELLS_ORCHESTRATOR_API_KEY or provide apiKey in the request.",
      },
      { status: 400 },
    );
  }

  const endpoint = `https://orchestrator.skytells.ai/api/workflows/${encodeURIComponent(
    workflowId,
  )}/webhook`;

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await upstream.json().catch(() => null)
      : await upstream.text().catch(() => "");

    return NextResponse.json(
      {
        ok: upstream.ok,
        status: upstream.status,
        data,
      },
      { status: upstream.ok ? 200 : upstream.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach Skytells Orchestrator.",
      },
      { status: 502 },
    );
  }
}
