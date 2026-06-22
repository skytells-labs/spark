import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getSaasStatus, validateDatabases } from "@/lib/infrastructure";

export const runtime = "nodejs";
export const revalidate = 30;

const getCachedSaasStatus = unstable_cache(
  async () => {
    const databases = await validateDatabases();
    const saas = getSaasStatus(databases.libsql.ok && databases.postgres.ok);

    return {
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
    };
  },
  ["saas-status"],
  { revalidate: 30 },
);

export async function GET() {
  const payload = await getCachedSaasStatus();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
