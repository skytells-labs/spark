import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ModelType } from "skytells";
import { getSkytellsClient, normalizeSkytellsError } from "@/lib/skytells";

export const runtime = "edge";

const getDefaultModels = unstable_cache(
  async () => {
    const client = getSkytellsClient();

    if (!client) {
      return {
        models: [],
        configured: false,
        defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
        message: "Add SKYTELLS_API_KEY or paste a runtime key to load live text models.",
      };
    }

    const models = await client.models.list();
    const textModels = models.filter((model) =>
      [ModelType.TEXT, ModelType.CODE, ModelType.MULTIMODAL].includes(model.type),
    );

    return {
      configured: true,
      defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
      models: textModels.slice(0, 48).map((model) => ({
        id: model.namespace || model.name,
        name: model.name || model.namespace,
        type: model.type || "model",
        source: "skytells",
      })),
    };
  },
  ["models-default"],
  { revalidate: 60 },
);

export async function GET(request: NextRequest) {
  const runtimeKey = request.headers.get("x-skytells-api-key") || undefined;

  if (!runtimeKey) {
    try {
      const payload = await getDefaultModels();
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    } catch (error) {
      const normalized = normalizeSkytellsError(error);

      return NextResponse.json(
        {
          configured: true,
          models: [],
          error: normalized,
        },
        {
          status: normalized.status,
          headers: {
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
          },
        },
      );
    }
  }

  const client = getSkytellsClient(runtimeKey);

  if (!client) {
    return NextResponse.json(
      {
        models: [],
        configured: false,
        defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
        message: "Add SKYTELLS_API_KEY or paste a runtime key to load live text models.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  try {
    const models = await client.models.list();

    const textModels = models.filter((model) =>
      [ModelType.TEXT, ModelType.CODE, ModelType.MULTIMODAL].includes(model.type),
    );

    return NextResponse.json(
      {
        configured: true,
        defaultModel: process.env.SKYTELLS_DEFAULT_MODEL || null,
        models: textModels.slice(0, 48).map((model) => ({
          id: model.namespace || model.name,
          name: model.name || model.namespace,
          type: model.type || "model",
          source: "skytells",
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const normalized = normalizeSkytellsError(error);

    return NextResponse.json(
      {
        configured: true,
        models: [],
        error: normalized,
      },
      {
        status: normalized.status,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
