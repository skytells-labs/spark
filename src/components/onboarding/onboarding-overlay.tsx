"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Database,
  KeyRound,
  Loader2,
  Server,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────── */
type StepId = "welcome" | "apikey" | "postgres" | "done";

interface StepDef {
  id: StepId;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepDef[] = [
  { id: "welcome", label: "Welcome", icon: <Sparkles className="size-3.5" /> },
  { id: "apikey", label: "API Key", icon: <KeyRound className="size-3.5" /> },
  { id: "postgres", label: "Database", icon: <Database className="size-3.5" /> },
  { id: "done", label: "Ready", icon: <Zap className="size-3.5" /> },
];

/* ─── Animated SVGs ──────────────────────────────────────────────────── */
function WelcomeSvg() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="h-36 w-full">
      {/* Grid lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.line
          key={`h-${i}`}
          x1="0" y1={20 + i * 24} x2="200" y2={20 + i * 24}
          stroke="rgba(0,112,243,0.15)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: i * 0.06, duration: 0.5 }}
        />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.line
          key={`v-${i}`}
          x1={14 + i * 29} y1="0" x2={14 + i * 29} y2="160"
          stroke="rgba(0,112,243,0.10)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
        />
      ))}
      {/* Central glow orb */}
      <motion.circle
        cx="100" cy="80" r="42"
        fill="rgba(0,112,243,0.08)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx="100" cy="80" r="28"
        fill="rgba(0,112,243,0.14)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Sparkle ring */}
      <motion.circle
        cx="100" cy="80" r="42"
        stroke="rgba(0,112,243,0.35)"
        strokeWidth="1"
        fill="none"
        strokeDasharray="8 6"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 80px" }}
      />
      {/* Logo mark */}
      <motion.text
        x="100" y="87" textAnchor="middle"
        fill="rgba(101,173,255,0.9)"
        fontSize="22" fontWeight="700" fontFamily="ui-sans-serif,system-ui"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.45 }}
      >
        S
      </motion.text>
      {/* Orbiting dots */}
      {[0, 72, 144, 216, 288].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 100 + 42 * Math.cos(rad);
        const cy = 80 + 42 * Math.sin(rad);
        return (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r="3.5"
            fill="rgba(0,112,243,0.7)"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + i * 0.08, duration: 0.3 }}
          />
        );
      })}
    </svg>
  );
}

