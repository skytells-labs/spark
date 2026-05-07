# No-Code Setup Guide

This guide is for operators, founders, and product managers who want to get Skytells Spark running without diving into the full codebase.

## What You'll Have When Done

- A Skytells account and project.
- A Skytells API key for AI model access.
- All required databases provisioned and connected.
- Environment variables configured and ready.
- A working Skytells Spark deployment on Skytells infrastructure.

---

## Step 1: Create a Skytells Account

Go to [console.skytells.ai/login](https://console.skytells.ai/login) and sign in or create an account.

Your Skytells account gives you access to projects, API keys, deployments, usage analytics, billing, and operational settings.

---

## Step 2: Create an API Key

Go to [Skytells Console → API Keys](https://console.skytells.ai/settings/api-keys) and create a new API key for this application.

Store the key securely. You'll add it as:

```bash
SKYTELLS_API_KEY=your_key_here
```

> Never share your API key or commit it to source control.

---

## Step 3: Create a Project

Go to [console.skytells.ai/projects/new](https://console.skytells.ai/projects/new) and create a project for this application. Note the project slug — you'll use it to open the database page.

---

## Step 4: Provision Databases

Open your project's database page:

```
https://console.skytells.ai/projects/{project_slug}/databases
```

Provision the following databases and copy their connection strings to your environment:

| Variable | Required |
| --- | --- |
| `POSTGRES_URL` | Yes |
| `LIBSQL_URL` | Yes |
| `LIBSQL_AUTH_TOKEN` | When required |
| `REDIS_URL` | Recommended for production |

---

## Step 5: Configure Environment Variables

In your Skytells deployment environment, add the values from Step 2 and Step 4:

```bash
SKYTELLS_API_KEY=
POSTGRES_URL=
LIBSQL_URL=
LIBSQL_AUTH_TOKEN=
REDIS_URL=
```

For local setup, copy `.env.example` to `.env.local` and fill in the same values.

---

## Step 6: Configure Media Generation

Skytells Spark can generate product visuals, images, video, audio, and music as part of the product workflow. Control this behavior with:

```bash
SKYTELLS_IMAGE_GENERATION=auto
SKYTELLS_VIDEO_GENERATION=auto
SKYTELLS_AUDIO_GENERATION=auto
```

- `auto` — generate assets automatically as part of the product workflow.
- `ask` — require confirmation before each asset is generated.
- `off` — disable that asset type.

---

## Step 7: Deploy on Skytells

It is recommended to deploy on [Skytells](https://console.skytells.ai) for a fully integrated experience. Skytells Deploy provides dedicated container hosting with private networking between your application and its databases — purpose-built for this type of workload.

**Build command:**
```bash
npm run build
```

**Start command:**
```bash
npm run start
```

After deployment, validate that all services are healthy by opening:

```
https://your-app-domain/api/health
```

All checks should return a healthy status. If any check fails, verify the corresponding environment variable is correctly set in your deployment configuration.


