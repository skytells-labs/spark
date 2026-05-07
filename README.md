# Skytells Spark

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Built with Skytells AI](https://img.shields.io/badge/Built%20with-Skytells%20AI-5B21B6)](https://skytells.ai)
[![Deploy on Skytells](https://img.shields.io/badge/Deploy%20on-Skytells-5B21B6)](https://console.skytells.ai)

**Skytells Spark** is an open-source, production-ready AI application workspace — built by [Skytells](https://skytells.ai) — that takes a product idea and delivers working SaaS software: code, design assets, media, infrastructure plans, and a clear path to production.

![Skytells Spark](https://github.com/skytells-labs/spark/blob/main/public/images/spark.jpg?raw=true)

This is not a code editor add-on or a chat interface with a code block. It is a complete product workspace: one place to generate the frontend, the backend, the database schema, the billing system, the generated visuals, and the deployment configuration — all through a single, unified AI interface powered by Skytells models.

> **Recommended:** Deploy on [Skytells](https://console.skytells.ai) for the best experience — including fully managed infrastructure, private networking between your application and its databases, and native integration with Skytells AI capabilities.

<a href="https://console.skytells.ai/deploy?repo=https%3A%2F%2Fgithub.com%2Fskytells-labs%2Fspark" target="_blank" rel="noopener noreferrer">
  <img src="https://console.skytells.ai/brand/deploy-buttons/dark-compact.png" alt="Deploy on Skytells" height="40 />
</a>

You can also run Spark on any provider.

## What Skytells Spark Produces

Given a product brief, Skytells Spark generates:

- Full-stack application code (frontend + backend) with file tree, code editor, terminal guidance, and live preview surfaces.
- Database schemas, SaaS data models, billing structures, and credit accounting.
- Product visuals, design mockups, images, video, audio, and music through Skytells generation models.
- MCP-compatible agent runtime extensions and Orchestrator workflow integration.
- A complete deployment configuration ready for Skytells infrastructure.

## Capabilities

- **AI-Powered Workspace** — Persistent chat workspace backed by Skytells models with chain-of-thought reasoning, step timelines, and structured artifact output.
- **Full-Stack Code Generation** — Generates application code with file trees, code views, terminal commands, and interactive preview surfaces.
- **Generative Media** — Produces images, video, audio, and music as part of the product workflow through Skytells prediction models, with configurable generation modes.
- **SaaS-Ready Architecture** — Optional SaaS mode with users, organizations, subscriptions, billing events, credit bundles, credit ledger, model usage accounting, entitlements, and customer API keys.
- **Identity & Billing** — Supports [Supabase](https://supabase.com) or Better Auth for identity, and [Stripe](https://stripe.com) or manual billing for monetization.
- **Agent Runtime Extension** — MCP configuration UI and API routes for extending the agent with external tools and data sources.
- **Workflow Automation** — Skytells Orchestrator webhook execution for multi-step, automated product workflows.
- **Production Health Monitoring** — A `/api/health` endpoint that validates Skytells API access, database readiness, cache status, and SaaS configuration.
- **Code Quality Enforcement** — ESLint, TypeScript strict checks, and Husky pre-commit verification included out of the box.

## Requirements

- [Node.js](https://nodejs.org) 20 or newer
- npm 10 or newer
- A [Skytells account](https://console.skytells.ai/login)
- A Skytells API key (from [Skytells Console → API Keys](https://console.skytells.ai/settings/api-keys))
- One [Skytells project](https://console.skytells.ai/projects/new) with its associated databases provisioned

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add your Skytells API key and database connection strings to .env.local
npm run dev
```

Open the local URL printed by Next.js. Complete the environment configuration below before testing AI or database features.

## Setting Up Skytells

### 1. Create a Skytells Account

Sign in or create an account at [console.skytells.ai/login](https://console.skytells.ai/login).

Your Skytells account is the control boundary for projects, API keys, deployments, usage tracking, and operational settings. For account setup guidance, see the [Skytells documentation](https://learn.skytells.ai/docs/foundations/account/create-account).

### 2. Get an API Key

Open [Skytells Console → API Keys](https://console.skytells.ai/settings/api-keys) and create a server-side key for this application.

Add it to `.env.local`:

```bash
SKYTELLS_API_KEY=your_key_here
```

> Never commit `.env.local`, production secrets, database connection strings, or API keys to version control.

### 3. Create a Project

Open [console.skytells.ai/projects/new](https://console.skytells.ai/projects/new) and create a project for this application. Note the project slug — it appears in project dashboard URLs:

```
https://console.skytells.ai/projects/{project_slug}/...
```

### 4. Provision Databases

Open your project's database page:

```
https://console.skytells.ai/projects/{project_slug}/databases
```

Provision the required databases for your project and add their connection strings to your environment:

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_URL` | Yes | Relational application data, SaaS tables, billing, usage accounting, and reporting. |
| `LIBSQL_URL` | Yes | Runtime workspace state, chat history, generated artifacts, and low-latency reads. |
| `LIBSQL_AUTH_TOKEN` | When required | Authentication token for remote database access. |
| `REDIS_URL` | Recommended | Active-state caching, recent activity, and runtime performance. |

## Environment Configuration

Copy `.env.example` to `.env.local` and set these minimum values:

```bash
SKYTELLS_API_KEY=
POSTGRES_URL=
LIBSQL_URL=
LIBSQL_AUTH_TOKEN=
```

Add Redis for production-grade caching:

```bash
REDIS_URL=
REDIS_REQUIRED=false
```

Optional model and media configuration:

```bash
SKYTELLS_DEFAULT_MODEL=kimi-k2.6
SKYTELLS_TIMEOUT_MS=120000
SKYTELLS_IMAGE_GENERATION=auto
SKYTELLS_VIDEO_GENERATION=auto
SKYTELLS_AUDIO_GENERATION=auto
SKYTELLS_IMAGE_DEFAULT_MODEL=FLUX.2-pro
SKYTELLS_VIDEO_DEFAULT_MODEL=mera
SKYTELLS_AUDIO_DEFAULT_MODEL=beatfusion-2.0
```

**Media generation modes:**

| Mode | Behavior |
| --- | --- |
| `auto` | Generate assets automatically as part of the product workflow. |
| `ask` | Prompt for confirmation before generating each asset. |
| `off` | Disable that asset type entirely. |

**Optional SaaS mode:**

```bash
SAAS_MODE=true
SAAS_AUTH_PROVIDER=supabase   # or: betterauth
SAAS_BILLING_PROVIDER=manual  # or: stripe
```

When `SAAS_MODE=true`, set the required provider secrets. See the [Configuration Reference](docs/configuration.md) for the full variable list.

## Run Locally

```bash
npm run dev
```

Validate the build before shipping:

```bash
npm run verify
npm run build
```

Check runtime health after the server is running:

```bash
curl http://localhost:3000/api/health
```

The health endpoint validates Skytells model access, database connectivity, Redis status, and SaaS readiness.

## Deploying to Production

It is recommended to deploy Skytells Spark on [Skytells](https://console.skytells.ai). Skytells provides the infrastructure this project is built for: dedicated containers, managed databases, private internal networking, and native integration with Skytells AI capabilities — all in one place.

At a high level:

1. Push this repository to your Git provider.
2. Create your Skytells project and provision the required databases from the [Skytells Console](https://console.skytells.ai).
3. Add all environment variables to the deployment configuration.
4. Deploy as a dedicated Node.js container using `npm run build` and `npm run start`.
5. Run `/api/health` after deployment and confirm all services are healthy.

For step-by-step instructions, see the [Deployment Guide](docs/deployment.md).

> **Why Skytells Deploy?** Applications, databases, and internal services communicate over private Skytells networking, eliminating unnecessary public database exposure and significantly improving service-to-service latency. Skytells Deploy is purpose-built for exactly this type of workload.

## Production Notes

- Keep all Skytells API calls server-side. Never expose `SKYTELLS_API_KEY` to the browser.
- Use separate API keys for local development, staging, and production environments.
- Rotate exposed keys immediately from [Skytells Console → API Keys](https://console.skytells.ai/settings/api-keys).
- Use Skytells private networking for databases and internal services in production.
- Store all connection strings and secrets in your deployment environment — never in source code.
- Prefer a dedicated container over serverless for long-running generation, streaming, orchestration, and direct database connectivity.

## Documentation

| Guide | Description |
| --- | --- |
| [No-Code Setup Guide](docs/no-code-setup.md) | For non-developers and operators getting started with Skytells Spark. |
| [Developer Guide](docs/developer-guide.md) | Architecture overview, local development setup, and extension patterns. |
| [Configuration Reference](docs/configuration.md) | Complete environment variable reference. |
| [Database Guide](docs/databases.md) | Database setup, schema management, and data ownership patterns. |
| [Deployment Guide](docs/deployment.md) | Production deployment on Skytells, topology recommendations, and health validation. |

## Project Scripts

```bash
npm run dev        # Start local development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
npm run verify     # Run lint and typecheck together
```

Husky runs `npm run verify` automatically before every commit.

## Skytells Resources

| Resource | Link |
| --- | --- |
| Skytells Console | [console.skytells.ai](https://console.skytells.ai) |
| Sign In / Sign Up | [console.skytells.ai/login](https://console.skytells.ai/login) |
| API Keys | [console.skytells.ai/settings/api-keys](https://console.skytells.ai/settings/api-keys) |
| New Project | [console.skytells.ai/projects/new](https://console.skytells.ai/projects/new) |
| Documentation | [learn.skytells.ai/docs](https://learn.skytells.ai/docs) |
| API Reference | [learn.skytells.ai/docs/api](https://learn.skytells.ai/docs/api) |
| CLI Reference | [learn.skytells.ai/docs/cli](https://learn.skytells.ai/docs/cli) |

## License

[MIT](LICENSE) — built and maintained by [Skytells](https://skytells.ai).
