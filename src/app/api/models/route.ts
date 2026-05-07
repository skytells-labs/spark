import { NextRequest, NextResponse } from "next/server";
import { ModelType } from "skytells";
import { getSkytellsClient, normalizeSkytellsError } from "@/lib/skytells";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const runtimeKey = request.headers.get("x-skytells-api-key") || undefined;
  const client = getSkytellsClient(runtimeKey);

  if (!client) {
    return NextResponse.json({
      models: [],
      configured: false,
      defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
      message:
        "Add SKYTELLS_API_KEY or paste a runtime key to load live text models.",
    });
  }

  try {
    const models = await client.models.list();

    const textModels = models.filter((model) =>
      [ModelType.TEXT, ModelType.CODE, ModelType.MULTIMODAL].includes(model.type),
    );

    return NextResponse.json({
      configured: true,
      defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
      models: textModels.slice(0, 48).map((model) => ({
        id: model.namespace || model.name,
        name: model.name || model.namespace,
        type: model.type || "model",
        source: "skytells",
      })),
    });
  } catch (error) {
    const normalized = normalizeSkytellsError(error);

    return NextResponse.json(
      {
        configured: true,
        models: [],
        error: normalized,
      },
      { status: normalized.status },
    );
  }
}
