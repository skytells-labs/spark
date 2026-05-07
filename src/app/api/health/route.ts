import { NextRequest, NextResponse } from "next/server";
import { ModelType } from "skytells";
import { validateDatabases } from "@/lib/infrastructure";
import { getSkytellsClient, normalizeSkytellsError } from "@/lib/skytells";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const runtimeKey = request.headers.get("x-skytells-api-key") || undefined;
  const client = getSkytellsClient(runtimeKey);

  const [databases, skytells] = await Promise.all([
    validateDatabases(),
    validateSkytells(client),
  ]);

  return NextResponse.json({
    ok: databases.ok && skytells.ok,
    skytells,
    saas: databases.saas,
    databases,
    requirements: {
      console: "https://console.skytells.ai",
      projects: "https://console.skytells.ai/projects",
      databaseCreation:
        "https://console.skytells.ai/projects/{project_name}/databases/new",
      requiredEnvironment: [
        "SKYTELLS_API_KEY",
        "POSTGRES_URL or DATABASE_URL",
        "LIBSQL_URL",
        "LIBSQL_AUTH_TOKEN (when required by the Skytells libSQL database)",
      ],
      recommendedEnvironment: ["REDIS_URL"],
    },
  });
}

async function validateSkytells(client: ReturnType<typeof getSkytellsClient>) {
  if (!client) {
    return {
      ok: false,
      message: "Missing SKYTELLS_API_KEY or runtime Skytells API key.",
      models: [],
    };
  }

  try {
    const models = await client.models.list();
    const textModels = models.filter((model) =>
      [ModelType.TEXT, ModelType.CODE, ModelType.MULTIMODAL].includes(model.type),
    );

    return {
      ok: textModels.length > 0,
      message:
        textModels.length > 0
          ? `${textModels.length} text-capable models available.`
          : "Skytells key is valid, but no text-capable models were returned.",
      models: textModels.slice(0, 8).map((model) => ({
        id: model.namespace || model.name,
        name: model.name || model.namespace,
        type: model.type,
      })),
    };
  } catch (error) {
    const normalized = normalizeSkytellsError(error);

    return {
      ok: false,
      message: `${normalized.errorId}: ${normalized.message}`,
      models: [],
    };
  }
}