function ApiKeySvg({ validating, valid }: { validating: boolean; valid: boolean | null }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className="h-32 w-full">
      {/* Key body */}
      <motion.rect
        x="60" y="50" width="80" height="40" rx="8"
        stroke="rgba(0,112,243,0.5)" strokeWidth="1.5"
        fill="rgba(0,112,243,0.06)"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Keyhole */}
      <motion.circle
        cx="100" cy="70" r="9"
        stroke={valid ? "rgba(16,185,129,0.8)" : "rgba(0,112,243,0.6)"}
        strokeWidth="1.5"
        fill="transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      />
      {/* Key teeth */}
      {[78, 90, 102, 114, 126].map((x, i) => (
        <motion.rect
          key={i} x={x} y="86" width="5" height={6 + (i % 2) * 5} rx="1"
          fill={valid ? "rgba(16,185,129,0.6)" : "rgba(0,112,243,0.4)"}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
          style={{ transformOrigin: `${x}px 86px` }}
        />
      ))}
      {/* Scanning line */}
      {validating && (
        <motion.line
          x1="60" y1="70" x2="140" y2="70"
          stroke="rgba(101,173,255,0.8)"
          strokeWidth="1.5"
          animate={{ x1: [60, 140, 60] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {/* Check mark */}
      {valid && (
        <motion.path
          d="M 89 70 L 97 78 L 113 62"
          stroke="rgba(16,185,129,0.9)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      )}
      {/* Status dots */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={170 + i * 6} cy="20" r="2.5"
          fill={valid ? "rgba(16,185,129,0.7)" : "rgba(0,112,243,0.4)"}
          animate={validating ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
          transition={validating ? { duration: 0.9, delay: i * 0.15, repeat: Infinity } : {}}
        />
      ))}
    </svg>
  );
}

function DatabaseSvg({ healthy }: { healthy: boolean | null }) {
  const color = healthy ? "rgba(16,185,129,0.7)" : "rgba(0,112,243,0.5)";
  return (
    <svg viewBox="0 0 240 150" fill="none" className="h-32 w-full">
      {/* Postgres cylinder */}
      <motion.ellipse cx="60" cy="45" rx="24" ry="8" stroke={color} strokeWidth="1.5" fill="rgba(0,112,243,0.08)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
      <motion.rect x="36" y="45" width="48" height="44" fill="rgba(0,112,243,0.06)" stroke={color} strokeWidth="1.5"
        initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }} style={{ transformOrigin: "60px 45px" }} />
      <motion.ellipse cx="60" cy="89" rx="24" ry="8" stroke={color} strokeWidth="1.5" fill="rgba(0,112,243,0.10)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.3 }} />
      {/* libSQL cylinder */}
      <motion.ellipse cx="120" cy="50" rx="20" ry="7" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" fill="rgba(139,92,246,0.06)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.4 }} />
      <motion.rect x="100" y="50" width="40" height="36" fill="rgba(139,92,246,0.05)" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5"
        initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }} style={{ transformOrigin: "120px 50px" }} />
      <motion.ellipse cx="120" cy="86" rx="20" ry="7" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" fill="rgba(139,92,246,0.08)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.3 }} />
      {/* Redis cylinder */}
      <motion.ellipse cx="180" cy="55" rx="18" ry="6" stroke="rgba(244,63,94,0.6)" strokeWidth="1.5" fill="rgba(244,63,94,0.06)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }} />
      <motion.rect x="162" y="55" width="36" height="30" fill="rgba(244,63,94,0.05)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5"
        initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }} style={{ transformOrigin: "180px 55px" }} />
      <motion.ellipse cx="180" cy="85" rx="18" ry="6" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" fill="rgba(244,63,94,0.08)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.78, duration: 0.3 }} />
      {/* Connection lines */}
      <motion.line x1="84" y1="67" x2="100" y2="68" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.65, duration: 0.3 }} />
      <motion.line x1="140" y1="68" x2="162" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.3 }} />
      {/* Labels */}
      <motion.text x="60" y="113" textAnchor="middle" fill="rgba(101,173,255,0.7)" fontSize="8" fontFamily="ui-monospace,monospace"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        Postgres
      </motion.text>
      <motion.text x="120" y="110" textAnchor="middle" fill="rgba(139,92,246,0.7)" fontSize="8" fontFamily="ui-monospace,monospace"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}>
        libSQL
      </motion.text>
      <motion.text x="180" y="107" textAnchor="middle" fill="rgba(244,63,94,0.7)" fontSize="8" fontFamily="ui-monospace,monospace"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
        Redis
      </motion.text>
      {/* Healthy check */}
      {healthy && (
        <motion.path d="M 50 65 L 58 73 L 70 58" stroke="rgba(16,185,129,0.9)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" fill="none"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
      )}
    </svg>
  );
}

function DoneSvg() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="h-36 w-full">
      {/* Success ring */}
      <motion.circle cx="100" cy="80" r="50" stroke="rgba(16,185,129,0.25)" strokeWidth="1"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
      <motion.circle cx="100" cy="80" r="38" stroke="rgba(16,185,129,0.45)" strokeWidth="1.5"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
      <motion.circle cx="100" cy="80" r="28" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.6)" strokeWidth="1.5"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
      {/* Check */}
      <motion.path d="M 87 80 L 97 90 L 116 68" stroke="rgba(16,185,129,1)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }} />
      {/* Celebration dots */}
      {[
        { x: 50, y: 40, color: "rgba(0,112,243,0.7)", delay: 0.6 },
        { x: 150, y: 35, color: "rgba(139,92,246,0.7)", delay: 0.65 },
        { x: 45, y: 120, color: "rgba(16,185,129,0.6)", delay: 0.7 },
        { x: 155, y: 115, color: "rgba(0,112,243,0.5)", delay: 0.68 },
        { x: 100, y: 20, color: "rgba(139,92,246,0.5)", delay: 0.72 },
        { x: 30, y: 75, color: "rgba(16,185,129,0.5)", delay: 0.75 },
        { x: 170, y: 75, color: "rgba(0,112,243,0.6)", delay: 0.73 },
      ].map((dot, i) => (
        <motion.circle key={i} cx={dot.x} cy={dot.y} r="4" fill={dot.color}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: dot.delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />
      ))}
    </svg>
  );
}

/* ─── Step progress bar ──────────────────────────────────────────────── */
function StepIndicator({ currentIndex, total }: { currentIndex: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "h-1 rounded-full transition-all",
            i === currentIndex
              ? "w-6 bg-[#0070f3]"
              : i < currentIndex
              ? "w-3 bg-[#0070f3]/40"
              : "w-3 bg-border",
          )}
          layout
          transition={{ duration: 0.25 }}
        />
      ))}
    </div>
  );
}

