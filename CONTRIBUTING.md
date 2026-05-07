# Contributing

Thank you for your interest in contributing to Skytells Spark. This project is open source and maintained by [Skytells](https://skytells.ai). Contributions that preserve its purpose — a professional, production-ready AI application workspace — are welcome.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `.env.local` with a valid Skytells API key and the required database connection strings. Add only the services needed for the feature you are testing. See the [Configuration Reference](docs/configuration.md) for the full variable list.

## Development Standards

- **Security first.** All Skytells API calls must remain server-side. Never expose `SKYTELLS_API_KEY` or any service credential to browser code.
- **Follow existing patterns.** Prefer the established UI, data access, and route conventions before introducing new abstractions.
- **Keep asset workflows auditable.** Generated media output — images, video, audio — should store associated prompts, model identifiers, and output references.
- **Update documentation.** When environment variables, deployment steps, or runtime behavior change, update `docs/configuration.md`, the relevant guide, and `.env.example`.
- **No fake data in SaaS mode.** Do not use mock billing events, simulated credit ledgers, or synthetic usage accounting in SaaS-enabled builds.

## Before Submitting

Run the full verification suite:

```bash
npm run verify
npm run build
```

Husky runs `npm run verify` automatically before every commit. Both commands must pass before opening a pull request.

## Pull Request Checklist

- [ ] The change is scoped, production-oriented, and does not introduce unnecessary abstractions.
- [ ] Documentation is updated where behavior, setup, or environment variables change.
- [ ] New environment variables are added to both `.env.example` and [docs/configuration.md](docs/configuration.md).
- [ ] Any security-sensitive logic has been reviewed.
- [ ] `npm run verify` passes.
- [ ] `npm run build` passes, or any known build issue is clearly documented in the pull request.

