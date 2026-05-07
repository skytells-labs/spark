# Security Policy

## Supported Version

This is the first public release line of Skytells Spark. Security fixes should target the current `0.1.x` release line unless a later release line is published.

## Reporting a Vulnerability

Report suspected vulnerabilities privately to the project maintainers. Do not open public issues for secrets, authentication bypasses, data exposure, infrastructure misconfiguration, or exploit details.

Include the affected route, component, environment, reproduction steps, expected impact, and any relevant logs with secrets removed.

## Secret Handling

Never commit `.env.local`, Skytells API keys, database URLs, libSQL auth tokens, Redis URLs, Orchestrator webhook keys, Figma tokens, Supabase service role keys, Better Auth secrets, Stripe secrets, or webhook secrets.

Use separate credentials for development, staging, and production. Rotate keys immediately if they are exposed.

## Production Controls

- Keep `SKYTELLS_API_KEY` server-side only.
- Store all credentials in deployment secrets.
- Use Skytells private networking for app-to-database and app-to-cache communication.
- Restrict database access to the application container and trusted operators.
- Review generated code before production use.
- Validate `/api/health` after every deployment.
- Keep dependencies updated and review `npm audit` output before release.

## User Data

Do not place sensitive user data in prompts, generated artifacts, logs, screenshots, or issue reports unless the user explicitly approves the workflow and the data is protected under the deployment's security requirements.

