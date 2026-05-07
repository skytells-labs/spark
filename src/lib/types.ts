export type CodeFile = {
  path: string;
  language: string;
  content: string;
};

// ── UI / page-level types ──────────────────────────────────────────────────

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  steps?: AgentStep[];
  artifact?: Artifact;
  startedAt?: number;
  finishedAt?: number;
  usage?: SkytellsUsage;
  modelId?: string;
};

export type ChatMessageMetadata = {
  steps?: AgentStep[];
  startedAt?: number;
  finishedAt?: number;
  usage?: SkytellsUsage;
  modelId?: string;
  phase?: "timeline" | "timeline-note" | "final";
};

export type ChatAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  /** data URL like "data:image/png;base64,..." */
  dataUrl: string;
};

export type SkytellsUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type ModelOption = {
  id: string;
  name: string;
  type: string;
  source: string;
};

export type GenerationMode = "auto" | "ask" | "off";

export type AgentMode = "ask" | "plan" | "agent" | "design";

export type DesignContext = {
  description: string;
  figmaUrl?: string;
  /** Extracted real tokens from the Figma API */
  figmaExtract?: import("@/app/api/figma/extract/route").FigmaExtract | null;
  /** Personal Figma access token (optional — used when server has no FIGMA_ACCESS_TOKEN) */
  figmaToken?: string;
  /** base64 data-url of an uploaded PDF or image spec */
  specAttachment?: { filename: string; mediaType: string; dataUrl: string } | null;
};

export type MediaGenerationModes = {
  image: GenerationMode;
  video: GenerationMode;
  audio: GenerationMode;
};

export type MediaGenerationModels = {
  image: string;
  video: string;
  audio: string;
};

export type RuntimeConfig = {
  mcpEnabled: boolean;
  mediaGeneration: {
    modes: MediaGenerationModes;
    models: MediaGenerationModels;
  };
};

export type HealthStatus = {
  ok: boolean;
  skytells: { ok: boolean; message: string };
  saas: {
    enabled: boolean;
    ok: boolean;
    authProvider: "supabase" | "betterauth" | "disabled" | "unknown";
    billingProvider: "stripe" | "manual" | "disabled" | "unknown";
    message: string;
    requiredEnvironment: string[];
    tables: string[];
  };
  databases: {
    ok: boolean;
    libsql: { ok: boolean; message: string; latencyMs?: number };
    postgres: { ok: boolean; message: string; latencyMs?: number };
    redis: { ok: boolean; message: string; latencyMs?: number };
    redisRequired?: boolean;
  };
  requirements: {
    console: string;
    projects: string;
    databaseCreation: string;
    requiredEnvironment: string[];
    recommendedEnvironment?: string[];
  };
};

export type PersistedChat = {
  id: string;
  model: string;
  prompt: string;
  updatedAt: string;
  artifactCount: number;
};

export type LoadedChat = {
  id: string;
  model: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    metadata?: ChatMessageMetadata | null;
  }>;
  artifact: Artifact | null;
};

export type TodoItem = {
  id: string;
  label: string;
  status: "pending" | "in-progress" | "done" | "error";
};

export type AgentStep = {
  id: string;
  type: "reasoning" | "search" | "tool" | "file" | "deploy" | "todo" | "media";
  title: string;
  detail: string;
  status: "done" | "running" | "error";
  mediaKind?: "image" | "video" | "audio";
  mediaModel?: string;
  predictionId?: string;
  predictionStatus?: string;
  todos?: TodoItem[];
  sources?: Array<{
    url: string;
    label: string;
  }>;
};

export type TerminalCommand = {
  command: string;
  reason: string;
};

export type Artifact = {
  title: string;
  route: string;
  files: CodeFile[];
  previewHtml: string;
  databaseStatus: "connected" | "not-connected";
  databaseNote: string;
  terminalCommands?: TerminalCommand[];
  flowDiagram?: string;
};
