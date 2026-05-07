# Configuration Reference

All configuration is provided through environment variables. Copy `.env.example` to `.env.local` for local development, or add variables to your deployment environment in [Skytells Console](https://console.skytells.ai).

## Core Variables

These variables are required for the application to start and operate.

| Variable | Required | Description |
| --- | --- | --- |
| `SKYTELLS_API_KEY` | **Yes** | Server-side Skytells API key. Used to list models and call all Skytells generation APIs. Obtain from [Skytells Console → API Keys](https://console.skytells.ai/settings/api-keys). |
| `POSTGRES_URL` | **Yes** | PostgreSQL connection string for the project's relational database. |
| `LIBSQL_URL` | **Yes** | Connection string for the project's runtime database. |
| `LIBSQL_AUTH_TOKEN` | When required | Authentication token for remote database access when token auth is enabled. |

## Supported Aliases

The following aliases are accepted in addition to the primary variable names:

| Primary Variable | Accepted Aliases |
| --- | --- |
| `POSTGRES_URL` | `DATABASE_URL`, `SKYTELLS_POSTGRES_URL` |
| `LIBSQL_URL` | `SKYTELLS_LIBSQL_URL` |
| `LIBSQL_AUTH_TOKEN` | `SKYTELLS_LIBSQL_AUTH_TOKEN` |
| `REDIS_URL` | `KV_URL`, `SKYTELLS_REDIS_URL` |
| `SKYTELLS_ORCHESTRATOR_API_KEY` | `ORCHESTRATOR_API_KEY` |

## Model Variables

| Variable | Default | Description |
| --- | --- | --- |
| `SKYTELLS_DEFAULT_MODEL` | `kimi-k2.6` | Default model selected in the workspace UI. Must be a text or code-capable Skytells model. |
| `SKYTELLS_TIMEOUT_MS` | `120000` | Timeout in milliseconds applied to Skytells SDK calls. |

## Media Generation Variables

Control how the builder handles image, video, and audio generation as part of the product workflow.

| Variable | Default | Accepted Values |
| --- | --- | --- |
| `SKYTELLS_IMAGE_GENERATION` | `auto` | `auto` · `ask` · `off` |
| `SKYTELLS_VIDEO_GENERATION` | `auto` | `auto` · `ask` · `off` |
| `SKYTELLS_AUDIO_GENERATION` | `auto` | `auto` · `ask` · `off` |
| `SKYTELLS_IMAGE_DEFAULT_MODEL` | `FLUX.2-pro` | Skytells image model identifier. |
| `SKYTELLS_VIDEO_DEFAULT_MODEL` | `mera` | Skytells video model identifier. |
| `SKYTELLS_AUDIO_DEFAULT_MODEL` | `beatfusion-2.0` | Skytells audio or music model identifier. |

**Generation mode behavior:**

- `auto` — generate assets automatically as part of the product workflow.
- `ask` — require explicit confirmation before each asset is generated.
- `off` — disable that asset type entirely.

## SaaS Mode Variables

Enable SaaS mode to activate multi-tenant user management, subscription handling, billing, credit accounting, and customer API key issuance.

| Variable | Required When | Description |
| --- | --- | --- |
| `SAAS_MODE` | Optional | Set to `true` to enable SaaS features. |
| `SAAS_AUTH_PROVIDER` | `SAAS_MODE=true` | Identity provider: `supabase` or `betterauth`. |
| `SAAS_BILLING_PROVIDER` | `SAAS_MODE=true` | Billing provider: `manual` or `stripe`. |

**Supabase identity provider:**

| Variable | Required When |
| --- | --- |
| `SUPABASE_URL` | `SAAS_AUTH_PROVIDER=supabase` |
| `SUPABASE_ANON_KEY` | `SAAS_AUTH_PROVIDER=supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SAAS_AUTH_PROVIDER=supabase` |

**Better Auth identity provider:**

| Variable | Required When |
| --- | --- |
| `BETTER_AUTH_SECRET` | `SAAS_AUTH_PROVIDER=betterauth` |
| `BETTER_AUTH_URL` | `SAAS_AUTH_PROVIDER=betterauth` |

**Stripe billing:**

| Variable | Required When |
| --- | --- |
| `STRIPE_SECRET_KEY` | `SAAS_BILLING_PROVIDER=stripe` |
| `STRIPE_WEBHOOK_SECRET` | `SAAS_BILLING_PROVIDER=stripe` |

## Optional Integration Variables

| Variable | Description |
| --- | --- |
| `REDIS_URL` | Connection string for the cache layer. Recommended for production. |
| `REDIS_REQUIRED` | Set to `true` to make Redis a hard requirement for `/api/health` to pass. |
| `POSTGRES_SSL` | Set to `require` to enforce SSL, or `disable` for local non-SSL connections. |
| `MCP_ENABLED` | Set to `true` to enable MCP configuration APIs and the management UI. |
| `SKYTELLS_ORCHESTRATOR_API_KEY` | Server-side API key for Skytells Orchestrator webhook execution. |
| `SKYTELLS_ORCHESTRATOR_WORKFLOW_ID` | Default workflow ID used when triggering automation from the builder. |
| `FIGMA_ACCESS_TOKEN` | Optional token for Figma design import routes. |