/* ─── Individual step content ────────────────────────────────────────── */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <WelcomeSvg />
      <div className="mt-5">
        <div className="mb-2 inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-[#65adff]" />
          Skytells Spark
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Build, meter, and deploy on Skytells.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Let's get your workspace configured in a few quick steps. We'll set up
          your API key and databases so you can start building immediately.
        </p>
      </div>
      <button
        onClick={onNext}
        className="mt-6 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
      >
        Get started
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

function ApiKeyStep({
  apiKey,
  onApiKeyChange,
  onNext,
  onSkip,
  serverConfigured,
}: {
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
  serverConfigured: boolean;
}) {
  const [validating, setValidating] = React.useState(false);
  const [valid, setValid] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canProceed = serverConfigured || (valid === true) || apiKey.trim().length > 10;

  async function validate() {
    if (!apiKey.trim()) return;
    setValidating(true);
    setError(null);
    setValid(null);
    try {
      const res = await fetch("/api/health", {
        headers: { "x-skytells-api-key": apiKey.trim() },
      });
      const data = (await res.json()) as { skytells?: { ok?: boolean }; ok?: boolean };
      const ok = Boolean(data?.skytells?.ok);
      setValid(ok);
      if (!ok) setError("API key didn't validate. Check your key and try again.");
    } catch {
      setError("Could not reach Skytells. Check your connection.");
      setValid(false);
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="flex flex-col">
      <ApiKeySvg validating={validating} valid={valid} />
      <div className="mt-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Connect your Skytells account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {serverConfigured
            ? "A server-side API key is already configured. You can skip this step."
            : "Paste your API key below. It's stored locally in your browser."}
        </p>
      </div>

      {serverConfigured ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Server API key detected — you're all set.
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <input
              value={apiKey}
              onChange={(e) => {
                onApiKeyChange(e.target.value);
                setValid(null);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void validate()}
              placeholder="sk-..."
              type="password"
              autoComplete="off"
              className={cn(
                "flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/50 focus:ring-1",
                valid === true
                  ? "border-emerald-500/50 focus:ring-emerald-500/30"
                  : valid === false
                  ? "border-destructive/50 focus:ring-destructive/30"
                  : "border-border focus:ring-ring/50",
              )}
            />
            <button
              onClick={() => void validate()}
              disabled={!apiKey.trim() || validating}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-sm transition hover:bg-accent disabled:opacity-40"
            >
              {validating ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
              Verify
            </button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs text-destructive"
            >
              {error}
            </motion.p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            <a
              href="https://console.skytells.ai/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Get an API key →
            </a>
          </p>
        </>
      )}

      <div className="mt-5 flex gap-2">
        {!serverConfigured && (
          <button
            onClick={onSkip}
            className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-secondary text-sm transition hover:bg-accent"
          >
            Skip for now
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
        >
          Continue
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function PostgresStep({
  health,
  onNext,
  onBack,
}: {
  health: { postgres: boolean; libsql: boolean; redis: boolean } | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const postgresOk = Boolean(health?.postgres);
  const libsqlOk = Boolean(health?.libsql);
  const redisOk = Boolean(health?.redis);
  const allOk = postgresOk && libsqlOk && redisOk;

  const services = [
    {
      name: "Postgres",
      ok: postgresOk,
      desc: "User accounts, billing, credit ledger, usage analytics, and SaaS data.",
      env: "DATABASE_URL or POSTGRES_URL",
      icon: <Database className="size-4" />,
      color: "text-[#65adff]",
    },
    {
      name: "libSQL",
      ok: libsqlOk,
      desc: "Builder state, chats, artifacts, MCP configs, and low-latency edge reads.",
      env: "LIBSQL_URL + LIBSQL_AUTH_TOKEN",
      icon: <Server className="size-4" />,
      color: "text-purple-400",
    },
    {
      name: "Redis",
      ok: redisOk,
      desc: "Generation state cache, SSE stream management, rate limiting, and fast counters.",
      env: "REDIS_URL",
      icon: <Server className="size-4" />,
      color: "text-rose-400",
    },
  ];

  return (
    <div className="flex flex-col">
      <DatabaseSvg healthy={allOk ? true : null} />
      <div className="mt-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Database setup
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Skytells Spark requires Postgres, libSQL, and Redis. Set the environment
          variables in your <code className="rounded bg-secondary px-1 py-0.5 text-xs">.env.local</code> file.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {services.map((svc) => (
          <div
            key={svc.name}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition",
              svc.ok
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-secondary/30",
            )}
          >
            <div className={cn("mt-0.5 shrink-0", svc.ok ? "text-emerald-400" : svc.color)}>
              {svc.ok ? <CheckCircle2 className="size-4" /> : svc.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{svc.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    svc.ok
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {svc.ok ? "connected" : "not connected"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{svc.desc}</p>
              {!svc.ok && (
                <code className="mt-1 block text-[10px] text-muted-foreground/70">
                  {svc.env}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>

      {!allOk && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          All three databases are required — generation is blocked until Postgres, libSQL, and Redis are connected.
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <button
          onClick={onBack}
          className="flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm transition hover:bg-accent"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
        >
          {allOk ? "Continue" : "Skip for now"}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <DoneSvg />
      <div className="mt-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          You're all set! 🎉
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your Skytells Spark workspace is ready. Start by describing what you
          want to build — apps, APIs, databases, workflows, and more.
        </p>
      </div>
      <div className="mt-4 grid w-full grid-cols-2 gap-2 text-left">
        {[
          { label: "AI Models", desc: "Text, image, video & audio" },
          { label: "Postgres", desc: "Persistent relational data" },
          { label: "libSQL", desc: "Edge & local-first state" },
          { label: "Deploys", desc: "One-click production deploys" },
        ].map((feat) => (
          <div
            key={feat.label}
            className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5">
              <Circle className="size-2 fill-[#0070f3] text-[#0070f3]" />
              <span className="text-xs font-medium text-foreground">{feat.label}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{feat.desc}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-6 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
      >
        Start building
        <Zap className="size-3.5" />
      </button>
    </div>
  );
}

/* ─── Main Onboarding Overlay ────────────────────────────────────────── */
interface OnboardingOverlayProps {
  onClose?: () => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  serverConfigured: boolean;
  health: { postgres: boolean; libsql: boolean; redis: boolean } | null;
}

// Allows any component to open the onboarding via a custom event
const OPEN_EVENT = "skytells:open-onboarding";
export function openOnboarding() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function OnboardingOverlay({
  onClose,
  apiKey,
  onApiKeyChange,
  serverConfigured,
  health,
}: OnboardingOverlayProps) {
  // Manage own open state — never causes parent rerender on toggle
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!window.localStorage.getItem("skytells-onboarding-done")) {
      setOpen(true);
    }
  }, []);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const currentStep = STEPS[stepIndex];

  // Listen for external open trigger (from TopBar button)
  React.useEffect(() => {
    const handler = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  function handleClose() {
    setOpen(false);
    window.localStorage.setItem("skytells-onboarding-done", "1");
    onClose?.();
  }

  function goNext() {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/80"
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[61] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_32px_80px_rgba(0,0,0,0.8)]">
              {/* Top gradient accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0070f3]/60 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2.5">
                  {STEPS.map((step, i) => (
                    <React.Fragment key={step.id}>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs transition",
                          i === stepIndex
                            ? "text-foreground font-medium"
                            : i < stepIndex
                            ? "text-[#0070f3]"
                            : "text-muted-foreground/40",
                        )}
                      >
                        <span className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[10px] transition",
                          i === stepIndex
                            ? "bg-foreground text-background"
                            : i < stepIndex
                            ? "bg-[#0070f3]/20 text-[#0070f3]"
                            : "bg-secondary text-muted-foreground/40",
                        )}>
                          {i < stepIndex ? <CheckCircle2 className="size-3" /> : i + 1}
                        </span>
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={cn("h-px w-4 transition", i < stepIndex ? "bg-[#0070f3]/40" : "bg-border")} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  aria-label="Close onboarding"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Step content */}
              <div className="relative overflow-hidden px-5 py-5">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -32 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {currentStep.id === "welcome" && (
                      <WelcomeStep onNext={goNext} />
                    )}
                    {currentStep.id === "apikey" && (
                      <ApiKeyStep
                        apiKey={apiKey}
                        onApiKeyChange={onApiKeyChange}
                        onNext={goNext}
                        onSkip={goNext}
                        serverConfigured={serverConfigured}
                      />
                    )}
                    {currentStep.id === "postgres" && (
                      <PostgresStep health={health} onNext={goNext} onBack={goBack} />
                    )}
                    {currentStep.id === "done" && (
                      <DoneStep onClose={handleClose} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer progress */}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <StepIndicator currentIndex={stepIndex} total={STEPS.length} />
                <span className="text-xs text-muted-foreground">
                  {stepIndex + 1} / {STEPS.length}
                </span>
              </div>

              {/* Bottom gradient accent */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0070f3]/30 to-transparent" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
