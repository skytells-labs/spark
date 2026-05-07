"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Github,
  KeyRound,
  Rocket,
  Workflow,
  Zap,
} from "lucide-react";

type OrchestratorResult =
  | { state: "idle" }
  | { state: "running" }
  | { state: "success"; payload: unknown }
  | { state: "error"; message: string; payload?: unknown };

function parsePayload(value: string) {
  if (!value.trim()) return {};
  return JSON.parse(value) as unknown;
}

function formatResult(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

export function DeployPageClient() {
  const [repoUrl, setRepoUrl] = React.useState("");
  const [appName, setAppName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [workflowId, setWorkflowId] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [payload, setPayload] = React.useState('{\n  "source": "skytells-builder"\n}');
  const [result, setResult] = React.useState<OrchestratorResult>({ state: "idle" });

  const deployUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (repoUrl.trim()) params.set("repo", repoUrl.trim());
    if (appName.trim()) params.set("name", appName.trim());
    if (description.trim()) params.set("description", description.trim());
    return `https://console.skytells.ai/deploy?${params.toString()}`;
  }, [appName, description, repoUrl]);

  const canDeploy = repoUrl.trim().startsWith("https://github.com/");
  const canRunWorkflow = workflowId.trim().length > 0 && apiKey.trim().length > 0;

  async function runWorkflow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: "running" });

    let parsedPayload: unknown;
    try {
      parsedPayload = parsePayload(payload);
    } catch (error) {
      setResult({
        state: "error",
        message: error instanceof Error ? error.message : "Payload must be valid JSON.",
      });
      return;
    }

    try {
      const response = await fetch("/api/orchestrator/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: workflowId.trim(),
          apiKey: apiKey.trim(),
          payload: parsedPayload,
        }),
      });
      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: unknown }).error)
            : "Skytells Orchestrator returned an error.";
        setResult({ state: "error", message, payload: data });
        return;
      }

      setResult({ state: "success", payload: data });
    } catch (error) {
      setResult({
        state: "error",
        message: error instanceof Error ? error.message : "Unable to execute workflow.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      {/* Subtle gradient orb */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[#0070f3]/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-purple-600/[0.04] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex min-h-10 items-center justify-between gap-3">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
            Skytells Spark
          </Link>
          <a
            href="https://learn.skytells.ai/docs/products/orchestrator/api-reference"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-white/50 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            Orchestrator docs
            <ExternalLink className="size-3" />
          </a>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0a0a0a] via-[#090d18] to-[#070a14] p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0070f3]/40 to-transparent" />
          </div>
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0070f3]/25 bg-[#0070f3]/[0.08] px-3 py-1 text-[12px] text-[#7ab8ff]">
              <Rocket className="size-3.5" />
              Ship to production
            </div>
            <h1 className="text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[48px]">
              Connect GitHub,
              <br />
              <span className="text-white/50">configure &amp; deploy.</span>
            </h1>
            <p className="mt-4 max-w-lg text-pretty text-[14px] leading-[1.7] text-white/38">
              Wire your GitHub repository to Skytells Deploy. Ship your AI app with a single
              click — databases, models, and runtime configured automatically.
            </p>
            {/* Stats row */}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { label: "Zero-config deploys", icon: Zap },
                { label: "GitHub integration", icon: Github },
                { label: "Orchestrator webhooks", icon: Workflow },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2 text-[13px] text-white/40">
                  <Icon className="size-3.5 text-[#0070f3]/70" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* GitHub source */}
          <section className="rounded-2xl border border-white/[0.07] bg-[#080808]">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-white/[0.05]">
                <Github className="size-3.5 text-white/60" />
              </div>
              <span className="text-sm font-medium text-white/70">GitHub source</span>
            </div>
            <div className="grid gap-4 p-5">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/35">Repository URL</span>
                <input
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/acme/app"
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none ring-0 transition placeholder:text-white/20 focus:border-[#0070f3]/60 focus:bg-white/[0.04]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/35">App name</span>
                  <input
                    value={appName}
                    onChange={(event) => setAppName(event.target.value)}
                    placeholder="my-saas"
                    className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#0070f3]/60 focus:bg-white/[0.04]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/35">Description</span>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="AI SaaS on Skytells"
                    className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#0070f3]/60 focus:bg-white/[0.04]"
                  />
                </label>
              </div>
              {!canDeploy ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/12 bg-amber-400/[0.05] px-3.5 py-2.5 text-xs leading-5 text-amber-200/60">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400/50" />
                  Enter a GitHub repository URL to generate your production deploy link.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3.5 py-2.5 text-xs leading-5 text-emerald-300/70">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400/60" />
                  Repository URL verified — ready for Skytells Deploy.
                </div>
              )}
              <div className="flex items-center gap-3">
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    canDeploy
                      ? "border-[#0070f3]/40 bg-[#0070f3]/10 text-[#7ab8ff] hover:bg-[#0070f3]/18 hover:border-[#0070f3]/60"
                      : "cursor-not-allowed border-white/[0.06] text-white/20"
                  }`}
                  aria-disabled={!canDeploy}
                >
                  <Rocket className="size-3.5" />
                  Deploy on Skytells
                  <ExternalLink className="size-3 opacity-60" />
                </a>
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex overflow-hidden rounded-xl border border-white/[0.07] transition hover:border-white/14"
                  aria-disabled={!canDeploy}
                >
                  <img
                    src="https://console.skytells.ai/brand/deploy-buttons/dark-compact.png"
                    alt="Deploy on Skytells"
                    className="h-9 w-auto opacity-80 transition hover:opacity-100"
                  />
                </a>
              </div>
            </div>
          </section>

          {/* SaaS schema sidebar */}
          <aside className="rounded-2xl border border-white/[0.07] bg-[#080808] p-5">
            <div className="mb-1 text-sm font-medium text-white/60">SaaS schema</div>
            <p className="mb-4 text-xs leading-5 text-white/30">
              Ask the builder to enable SaaS mode — it generates real tables for users, credit
              ledger, bundles, subscriptions, and model usage tracking, backed by Skytells
              Postgres and libSQL.
            </p>
            <div className="grid gap-2">
              {[
                { table: "users", desc: "auth + profile" },
                { table: "credit_ledger", desc: "top-ups / burns" },
                { table: "bundles", desc: "pricing tiers" },
                { table: "subscriptions", desc: "plan lifecycle" },
                { table: "model_usage", desc: "per-request log" },
              ].map(({ table, desc }) => (
                <div
                  key={table}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/40 px-3.5 py-2.5"
                >
                  <span className="mono text-xs text-white/55">{table}</span>
                  <span className="text-[11px] text-white/22">{desc}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Orchestrator workflow */}
        <form
          onSubmit={(event) => {
            void runWorkflow(event);
          }}
          className="rounded-2xl border border-white/[0.07] bg-[#080808]"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#0070f3]/10">
              <Workflow className="size-3.5 text-[#65adff]" />
            </div>
            <span className="text-sm font-medium text-white/70">Orchestrator workflow</span>
            <span className="ml-auto rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/30">
              webhook trigger
            </span>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/35">Workflow ID</span>
                <input
                  value={workflowId}
                  onChange={(event) => setWorkflowId(event.target.value)}
                  placeholder="wf_..."
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#0070f3]/60 focus:bg-white/[0.04]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/35">Webhook API key</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/22" />
                  <input
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="wfb_..."
                    type="password"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-9 pr-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#0070f3]/60 focus:bg-white/[0.04]"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={!canRunWorkflow || result.state === "running"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0070f3] px-4 text-sm font-medium text-white transition hover:bg-[#0070f3]/85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {result.state === "running" ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Running…
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    Run workflow
                  </>
                )}
              </button>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/35">Webhook payload</span>
                <textarea
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  rows={7}
                  className="mono min-h-[160px] resize-y rounded-xl border border-white/[0.08] bg-black/60 px-3.5 py-3 text-xs leading-5 text-white/60 outline-none transition placeholder:text-white/20 focus:border-[#0070f3]/60"
                />
              </label>
              {result.state === "success" || result.state === "error" ? (
                <div
                  className={`rounded-xl border p-4 ${
                    result.state === "error"
                      ? "border-red-500/15 bg-red-500/[0.05]"
                      : "border-emerald-400/15 bg-emerald-400/[0.04]"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                    {result.state === "error" ? (
                      <AlertTriangle className="size-3.5 text-red-400/70" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-400/70" />
                    )}
                    <span className={result.state === "error" ? "text-red-300/70" : "text-emerald-300/70"}>
                      {result.state === "error" ? "Error" : "Success"}
                    </span>
                  </div>
                  <pre className="mono max-h-[200px] overflow-auto text-xs leading-5 text-white/40">
                    {result.state === "error"
                      ? `${result.message}\n${result.payload ? formatResult(result.payload) : ""}`
                      : formatResult(result.payload)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
