# Developer Guide

This guide covers the application architecture, local development setup, and conventions for extending Skytells Spark.

## Architecture

Skytells Spark is a [Next.js](https://nextjs.org) application using the App Router. The runtime is Node.js — not serverless — because the application maintains persistent database connections, streams long-running AI generation output, executes Orchestrator workflows, and performs infrastructure health validation. A dedicated container is required for production.

### Key Areas

| Path | Responsibility |
| --- | --- |
| `src/app/api/chat/route.ts` | Handles generation requests and artifact creation. |
| `src/app/api/health/route.ts` | Validates Skytells API access and all infrastructure dependencies. |
| `src/app/api/models/route.ts` | Lists available text-capable Skytells models. |
| `src/app/api/mcps/route.ts` | Manages MCP configurations when enabled. |
| `src/app/api/orchestrator/execute/route.ts` | Executes Skytells Orchestrator webhook workflows. |
| `src/lib/infrastructure.ts` | Manages database connections, schema initialization, SaaS readiness, and persistence. |
| `src/lib/skytells.ts` | Creates the Skytells SDK client and normalizes SDK errors. |
| `src/lib/media-capabilities.ts` | Resolves media generation modes and model defaults. |

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Minimum local configuration:

```bash
SKYTELLS_API_KEY=
POSTGRES_URL=
LIBSQL_URL=
LIBSQL_AUTH_TOKEN=
```

Add Redis to test production-equivalent caching behavior:

```bash
REDIS_URL=
```

## Verification

Run the full verification suite before submitting any change:

```bash
npm run verify
npm run build
```

`npm run verify` executes ESLint and TypeScript strict checks. Husky runs the same verification automatically before every commit.

## Data Ownership

Each database in the project has a defined ownership boundary. Do not mix workloads across databases.

| Database | Owns |
| --- | --- |
| Postgres | Relational product data, SaaS records, billing history, credit ledgers, usage events, entitlements, and customer API keys. |
| Runtime database | Builder workspace state, chat history, generated artifacts, MCP configurations, workflow metadata, and deployment records. |
| Redis | Cache-oriented state, recent activity, health pings, and runtime acceleration. Redis is not a durable store. |

## SaaS Mode

Enable SaaS mode with:

```bash
SAAS_MODE=true
```

Choose an identity provider:

```bash
SAAS_AUTH_PROVIDER=supabase
# or
SAAS_AUTH_PROVIDER=betterauth
```

Choose a billing provider:

```bash
SAAS_BILLING_PROVIDER=manual
# or
SAAS_BILLING_PROVIDER=stripe
```

When `SAAS_MODE=true`, the application initializes and validates tables for users, organizations, subscriptions, billing events, credit bundles, credit ledger, model usage events, entitlements, and customer API keys.

## Media Generation

Skytells Spark generates production-grade product assets — visuals, images, video, audio, and music — through Skytells generation models. This is a first-class part of the product workflow, not an add-on.

Keep generated asset workflows auditable. Store prompts, model identifiers, output references, and any required license metadata appropriate to your production requirements.

## API Key Security

All Skytells API calls must originate from server routes or trusted server utilities. Browser code must never receive `SKYTELLS_API_KEY`.

Runtime user-provided keys are supported in the UI for local testing. Production deployments must use server-side secrets managed through deployment environment configuration in [Skytells Console](https://console.skytells.ai).


