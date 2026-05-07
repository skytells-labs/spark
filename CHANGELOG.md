# Changelog

All notable changes to Skytells Spark are documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-04-28

### Initial Release

**Skytells Spark** — an open-source, production-ready AI application workspace by [Skytells](https://skytells.ai).

#### Workspace & Generation
- Full AI application workspace backed by [Skytells](https://skytells.ai) models, with persistent chat, chain-of-thought reasoning, step timelines, and structured artifact output.
- Full-stack code generation with file tree, code view, terminal guidance, and live preview surfaces.
- Image, video, audio, and music generation through Skytells prediction models, with configurable `auto`, `ask`, and `off` generation modes.

#### Infrastructure
- PostgreSQL integration for relational application data, SaaS records, billing history, and usage accounting.
- Runtime database integration for workspace state, chat history, generated artifacts, and fast read operations.
- Redis integration for active-state caching and runtime performance acceleration.
- Private networking support for production deployments on [Skytells](https://console.skytells.ai).

#### SaaS Mode
- Optional SaaS mode with multi-tenant user and organization management, subscription lifecycle, billing events, credit bundles, credit ledger, model usage accounting, entitlements, and customer API key issuance.
- [Supabase](https://supabase.com) and Better Auth identity provider support.
- [Stripe](https://stripe.com) and manual billing provider support.

#### Integrations
- MCP configuration API and management UI for extending the agent runtime with external tools.
- Skytells Orchestrator webhook execution for multi-step workflow automation.
- [Figma](https://figma.com) design import route.

#### Operations
- `/api/health` endpoint for runtime validation of Skytells API access, database connectivity, cache status, and SaaS readiness.
- ESLint, TypeScript strict checking, and Husky pre-commit verification.
- Production-ready deployment configuration targeting [Skytells Deploy](https://console.skytells.ai).

