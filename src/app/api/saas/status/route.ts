import { NextResponse } from "next/server";
import { getSaasStatus, validateDatabases } from "@/lib/infrastructure";

export const runtime = "nodejs";

export async function GET() {
  const databases = await validateDatabases();
  const saas = getSaasStatus(databases.libsql.ok && databases.postgres.ok);

  return NextResponse.json({
    ok: saas.ok,
    saas,
    databases: {
      libsql: {
        provider: "skytells-libsql",
        ok: databases.libsql.ok,
        message: databases.libsql.message,
      },
      postgres: {
        provider: "skytells-postgres",
        ok: databases.postgres.ok,
        message: databases.postgres.message,
      },
    },
    auth: {
      provider: saas.authProvider,
      supportedProviders: ["supabase", "betterauth"],
    },
    billing: {
      provider: saas.billingProvider,
      supportedProviders: ["stripe", "manual"],
    },
  });
}
