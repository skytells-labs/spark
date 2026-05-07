# Deployment Guide

It is recommended to deploy Skytells Spark on [Skytells](https://console.skytells.ai). Skytells provides the full infrastructure stack this project is built for — dedicated containers, managed databases, private internal networking, and native Skytells AI integration — in one unified platform.

## Why Skytells Deploy

Skytells Spark is a stateful, long-running server application. It maintains database connections, streams AI-generated output, executes Orchestrator workflows, and validates infrastructure health on every request cycle. These characteristics are best served by a dedicated Node.js container with direct, private access to its data layer.

Skytells Deploy is purpose-built for this topology:

- Your application, databases, cache, and internal services communicate over **private Skytells networking** — no public database exposure required.
- Dedicated containers support long-running generation, streaming responses, persistent database connections, and direct service-to-service communication.
- Environment secrets, deployment configuration, and runtime health monitoring are managed from a single [Skytells Console](https://console.skytells.ai) project.

## Recommended Production Topology

| Component | Role |
| --- | --- |
| Application container | Dedicated Node.js container running `npm run start` |
| Postgres | Relational application and SaaS data |
| Runtime database | Workspace state, chat history, artifacts, and fast reads |
| Redis | Active-state cache, recent activity, runtime acceleration |
| Skytells Orchestrator | Workflow automation (when enabled) |

All components should communicate over private Skytells networking. Databases and internal services should not be exposed to the public internet.

## Deployment Steps

1. Push this repository to your Git provider.
2. Open [Skytells Console](https://console.skytells.ai) and select or create your project.
3. Provision the required databases from your project's database page:
   ```
   https://console.skytells.ai/projects/{project_slug}/databases
   ```
4. Add all environment variables to the deployment environment (see [Configuration Reference](configuration.md)).
5. Set the **build command** to:
   ```bash
   npm install && npm run build
   ```
6. Set the **start command** to:
   ```bash
   npm run start
   ```
7. Deploy the application as a dedicated Node.js container.
8. After deployment, open `/api/health` and confirm all required services pass.

## Health Validation

Run after every deployment:

```
https://your-production-domain/api/health
```

The endpoint reports:

| Check | What It Validates |
| --- | --- |
| Skytells API | Model access and API key validity |
| Postgres | Connection and schema readiness |
| Runtime database | Connection and schema readiness |
| Redis | Connection status (when configured) |
| SaaS | Provider and table readiness (when `SAAS_MODE=true`) |

## Production Checklist

- [ ] `SKYTELLS_API_KEY` is set as a deployment secret.
- [ ] `POSTGRES_URL` points to the production Postgres database.
- [ ] `LIBSQL_URL` and `LIBSQL_AUTH_TOKEN` (when required) are set.
- [ ] `REDIS_URL` is configured for production caching.
- [ ] SaaS provider secrets are set when `SAAS_MODE=true`.
- [ ] Stripe webhook secret is set when Stripe billing is enabled.
- [ ] Orchestrator webhook key is set when workflow automation is enabled.
- [ ] All databases are on private Skytells networking, not public endpoints.
- [ ] `/api/health` returns a healthy response.
- [ ] `npm run verify` and `npm run build` pass before release.

