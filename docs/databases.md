# Database Guide

Skytells Spark connects to databases provisioned in your [Skytells project](https://console.skytells.ai). Provision the required databases from your project's database page before running the application in production.

## Provisioning Databases

Open your project in [Skytells Console](https://console.skytells.ai) and navigate to the database page:

```
https://console.skytells.ai/projects/{project_slug}/databases
```

Provision the following and add their connection strings to your deployment environment.

## Required Databases

### Postgres

Used for relational application data and — when SaaS mode is enabled — multi-tenant account records, subscription lifecycle events, billing history, credit ledgers, usage accounting, entitlements, and customer API key issuance.

```bash
POSTGRES_URL=
```

### Runtime Database

Used for workspace state, chat history, generated artifacts, MCP configurations, workflow metadata, and deployment records. Optimized for high-frequency read and write operations from the builder runtime.

```bash
LIBSQL_URL=
LIBSQL_AUTH_TOKEN=   # Required when token authentication is enabled
```

## Recommended: Cache Layer

Redis is recommended for production deployments. It provides active-state caching, recent workspace activity, runtime performance optimization, and health ping acceleration.

```bash
REDIS_URL=
```

To require Redis for the application to report healthy, set:

```bash
REDIS_REQUIRED=true
```

## Private Networking

In production, all databases should communicate with the application container over private Skytells networking. Do not expose database connection endpoints to the public internet.

Skytells Deploy handles private network configuration automatically when all components are provisioned within the same project. See the [Deployment Guide](deployment.md) for topology recommendations.

## Schema Management

Skytells Spark initializes and validates all required database tables at startup. Run `/api/health` after deployment to confirm connectivity and schema readiness across all configured databases.

