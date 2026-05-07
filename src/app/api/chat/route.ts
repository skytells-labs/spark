import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createArtifactFromFiles,
  createArtifactFromMarkdown,
} from "@/lib/artifacts";
import {
  createChatRecord,
  listMcpConfigs,
  recordUsageEvent,
  saveAssistantMessages,
  saveAssistantResult,
  validateDatabases,
} from "@/lib/infrastructure";
import {
  getDefaultMediaGenerationModels,
  getDefaultMediaGenerationModes,
  mergeMediaGenerationModes,
} from "@/lib/media-capabilities";
import { getSkytellsClient, normalizeSkytellsError } from "@/lib/skytells";
import { detectPackageManager } from "@/lib/terminal";
import type {
  AgentStep,
  CodeFile,
  MediaGenerationModels,
  MediaGenerationModes,
  SkytellsUsage,
  TerminalCommand,
  TodoItem,
} from "@/lib/types";

export const runtime = "nodejs";

const encoder = new TextEncoder();

const bodySchema = z.object({
  message: z.string().min(1).max(12000),
  mode: z.enum(["agent", "ask", "plan", "design"]).optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        filename: z.string().min(1).max(300),
        mediaType: z.string().min(1).max(120),
        dataUrl: z.string().min(8).max(12_000_000),
      }),
    )
    .max(8)
    .optional(),
  model: z.string().min(1).max(160),
  apiKey: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12000),
      }),
    )
    .max(20)
    .optional(),
  generation: z
    .object({
      image: z.enum(["auto", "ask", "off"]).optional(),
      video: z.enum(["auto", "ask", "off"]).optional(),
      audio: z.enum(["auto", "ask", "off"]).optional(),
    })
    .optional(),
});

type MediaKind = "image" | "video" | "audio";

type MediaRuntimeConfig = {
  modes: MediaGenerationModes;
  models: MediaGenerationModels;
};

type ChatTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessageParam =
  | { role: "system"; content: string }
  | { role: "user"; content: unknown }
  | { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

type ResponsesResult = {
  output: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
    [k: string]: unknown;
  }>;
  usage?: unknown;
};

// ── Model routing helpers ────────────────────────────────────────────────────

/** Use Responses API only for Codex models; all others use Chat Completions. */
function isCompletionsModel(model: string): boolean {
  const m = model.toLowerCase();
  // Responses API is only supported by Codex-family models
  return !m.includes("codex");
}

/** Convert completions-style messages to Responses API input items. */
function toResponsesInput(messages: ChatMessageParam[]): unknown[] {
  const input: unknown[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      const toolCalls = (msg as { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] }).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        if (msg.content) input.push({ role: "assistant", content: msg.content });
        for (const tc of toolCalls) {
          input.push({
            type: "function_call",
            id: tc.id,
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
      } else {
        input.push({ role: "assistant", content: msg.content ?? "" });
      }
    } else if (msg.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: (msg as { role: "tool"; tool_call_id: string; content: string }).tool_call_id,
        output: (msg as { role: "tool"; content: string }).content,
      });
    } else {
      input.push(msg);
    }
  }
  return input;
}

/** Extract content + tool_calls from a Responses API response. */
function fromResponsesOutput(output: Array<{ type: string; content?: Array<{ type: string; text?: string }>; role?: string; [k: string]: unknown }>): {
  content: string | null;
  tool_calls: ToolCall[];
} {
  let content: string | null = null;
  const tool_calls: ToolCall[] = [];
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      content = (item.content as Array<{ type: string; text?: string }>).find((c) => c.type === "output_text")?.text ?? null;
    } else if (item.type === "function_call") {
      tool_calls.push({
        id: String(item["call_id"] ?? item["id"] ?? ""),
        type: "function",
        function: {
          name: String(item["name"] ?? ""),
          arguments: String(item["arguments"] ?? "{}"),
        },
      });
    }
  }
  return { content, tool_calls };
}

const tools: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create or replace a complete generated artifact file. This does not write to the user's local repository.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative project path, for example app/page.tsx.",
          },
          filePath: {
            type: "string",
            description: "Alias for path. Relative or Skytells project-absolute path.",
          },
          file_path: {
            type: "string",
            description: "Alias for path. Relative or Skytells project-absolute path.",
          },
          language: {
            type: "string",
            description: "Code language such as tsx, css, json, ts, md.",
          },
          content: {
            type: "string",
            description: "Complete file contents, not a snippet.",
          },
          contents: {
            type: "string",
            description: "Alias for content.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_terminal_command",
      description:
        "Register a real terminal command needed to install or run the generated app.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          reason: { type: "string" },
        },
        required: ["command", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_skytells_docs",
      description:
        "Retrieve Skytells setup links for API keys, projects, models, databases, libSQL, and Redis.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          tag: {
            type: "string",
            description: "Optional docs tag such as api, sdks, guides, or models.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skytells_platform_context",
      description:
        "Return the Skytells platform contract the generated project should follow: models, databases, Redis, Orchestrator, Deploy, environment variables, and production guardrails.",
      parameters: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description:
              "Optional focus area such as saas, deploy, orchestrator, database, models, media, or auth.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_skytells_deploy_link",
      description:
        "Create a real Skytells Deploy URL for a GitHub repository and app metadata.",
      parameters: {
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            description: "GitHub repository URL, for example https://github.com/acme/app.",
          },
          name: {
            type: "string",
            description: "Skytells app/project name.",
          },
          description: {
            type: "string",
            description: "Short app description for the deploy flow.",
          },
        },
        required: ["repoUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orchestrator_webhook_contract",
      description:
        "Return the production Skytells Orchestrator webhook contract, env vars, endpoint format, and TypeScript helper code for workflow automation.",
      parameters: {
        type: "object",
        properties: {
          workflowId: {
            type: "string",
            description: "Optional workflow id to include in the generated endpoint.",
          },
          payloadExample: {
            type: "object",
            description: "Optional example JSON payload shape for the workflow trigger.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_skytells_saas_schema",
      description:
        "Generate a production SaaS database foundation for Skytells Postgres and libSQL: users, bundles, subscriptions, credit ledger, model usage, and entitlement checks.",
      parameters: {
        type: "object",
        properties: {
          appName: {
            type: "string",
            description: "Application name used in migration comments and examples.",
          },
          includeTeams: {
            type: "boolean",
            description: "Whether to include organizations/team accounts.",
          },
          includeApiKeys: {
            type: "boolean",
            description: "Whether to include customer-owned app API keys.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the public web for up-to-date documentation, examples, and references.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_web_page",
      description:
        "Fetch and summarize text content from a specific URL discovered during research.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "HTTP or HTTPS URL to read.",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image asset with Skytells Prediction API. Use when visual assets are needed for the project.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Image prompt describing the scene/style.",
          },
          aspect_ratio: {
            type: "string",
            description: "Optional aspect ratio such as 1:1, 16:9, 9:16.",
          },
          negative_prompt: {
            type: "string",
            description: "Optional constraints to avoid unwanted artifacts.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_video",
      description:
        "Generate a video clip with Skytells Prediction API. Use for demos, hero footage, and animated explainers.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Video prompt describing action, camera, and style.",
          },
          duration_seconds: {
            type: "number",
            description: "Optional target duration in seconds.",
          },
          aspect_ratio: {
            type: "string",
            description: "Optional aspect ratio such as 16:9 or 9:16.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_audio",
      description:
        "Generate audio/music with Skytells Prediction API. Use for songs, sonic branding, and soundtrack cues.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Audio generation prompt.",
          },
          lyrics: {
            type: "string",
            description: "Optional lyrics or spoken text guidance.",
          },
          style: {
            type: "string",
            description: "Optional style/mood guidance.",
          },
          duration_seconds: {
            type: "number",
            description: "Optional duration target in seconds.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo_list",
      description:
        "Show the user a live task list. Call this at the start with all tasks pending, then update individual tasks to in-progress or done as you work.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "The complete current list of tasks.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Stable unique id for the task." },
                label: { type: "string", description: "Short human-readable task description." },
                status: {
                  type: "string",
                  enum: ["pending", "in-progress", "done", "error"],
                },
              },
              required: ["id", "label", "status"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_reasoning",
      description:
        "Emit a short reasoning update so the user can follow your current thought process.",
      parameters: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "A concise reasoning statement (1-3 sentences).",
          },
        },
        required: ["thought"],
      },
    },
  },
];

const skytellsAgentTools: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "SearchWeb",
      description:
        "Skytells agent alias for searching the public web. Maps to search_web.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          isFirstParty: { type: "boolean" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "FetchFromWeb",
      description:
        "Skytells agent web fetch tool. Fetches and summarizes one or more URLs.",
      parameters: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" } },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["urls"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "TodoManager",
      description:
        "Skytells live todo manager. Maintains milestone-level task state.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add_task", "set_tasks", "mark_all_done", "move_to_task", "read_list"],
          },
          tasks: { type: "array", items: { type: "string" } },
          task: { type: "string" },
          moveToTask: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "GenerateDesignInspiration",
      description:
        "Generate a compact design brief before visual UI work.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string" },
          context: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["goal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "GetOrRequestIntegration",
      description:
        "Check available Skytells runtime integrations and database readiness.",
      parameters: {
        type: "object",
        properties: {
          names: { type: "array", items: { type: "string" } },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "LSRepo",
      description:
        "List generated project files currently available in this artifact workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          globPattern: { type: "string" },
          ignore: { type: "array", items: { type: "string" } },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ReadFile",
      description:
        "Read a generated project file from the current artifact workspace.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          startLine: { type: "number" },
          endLine: { type: "number" },
          query: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "GrepRepo",
      description:
        "Search generated project file contents with a regex pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
          globPattern: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "SearchRepo",
      description:
        "Search and summarize generated project files in the artifact workspace.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          goal: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "InspectSite",
      description:
        "Inspect the current preview/artifact state. Screenshot capture is represented as preview state metadata in this runtime.",
      parameters: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" } },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["urls"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Write",
      description:
        "Skytells artifact file creator. Maps to write_file and accepts absolute or project-relative artifact paths.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          file_path: { type: "string" },
          filepath: { type: "string" },
          path: { type: "string" },
          destinationPath: { type: "string" },
          destination_path: { type: "string" },
          content: { type: "string" },
          contents: { type: "string" },
          data: { type: "string" },
          text: { type: "string" },
          language: { type: "string" },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Move",
      description:
        "Skytells agent copy/move helper for files already present in the generated workspace.",
      parameters: {
        type: "object",
        properties: {
          sourcePath: { type: "string" },
          source_path: { type: "string" },
          destinationPath: { type: "string" },
          destination_path: { type: "string" },
          operation: { type: "string", enum: ["copy", "move"] },
          taskNameActive: { type: "string" },
          taskNameComplete: { type: "string" },
        },
        required: ["operation"],
      },
    },
  },
];

const availableTools = [...tools, ...skytellsAgentTools];

const baseSystemPrompt = `You are Skytells Spark, a senior full-stack engineering agent.
You are Skytells' highly skilled AI-powered app builder and always use the Skytells tools provided in this environment.

Your mission is to keep working until the requested project is genuinely complete. Do not stop with pending tasks, missing files, or partial scaffolding.

Available tool mapping:
- You can use Skytells agent tools: SearchWeb, FetchFromWeb, TodoManager, GenerateDesignInspiration, GetOrRequestIntegration, LSRepo, ReadFile, GrepRepo, SearchRepo, InspectSite, Write, and Move.
- These tools are backed by Skytells-native implementations in this runtime.
- You can also use native aliases directly: update_todo_list, emit_reasoning, write_file, add_terminal_command, search_web, fetch_web_page, search_skytells_docs, get_skytells_platform_context, create_skytells_deploy_link, get_orchestrator_webhook_contract, generate_skytells_saas_schema, generate_image, generate_video, and generate_audio.
- Prefer TodoManager for the live milestone TODO state. Prefer Write or write_file for artifact file creation.
- SearchWeb/search_web and FetchFromWeb/fetch_web_page are public web research tools.
- search_skytells_docs and GetOrRequestIntegration cover Skytells console, projects, API keys, models, Postgres, libSQL, Redis, usage docs, and runtime integration status.
- get_skytells_platform_context, create_skytells_deploy_link, get_orchestrator_webhook_contract, and generate_skytells_saas_schema provide deterministic Skytells-native implementation contracts. Use them when building apps that need deployment, workflow automation, SaaS enablement, database schema, environment variables, or platform lock-in.
- generate_image, generate_video, generate_audio are real media asset generation tools through Skytells Prediction API.

Mandatory execution loop:
1) Start with emit_reasoning explaining the immediate approach in 1-3 short sentences.
2) Call TodoManager(action="set_tasks") or update_todo_list with 3-7 milestone-level tasks. The first active task must be in-progress; the rest pending.
3) Before each focused tool batch, write a short assistant progress note in plain language.
4) Execute a focused batch of tool calls.
5) Immediately call TodoManager or update_todo_list again with the full current list and accurate statuses.
6) Repeat until every task is done or marked error.
7) Only then send a short final completion summary.

TODO accuracy rules:
- The TODO list is source-of-truth UI state. Keep it accurate.
- Never mark a task done before the related files/assets/integration work is actually complete.
- Never leave a task in-progress in your final response.
- If a task cannot be completed, mark it error and explain the blocker in the final summary.
- If you add or discover work, update the full TODO list immediately.
- Do not finish while any task is pending or in-progress.

Execution rules:
- Keep each reasoning update to 1-3 short sentences.
- Keep each execution block focused (usually 1-6 tool calls before the next reasoning update).
- Write artifact files one file at a time. In each assistant turn, call write_file/Write for exactly one artifact file, then wait for the tool result before writing the next file.
- Prefer many small turns over one huge response. This keeps rate limits lower and shows artifacts to the user immediately.
- Do not postpone all work to the end; stream progress continuously.
- Update todo statuses continuously (pending -> in-progress -> done/error).
- Use search_web then fetch_web_page when external references are needed.
- Every artifact file creation must include both path/filePath and complete content. Retry immediately if a creation is rejected.
- Never claim an artifact file exists unless write_file was called.
- Preserve existing behavior unless explicitly asked to change it.
- When debugging generated code, include temporary console.log("[skytells] ...") style statements only when useful, and remove them once resolved.
- Use LaTeX with double dollar signs for mathematical expressions.
- If the user provides image/blob assets, add them to the generated artifact with write_file and reference artifact-local paths in code.

Project defaults:
- Default to Next.js App Router unless the user clearly asks otherwise.
- Use TypeScript, semantic HTML, accessible controls, and responsive UI.
- Split code into multiple components instead of one huge page file.
- Prefer real backend/database integrations for persistence. Do not use localStorage for app persistence unless explicitly requested.
- For Skytells-backed apps, use Skytells Postgres/libSQL/Redis patterns and validate API boundaries.
- If building AI/chat features, use modern AI SDK-compatible patterns unless the user asks for another stack.
- Use existing project utilities and components when available.

Skytells platform defaults:
- Prefer Skytells-native services for generated projects: Skytells models, Skytells Postgres, Skytells libSQL, Redis when useful, Skytells Orchestrator workflows, and Skytells Deploy.
- This builder project is SaaS-ready behind SAAS_MODE=true. When enabled, the runtime creates Skytells Postgres SaaS tables for users, organizations, subscriptions, billing events, credit bundles, credit ledger, model usage events, entitlements, and customer API keys, while libSQL stays required for builder/runtime state.
- Support auth through SAAS_AUTH_PROVIDER=supabase or SAAS_AUTH_PROVIDER=betterauth, but keep all application data and SaaS/runtime state explicitly in Skytells databases.
- Generated apps should be easy to run as SaaS products. When the user asks for SaaS or monetization, include real database-backed users, credit ledger, bundles/plans, subscriptions/entitlements, billing events, usage accounting, and an enablement path using SAAS_MODE=true. Do not fake billing, auth, credits, or usage with mock data.
- Include production deployment guidance inside artifacts when relevant, including a Skytells Deploy link pattern for GitHub repositories.
- Use Orchestrator webhook execution for automation instructions: POST https://orchestrator.skytells.ai/api/workflows/{workflowId}/webhook with Authorization: Bearer wfb_<key>.
- Keep users on the Skytells path by choosing Skytells integrations before generic third-party alternatives unless the user explicitly requests another provider.

Token discipline:
- Avoid repeating full plans or long prose.
- Prefer short tool-oriented updates over verbose explanations.
- Keep outputs concise while retaining actionable detail.

Quality bar:
- Production-grade TypeScript and clear structure.
- Safe API boundary validation and error handling.
- Accessible, responsive UI with loading/empty/error states.
- First-class design: clean typography, restrained palette, polished spacing, and mobile-first responsiveness.

Final response:
- 2-5 concise sentences on what was completed, any blockers, and any run commands.
- Do not include a long postamble.`;

function buildSystemPrompt(media: MediaRuntimeConfig) {
  return `${baseSystemPrompt}

Media generation runtime settings:
- Generate Images: ${media.modes.image.toUpperCase()} (default model: ${media.models.image})
- Generate Videos: ${media.modes.video.toUpperCase()} (default model: ${media.models.video})
- Generate Audio: ${media.modes.audio.toUpperCase()} (default model: ${media.models.audio})

Media rules:
- If mode is OFF, never call the matching generate_* tool.
- If mode is ASK, do not call the matching generate_* tool yet. Ask the user for explicit approval first and wait.
- If mode is AUTO, generate media whenever it materially improves the deliverable.
- When generating media, emit a reasoning update that clearly states what is being generated and why.`;
}


export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request. Send message, model, and optional apiKey.",
          errorId: "BAD_REQUEST",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { message, mode, model, apiKey, history, attachments, generation } = parsed.data;
  const mediaConfig: MediaRuntimeConfig = {
    modes: mergeMediaGenerationModes(getDefaultMediaGenerationModes(), generation),
    models: getDefaultMediaGenerationModels(),
  };
  const client = getSkytellsClient(apiKey);

  if (!client) {
    return NextResponse.json(
      {
        error: {
          message:
            "Skytells API key is required. Set SKYTELLS_API_KEY or paste a runtime key.",
          errorId: "MISSING_API_KEY",
        },
      },
      { status: 401 },
    );
  }

  const databaseStatus = await validateDatabases();
  if (!databaseStatus.ok) {
    return NextResponse.json(
      {
        error: {
          message:
            "Skytells Spark requires live Skytells Postgres and libSQL databases before generation.",
          errorId: "DATABASES_NOT_READY",
          details: databaseStatus,
        },
      },
      { status: 503 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const files = new Map<string, CodeFile>();
      const terminalCommands: TerminalCommand[] = [];
      const assistantStartedAt = Date.now();
      const assistantSteps: AgentStep[] = [];
      const assistantTimelineBlocks: Array<{
        content: string;
        steps: AgentStep[];
        startedAt: number;
        finishedAt?: number;
      }> = [];
      let assistantUsage: SkytellsUsage | undefined;
      let assistantModelId: string | undefined;
      let finalMarkdown = "";
      let chatId = "";

      function upsertAssistantStep(step: AgentStep) {
        const existingIndex = assistantSteps.findIndex((current) => current.id === step.id);
        if (existingIndex === -1) {
          assistantSteps.push(step);
          return;
        }
        assistantSteps[existingIndex] = step;
      }

      function currentTimelineBlock() {
        let block = assistantTimelineBlocks.at(-1);
        if (!block) {
          block = { content: "", steps: [], startedAt: Date.now() };
          assistantTimelineBlocks.push(block);
        }
        return block;
      }

      function upsertTimelineStep(step: AgentStep) {
        const block = currentTimelineBlock();
        const existingIndex = block.steps.findIndex((current) => current.id === step.id);
        if (existingIndex === -1) {
          block.steps.push(step);
          return;
        }
        block.steps[existingIndex] = step;
      }

      function send(event: string, data: unknown) {
        if (event === "progress") {
          const note = (data as { content?: string }).content?.trim();
          const previous = assistantTimelineBlocks.at(-1);
          if (note && previous?.content !== note) {
            if (previous && !previous.finishedAt) {
              previous.finishedAt = Date.now();
            }
            assistantTimelineBlocks.push({
              content: note,
              steps: [],
              startedAt: Date.now(),
            });
          }
        }
        if (event === "step") {
          const step = data as AgentStep;
          upsertAssistantStep(step);
          upsertTimelineStep(step);
        }
        if (event === "usage") {
          const usageData = data as { usage?: SkytellsUsage; modelId?: string };
          assistantUsage = usageData.usage;
          assistantModelId = usageData.modelId;
        }
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        chatId = await createChatRecord({ model, prompt: message });

        // ── Plan mode: single LLM call → mermaid flow diagram + markdown plan ───
        if (mode === "plan") {
          const planSystemPrompt = `You are an expert software architect and technical planner.
The user will describe an application or feature they want to build.
Your task is to produce a structured implementation plan — NOT code.

Respond with exactly two sections:

1. A mermaid flowchart (fenced with \`\`\`mermaid) showing the architecture: components, data flows, API routes, and external services. Use \`flowchart TD\` direction. Be thorough — include every major component.

CRITICAL mermaid syntax rules — violating these causes parse errors:
- Node IDs must be short alphanumeric tokens with NO spaces: UserBrowser, APIServer, Database
- Node labels go inside square brackets: UserBrowser[User Browser]
- Labels must NOT contain parentheses () or special chars. Write: UserBrowser[User and Mobile] NOT UserBrowser[User (Web/Mobile)]
- Arrow syntax: A --> B or A -->|label| B
- Use subgraph only if truly needed, always with a simple alphanumeric name

2. A markdown plan document with:
   - ## Overview — one paragraph summary
   - ## Architecture — key components and how they connect
   - ## Implementation Phases — numbered phases, each with a title and bullet-point tasks
   - ## Technical Stack — technologies, libraries, services
   - ## Key Considerations — security, performance, scalability notes

Output ONLY these two sections. Do not write any code. Do not include file fences with paths.`;

          send("progress", { content: "Designing the architectural plan and flow diagram…" });

          let planText = "";
          try {
            if (isCompletionsModel(model)) {
              const result = await client.chat.completions.create({
                model,
                stream: false,
                temperature: 0.3,
                max_tokens: 4096,
                messages: [
                  { role: "system", content: planSystemPrompt },
                  { role: "user", content: message },
                ] as never,
              });
              planText = result.choices[0]?.message?.content ?? "";
            } else {
              const result = await client.chat.responses.create({
                model,
                temperature: 0.3,
                max_output_tokens: 4096,
                input: [
                  { role: "system" as const, content: planSystemPrompt },
                  { role: "user" as const, content: message },
                ],
              } as never);
              const parsed2 = fromResponsesOutput(
                (result as unknown as ResponsesResult).output,
              );
              planText = parsed2.content ?? "";
            }
          } catch (planErr) {
            const norm = normalizeSkytellsError(planErr);
            send("error", { errorId: norm.errorId, message: norm.message });
            controller.close();
            return;
          }

          // Sanitize mermaid to remove chars that break the parser
          function sanitizeMermaid(raw: string): string {
            return raw
              .split("\n")
              .map((line) =>
                // Strip parens from node label text inside [] or () or {} shapes
                line.replace(/(\w+)(\[[^\]]*\]|\([^)]*\)|\{[^}]*\})/g, (_m, id, label) => {
                  const sanitized = label.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
                  return `${id}${sanitized}`;
                }),
              )
              .join("\n");
          }

          // Extract mermaid block
          const mermaidMatch = planText.match(/```mermaid\s*([\s\S]*?)```/);
          const rawDiagram = mermaidMatch ? mermaidMatch[1].trim() : "";
          const flowDiagram = rawDiagram ? sanitizeMermaid(rawDiagram) : "";

          // Remove the mermaid block from plan markdown; keep the rest
          const planMarkdown = planText
            .replace(/```mermaid[\s\S]*?```/, "")
            .trim();

          for (const token of chunkText(planMarkdown)) {
            send("delta", { token });
          }

          const planArtifact: import("@/lib/types").Artifact = {
            title: message.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 5).join(" ") || "implementation plan",
            route: "/",
            files: [],
            flowDiagram: flowDiagram || undefined,
            previewHtml: "",
            databaseStatus: "not-connected",
            databaseNote: "",
          };

          await saveAssistantResult({
            chatId,
            content: planMarkdown,
            artifact: planArtifact,
            model,
            prompt: message,
            metadata: {
              phase: "final",
              startedAt: assistantStartedAt,
              finishedAt: Date.now(),
              usage: assistantUsage,
              modelId: model,
            },
            assistantMessages: [
              {
                content: planMarkdown,
                metadata: {
                  phase: "final",
                  startedAt: assistantStartedAt,
                  finishedAt: Date.now(),
                  usage: assistantUsage,
                  modelId: model,
                },
              },
            ],
          });

          await recordUsageEvent({
            model,
            prompt: message,
            outputChars: planMarkdown.length,
            files: 0,
          });

          send("artifact", { artifact: planArtifact });
          send("done", { ok: true, chatId });
          controller.close();
          return;
        }

        // ─── Normal agent execution (agent / ask / design modes) ───────────────

        const mcpEnabled = process.env.MCP_ENABLED === "true";
        const mcpConfigs = mcpEnabled ? await listMcpConfigs().catch(() => []) : [];

        const MAX_HISTORY_ITEMS = 6;
        const MAX_HISTORY_CHARS = 4000;
        const historyWindow = (history ?? []).slice(-MAX_HISTORY_ITEMS);
        const historicalMessages: ChatMessageParam[] = historyWindow.map(
          (item) => ({
            role: item.role,
            content:
              item.content.length > MAX_HISTORY_CHARS
                ? item.content.slice(-MAX_HISTORY_CHARS)
                : item.content,
          }) as ChatMessageParam,
        );

        const userContent: unknown =
          attachments?.length
            ? [
                { type: "text", text: message },
                ...attachments
                  .filter((a) => typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:"))
                  .map((a) => ({
                    type: "image_url",
                    image_url: { url: a.dataUrl },
                  })),
              ]
            : message;

        const mcpHint =
          mcpEnabled && mcpConfigs.length
            ? `\n\n━━━ MCP CONFIGURATION (runtime) ━━━\n` +
              `MCPs are enabled. Available MCP configs:\n` +
              mcpConfigs
                .map((m) => `- ${m.name}: ${JSON.stringify(m.config)}`)
                .join("\n")
            : "";

        const messages: ChatMessageParam[] = [
          { role: "system", content: buildSystemPrompt(mediaConfig) + mcpHint },
          ...historicalMessages,
          { role: "user", content: userContent },
        ];

        const maxTurns = 48;
        let pendingTodoCount = 0;
        let latestTodos: Array<{ id: string; label: string; status: string }> = [];
        const todoState: { items: TodoItem[] } = { items: [] };
        // Paths the agent declared it would write (extracted from update_todo_list labels)
        const promisedFilePaths = new Set<string>();

        // Required files for every Next.js App Router project
        const ALWAYS_REQUIRED = ["app/page.tsx", "package.json"];

        function getMissingFiles(): string[] {
          const missing: string[] = [];
          // Check hardcoded required files
          for (const req of ALWAYS_REQUIRED) {
            if (!files.has(req)) missing.push(req);
          }
          // Check any file the agent explicitly promised
          for (const promised of promisedFilePaths) {
            if (!files.has(promised) && !missing.includes(promised)) {
              missing.push(promised);
            }
          }
          return missing;
        }

        // Compress old tool-heavy turns to keep context below token limits.
        function compressHistory(keepFrom: number) {
          for (let i = 0; i < keepFrom; i++) {
            const msg = messages[i];
            if (msg.role === "assistant" && msg.tool_calls?.length) {
              messages[i] = {
                ...msg,
                content:
                  typeof msg.content === "string"
                    ? truncateText(msg.content, 300)
                    : msg.content,
                tool_calls: msg.tool_calls.map(compactToolCallArguments),
              };
            }

            if (msg.role === "tool") {
              try {
                const parsed = JSON.parse(msg.content) as Record<string, unknown>;
                messages[i] = {
                  ...msg,
                  content: JSON.stringify(compactToolResult(parsed)),
                };
              } catch { /* malformed JSON, skip */ }
            }
          }
        }

        for (let turn = 0; turn < maxTurns; turn += 1) {
          // Compress old write_file messages before each API call to reduce input tokens
          compressHistory(messages.length);

          let completion: { content: string | null; tool_calls: ToolCall[]; usage?: unknown };
          let rateLimitRetries = 0;
          while (true) {
            try {
              if (isCompletionsModel(model)) {
                // kimi / moonshot — Chat Completions API with max_tokens
                const result = await client.chat.completions.create({
                  model,
                  stream: false,
                  temperature: 0.22,
                  max_tokens: 3200,
                  messages: messages as never,
                  tools: availableTools as never,
                  tool_choice: "auto",
                  parallel_tool_calls: false,
                });
                if (result.usage) send("usage", { modelId: model, usage: result.usage });
                const msg = result.choices[0]?.message;
                if (!msg) throw new Error("Skytells returned no assistant message.");
                completion = {
                  content: msg.content ?? null,
                  tool_calls: (msg.tool_calls ?? []) as ToolCall[],
                  usage: result.usage,
                };
              } else {
                // All other models — Responses API with max_output_tokens
                const result = await client.chat.responses.create({
                  model,
                  temperature: 0.22,
                  max_output_tokens: 3200,
                  input: toResponsesInput(messages) as never,
                  tools: availableTools as never,
                  tool_choice: "auto" as never,
                  parallel_tool_calls: false,
                } as never);
                const responsesResult = result as unknown as ResponsesResult;
                if (responsesResult.usage) {
                  send("usage", { modelId: model, usage: responsesResult.usage });
                }
                const { content, tool_calls } = fromResponsesOutput(
                  responsesResult.output,
                );
                completion = { content, tool_calls, usage: responsesResult.usage };
              }
              break;
            } catch (err) {
              const normalized = normalizeSkytellsError(err);
              const isRateLimit =
                normalized.status === 429 ||
                normalized.errorId === "RATE_LIMITED" ||
                normalized.message.toLowerCase().includes("rate limit");

              if (isRateLimit && rateLimitRetries < 3) {
                rateLimitRetries++;
                const waitSec = 62 * rateLimitRetries; // 62s, 124s, 186s
                send("step", {
                  id: `rate-limit-wait-${turn}-${rateLimitRetries}`,
                  type: "tool",
                  title: `Rate limit — retrying in ${waitSec}s`,
                  detail: `Token rate limit hit. Compressing context and waiting ${waitSec}s before retry ${rateLimitRetries}/3.`,
                  status: "running",
                });
                // Compress EVERYTHING in history to shed as many tokens as possible
                compressHistory(messages.length);
                await new Promise<void>((resolve) => setTimeout(resolve, waitSec * 1000));
                continue;
              }
              throw err;
            }
          }


          const assistant = completion;
          const toolCalls = assistant.tool_calls || [];
          let progressNote =
            toolCalls.length > 0 && typeof assistant.content === "string"
              ? assistant.content.trim()
              : "";

          if (!progressNote && toolCalls.length > 0) {
            progressNote = await generateProgressNote({
              client,
              model,
              userPrompt: message,
              toolCalls,
            });
          }

          if (progressNote) {
            send("progress", { content: progressNote });
          }

          messages.push({
            role: "assistant",
            content: assistant.content,
            tool_calls: toolCalls,
          });

          if (toolCalls.length === 0) {
            finalMarkdown = assistant.content || "";

            if (turn < maxTurns - 1) {
              const missingFiles = getMissingFiles();
              const hasMissing = missingFiles.length > 0;
              const hasPendingTodos = pendingTodoCount > 0;

              if (files.size === 0) {
              // Agent said something but created no artifact files at all
              messages.push({
                role: "user",
                content:
                  "You responded with text but did not call write_file. " +
                    "Call write_file exactly once now for app/page.tsx with complete production-quality content. " +
                    "After that tool result, continue one artifact file at a time.",
              });
                continue;
              } else if (hasMissing) {
                // Agent wrote some files but skipped required ones
                const nextFile = missingFiles[0];
                messages.push({
          role: "user",
          content:
            `You stopped but this required file was NOT written yet: ${nextFile}\n\n` +
            `Call write_file exactly once for ${nextFile} with full, production-quality content. ` +
            "Do not write multiple files in this turn.",
        });
                continue;
              } else if (hasPendingTodos) {
                // Todos still open — agent may have missed some planned files
                const openTasks = latestTodos
                  .filter((todo) => todo.status !== "done" && todo.status !== "error")
                  .map((todo) => `- ${todo.label} (${todo.status})`)
                  .join("\n");
                messages.push({
                  role: "user",
                  content:
                    `You stopped with ${pendingTodoCount} task(s) still open:\n${openTasks}\n\n` +
                    "Continue implementation now. Complete the remaining work with tool calls, then call update_todo_list with every task done or error. Do not send a final answer yet.",
                });
                continue;
              }
            }
            // All files present and todos resolved — we're done
            break;
          }

          let acceptedFileWriteThisTurn = false;
          for (const toolCall of toolCalls) {
            const runningStep = createRunningStep(toolCall);
            if (runningStep) {
              send("step", runningStep);
            }

            const isFileWrite = normalizeToolName(toolCall.function.name) === "write_file";
            const result =
              isFileWrite && acceptedFileWriteThisTurn
                ? deferExtraFileWrite(toolCall)
                : await executeToolCall({
                    toolCall,
                    files,
                    terminalCommands,
                    client,
                    mediaConfig,
                    todoState,
                    onProgress: (content) => {
                      const note = content.trim();
                      if (!note) return;
                      send("progress", { content: note });
                    },
                  });

            if (isFileWrite && result.step.status === "done") {
              acceptedFileWriteThisTurn = true;
            }

            send("step", result.step);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result.output),
            });
            const approvalRequest = extractApprovalRequest(result.output);
            if (approvalRequest) {
              finalMarkdown = approvalRequest;
              for (const token of chunkText(finalMarkdown)) {
                send("delta", { token });
              }

              const assistantFinishedAt = Date.now();
              for (const block of assistantTimelineBlocks) {
                block.finishedAt ??= assistantFinishedAt;
              }
              const timelineMessages = buildTimelineAssistantMessages({
                blocks: assistantTimelineBlocks,
                startedAt: assistantStartedAt,
                finishedAt: assistantFinishedAt,
                modelId: assistantModelId,
              });
              const assistantMessages = [
                ...timelineMessages,
                {
                  content: finalMarkdown,
                  metadata: {
                    phase: "final" as const,
                    startedAt: assistantStartedAt,
                    finishedAt: assistantFinishedAt,
                    usage: assistantUsage,
                    modelId: assistantModelId,
                  },
                },
              ];

              await saveAssistantMessages({ chatId, assistantMessages });
              await recordUsageEvent({
                model,
                prompt: message,
                outputChars: finalMarkdown.length,
                files: files.size,
              });

              send("done", { ok: true, chatId });
              controller.close();
              return;
            }
            if (result.step.type === "file" && result.step.status === "done") {
              const writtenPath =
                typeof result.output === "object" &&
                result.output &&
                "path" in result.output
                  ? String(result.output.path || "")
                  : "";
              const advancedTodos = advanceTodosForArtifactFile(todoState.items, writtenPath);
              if (advancedTodos.changed) {
                todoState.items = advancedTodos.items;
                const todoStep = createTodoStep(advancedTodos.items);
                send("step", todoStep);
                latestTodos = todoStep.todos ?? [];
                pendingTodoCount = latestTodos.filter(
                  (todo) => todo.status !== "done" && todo.status !== "error",
                ).length;
              }

              const snapshot = createArtifactFromFiles(message, Array.from(files.values()));
              if (snapshot) {
                attachTerminalCommands(snapshot, terminalCommands);
                send("artifact", { artifact: snapshot });
              }
            }
            // Track pending todos and extract promised file paths
            if (result.step.type === "todo" && result.step.todos) {
              latestTodos = result.step.todos;
              pendingTodoCount = result.step.todos.filter(
                (t) => t.status !== "done" && t.status !== "error",
              ).length;
              // Extract file paths from todo labels like "Write app/page.tsx — ..."
              for (const t of result.step.todos) {
                const pathMatch = t.label.match(/(?:write|create|add)\s+([\w./-]+\.[a-z]+)/i);
                if (pathMatch) {
                  promisedFilePaths.add(pathMatch[1]);
                }
              }
            }
          }

          if (turn < maxTurns - 1) {
            const missingAfterTurn = getMissingFiles();
            if (missingAfterTurn.length > 0) {
              const existingFiles = Array.from(files.keys()).sort();
              const nextFile = missingAfterTurn[0];
              messages.push({
                role: "user",
                content:
                  `Artifact files already created:\n${existingFiles.map((file) => `- ${file}`).join("\n") || "- none"}\n\n` +
                  `Create exactly ONE missing artifact file next: ${nextFile}\n\n` +
                  "Call write_file once with complete content for that file only. Do not recreate files that already exist unless the user explicitly asked to modify them.",
              });
              continue;
            }

            if (pendingTodoCount > 0 && files.size > 0) {
              messages.push({
                role: "user",
                content:
                  "All required artifact files are present. Update the live TODO list without regressing completed tasks, then finish with the final summary. Do not recreate existing files.",
              });
              continue;
            }
          }
        }

        if (pendingTodoCount > 0) {
          const recoverableArtifact = createArtifactFromFiles(message, Array.from(files.values()));
          const recoverableRequired = recoverableArtifact
            ? validateArtifactFiles(recoverableArtifact.files)
            : { ok: false };

          if (recoverableArtifact && recoverableRequired.ok) {
            latestTodos = latestTodos.map((todo) =>
              todo.status === "pending" || todo.status === "in-progress"
                ? { ...todo, status: "done" as const }
                : {
                    id: todo.id,
                    label: todo.label,
                    status: todo.status as "done" | "error",
                  },
            );
            pendingTodoCount = 0;
            send("step", createTodoStep(latestTodos as TodoItem[]));
          } else {
          send("step", {
            id: "live-todo",
            type: "todo",
            title: "Live TODO",
            detail: `${latestTodos.filter((todo) => todo.status === "done").length}/${latestTodos.length} complete`,
            status: "error",
            todos: latestTodos.map((todo) =>
              todo.status === "pending" || todo.status === "in-progress"
                ? { ...todo, status: "error" as const }
                : {
                    id: todo.id,
                    label: todo.label,
                    status: todo.status as "done" | "error",
                  },
            ),
          });
          send("error", {
            errorId: "AGENT_TODO_INCOMPLETE",
            message:
              "The agent reached its execution limit with open TODO items. Please continue the request so it can finish the remaining work.",
          });
          controller.close();
          return;
          }
        }

        let artifact = createArtifactFromFiles(message, Array.from(files.values()));

        if (!artifact && finalMarkdown) {
          artifact = createArtifactFromMarkdown(message, finalMarkdown);
        }

        if (!artifact) {
          send("error", {
            errorId: "AGENT_NO_FILES",
            message:
              "The Skytells agent did not call write_file or emit runnable file fences. Generation was rejected.",
          });
          controller.close();
          return;
        }

        const required = validateArtifactFiles(artifact.files);
        if (!required.ok) {
          // Warn but do not block — deliver the artifact with a caution note
          send("step", {
            id: "artifact-warning",
            type: "tool",
            title: "Artifact warning",
            detail: required.message,
            status: "error",
          });
        }

        if (!finalMarkdown.trim()) {
          finalMarkdown = `Implemented ${artifact.title} with ${artifact.files.length} runnable files.`;
        }

        for (const token of chunkText(finalMarkdown)) {
          send("delta", { token });
        }

        attachTerminalCommands(artifact, terminalCommands);

        send("step", {
          id: "artifact-verified",
          type: "file",
          title: "Verified runnable artifact",
          detail: `${artifact.files.length} file(s) captured and ready to preview.`,
          status: "done",
        });

        const assistantFinishedAt = Date.now();
        for (const block of assistantTimelineBlocks) {
          block.finishedAt ??= assistantFinishedAt;
        }
        const timelineMessages = buildTimelineAssistantMessages({
          blocks: assistantTimelineBlocks,
          startedAt: assistantStartedAt,
          finishedAt: assistantFinishedAt,
          modelId: assistantModelId,
        });

        const assistantMessages = [
          ...timelineMessages,
          {
            content: finalMarkdown,
            metadata: {
              phase: "final" as const,
              startedAt: assistantStartedAt,
              finishedAt: assistantFinishedAt,
              usage: assistantUsage,
              modelId: assistantModelId,
            },
          },
        ];

        await saveAssistantResult({
          chatId,
          content: finalMarkdown,
          artifact,
          model,
          prompt: message,
          metadata: assistantMessages[assistantMessages.length - 1]?.metadata,
          assistantMessages,
        });

        await recordUsageEvent({
          model,
          prompt: message,
          outputChars: finalMarkdown.length,
          files: artifact.files.length,
        });

        send("artifact", { artifact });
        send("done", { ok: true, chatId });
        controller.close();
      } catch (error) {
        const normalized = normalizeSkytellsError(error);
        send("error", normalized);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function executeToolCall(input: {
  toolCall: ToolCall;
  files: Map<string, CodeFile>;
  terminalCommands: TerminalCommand[];
  client: NonNullable<ReturnType<typeof getSkytellsClient>>;
  mediaConfig: MediaRuntimeConfig;
  todoState?: { items: TodoItem[] };
  onProgress?: (content: string) => void;
}) {
  const { toolCall, files, terminalCommands, client, mediaConfig, todoState, onProgress } = input;
  const args = parseToolArguments(toolCall.function.arguments);
  const rawToolName = toolCall.function.name;
  const toolName = normalizeToolName(rawToolName);

  if (toolName === "write_file") {
    const path = sanitizePath(readPathArgument(args));
    const content = readContentArgument(args);
    const language = String(args.language || inferLanguage(path));

    if (content.includes("[omitted to save tokens]")) {
      return {
        output: {
          ok: false,
          error:
            "write_file content was truncated. Provide complete file content.",
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "file" as const,
          title: "Rejected truncated file",
          detail: path || "Unknown path",
          status: "error" as const,
        },
      };
    }

    if (!path || !content) {
      return {
        output: {
          ok: false,
          error:
            "path and content are required. Retry with filePath/path and complete content.",
          acceptedPathFields: ["path", "filePath", "file_path", "filepath", "destinationPath", "destination_path"],
          acceptedContentFields: ["content", "contents", "data", "text"],
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "file" as const,
          title: "Rejected artifact file",
          detail: "write_file was missing a valid path or content.",
          status: "error" as const,
        },
      };
    }

    files.set(path, { path, content, language });

    return {
      output: { ok: true, path, bytes: content.length },
      step: {
        id: `file-${path}`,
        type: "file" as const,
        title: `Added ${path.split("/").pop()}`,
        detail: path,
        status: "done" as const,
      },
    };
  }

  if (toolName === "add_terminal_command") {
    const command = String(args.command || "").trim();
    const reason = String(args.reason || "").trim();
    if (command) {
      terminalCommands.push({ command, reason });
    }

    return {
      output: { ok: Boolean(command), command },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: command ? `Run \`${command}\`` : "Terminal command",
        detail: reason || command || "No command supplied.",
        status: command ? ("done" as const) : ("error" as const),
      },
    };
  }

  if (toolName === "search_skytells_docs") {
    const query = String(args.query || "Skytells setup");
    const tag = String(args.tag || "").trim();
    const results = await searchSkytellsDocs(query, tag);

    return {
      output: { ok: true, query, results },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Searching docs",
        detail: `${results.length} source(s) for "${query}"`,
        status: "done" as const,
        sources: toStepSources(results),
      },
    };
  }

  if (toolName === "get_skytells_platform_context") {
    const focus = String(args.focus || "platform").trim();
    const context = getSkytellsPlatformContext(focus);

    return {
      output: { ok: true, focus, context },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: "Loaded Skytells context",
        detail: `${context.capabilities.length} platform capability contract(s) for ${focus}`,
        status: "done" as const,
        sources: toStepSources(context.links),
      },
    };
  }

  if (toolName === "create_skytells_deploy_link") {
    const repoUrl = String(args.repoUrl || args.repo || "").trim();
    const name = String(args.name || args.appName || "").trim();
    const description = String(args.description || args.desc || "").trim();
    const deploy = createSkytellsDeployLink(repoUrl, name, description);

    return {
      output: deploy,
      step: {
        id: `tool-${toolCall.id}`,
        type: "deploy" as const,
        title: deploy.ok ? "Prepared deploy link" : "Deploy link rejected",
        detail: deploy.ok ? deploy.url : deploy.error,
        status: deploy.ok ? ("done" as const) : ("error" as const),
        sources: deploy.ok ? toStepSources([{ url: deploy.url, title: "Deploy on Skytells" }]) : undefined,
      },
    };
  }

  if (toolName === "get_orchestrator_webhook_contract") {
    const workflowId = String(args.workflowId || "").trim();
    const payloadExample =
      args.payloadExample && typeof args.payloadExample === "object"
        ? args.payloadExample
        : undefined;
    const contract = getOrchestratorWebhookContract(workflowId, payloadExample);

    return {
      output: { ok: true, contract },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: "Loaded workflow contract",
        detail: contract.endpoint,
        status: "done" as const,
        sources: toStepSources([
          {
            url: "https://learn.skytells.ai/docs/products/orchestrator/api-reference",
            title: "Orchestrator API Reference",
          },
        ]),
      },
    };
  }

  if (toolName === "generate_skytells_saas_schema") {
    const appName = String(args.appName || args.name || "Skytells SaaS").trim();
    const schema = generateSkytellsSaasSchema({
      appName,
      includeTeams: args.includeTeams !== false,
      includeApiKeys: args.includeApiKeys === true,
    });

    return {
      output: { ok: true, schema },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: "Generated SaaS schema",
        detail: `${schema.tables.length} Skytells database table(s) with credits, bundles, and usage accounting.`,
        status: "done" as const,
      },
    };
  }

  if (toolName === "search_web") {
    const query = String(args.query || "").trim();
    if (!query) {
      return {
        output: { ok: false, error: "query is required" },
        step: {
          id: `tool-${toolCall.id}`,
          type: "search" as const,
          title: "Web search",
          detail: "Missing search query.",
          status: "error" as const,
        },
      };
    }

    const results = await searchWeb(query);
    return {
      output: { ok: true, query, results },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Searching web",
        detail: `${results.length} result(s) for "${query}"`,
        status: "done" as const,
        sources: toStepSources(results),
      },
    };
  }

  if (rawToolName === "FetchFromWeb") {
    const urls = Array.isArray(args.urls)
      ? args.urls.map((url) => String(url).trim()).filter(Boolean).slice(0, 4)
      : [];

    if (!urls.length || urls.some((url) => !isSafeHttpUrl(url))) {
      return {
        output: { ok: false, error: "One or more valid http/https urls are required" },
        step: {
          id: `tool-${toolCall.id}`,
          type: "search" as const,
          title: "Fetch pages",
          detail: "Rejected invalid URL list.",
          status: "error" as const,
        },
      };
    }

    const pages = await Promise.all(urls.map((url) => fetchWebPage(url)));
    return {
      output: { ok: pages.every((page) => page.ok), pages },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Reading pages",
        detail: `${pages.filter((page) => page.ok).length}/${pages.length} page(s) fetched`,
        status: pages.every((page) => page.ok) ? ("done" as const) : ("error" as const),
        sources: toStepSources(
          pages
            .filter((page) => page.ok)
            .map((page) => ({ url: page.url, title: safeHostname(page.url) })),
        ),
      },
    };
  }

  if (toolName === "fetch_web_page") {
    const url = String(args.url || "").trim();
    if (!isSafeHttpUrl(url)) {
      return {
        output: { ok: false, error: "A valid http/https url is required" },
        step: {
          id: `tool-${toolCall.id}`,
          type: "search" as const,
          title: "Fetch page",
          detail: "Rejected invalid URL.",
          status: "error" as const,
        },
      };
    }

    const page = await fetchWebPage(url);
    return {
      output: page,
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Reading page",
        detail: page.ok ? page.url : page.error,
        status: page.ok ? ("done" as const) : ("error" as const),
        sources: page.ok ? toStepSources([{ url: page.url, title: safeHostname(page.url) }]) : undefined,
      },
    };
  }

  if (
    toolName === "generate_image" ||
    toolName === "generate_video" ||
    toolName === "generate_audio"
  ) {
    const mediaKind =
      toolName === "generate_image"
        ? ("image" as const)
        : toolName === "generate_video"
          ? ("video" as const)
          : ("audio" as const);

    const mode = mediaConfig.modes[mediaKind];
    const model = mediaConfig.models[mediaKind];
    const prompt = String(args.prompt || "").trim();

    if (!prompt) {
      return {
        output: { ok: false, error: "prompt is required" },
        step: {
          id: `tool-${toolCall.id}`,
          type: "media" as const,
          title: `Generate ${mediaKind}`,
          detail: "Missing generation prompt.",
          status: "error" as const,
          mediaKind,
        },
      };
    }

    if (mode === "off") {
      return {
        output: {
          ok: false,
          blocked: true,
          reason: `Generation is disabled for ${mediaKind}.`,
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "media" as const,
          title: `Generate ${mediaKind}`,
          detail: `${mediaKind} generation is disabled (mode OFF).`,
          status: "error" as const,
          mediaKind,
          mediaModel: model,
        },
      };
    }

    if (mode === "ask") {
      const question = `I can generate a ${mediaKind} asset with Skytells model ${model} for this project. Please approve generation and I’ll continue.`;
      return {
        output: {
          ok: false,
          blocked: true,
          mediaKind,
          model,
          prompt,
          question,
          reason: `Approval required before generating ${mediaKind}.`,
          needsUserApproval: true,
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "media" as const,
          title: "Approval needed",
          detail: question,
          status: "done" as const,
          mediaKind,
          mediaModel: model,
        },
      };
    }

    const predictionInput = buildPredictionInput(mediaKind, args);
    onProgress?.(
      `I'm now generating ${mediaKind} using your Skytells ${model} model because this asset will improve the final deliverable quality.`,
    );

    try {
      const prediction = await client.predict({
        model,
        input: predictionInput,
      });
      const settled = await client.wait(prediction);
      const urls = extractPredictionUrls(settled.output);
      const primary = urls[0] || "Prediction completed";

      onProgress?.(`Skytells responded with success for ${mediaKind} generation.`);
      onProgress?.(
        `Wiring ${mediaKind} assets into your project preview and generated files now.`,
      );

      return {
        output: {
          ok: true,
          mediaKind,
          model,
          predictionId: settled.id,
          status: settled.status,
          urls,
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "media" as const,
          title: `Generated ${mediaKind}`,
          detail: primary,
          status: "done" as const,
          mediaKind,
          mediaModel: model,
          predictionId: settled.id,
          predictionStatus: settled.status,
          sources: toStepSources(urls.map((url) => ({ url, title: `${mediaKind} output` }))),
        },
      };
    } catch (error) {
      const normalized = normalizeSkytellsError(error);
      onProgress?.(
        `Skytells responded with a failure while generating ${mediaKind}: ${normalized.message}`,
      );
      return {
        output: {
          ok: false,
          mediaKind,
          model,
          error: normalized.message,
          errorId: normalized.errorId,
          status: normalized.status,
        },
        step: {
          id: `tool-${toolCall.id}`,
          type: "media" as const,
          title: `Failed generating ${mediaKind}`,
          detail: normalized.message,
          status: "error" as const,
          mediaKind,
          mediaModel: model,
          predictionStatus: `${normalized.status || "error"}`,
        },
      };
    }
  }

  if (rawToolName === "TodoManager") {
    const todos = applyTodoManagerAction(todoState?.items ?? [], args);
    if (todoState) {
      todoState.items = todos;
    }

    const done = todos.filter((t) => t.status === "done").length;
    return {
      output: { ok: true, count: todos.length, items: todos },
      step: {
        id: "live-todo",
        type: "todo" as const,
        title: "Live TODO",
        detail: `${done}/${todos.length} complete`,
        status: "done" as const,
        todos,
      },
    };
  }

  if (rawToolName === "GenerateDesignInspiration") {
    const goal = String(args.goal || "Create a polished product interface").trim();
    const context = String(args.context || "").trim();
    const brief = generateDesignBrief(goal, context);
    return {
      output: { ok: true, goal, brief },
      step: {
        id: `tool-${toolCall.id}`,
        type: "reasoning" as const,
        title: "Design inspiration",
        detail: brief.summary,
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "GetOrRequestIntegration") {
    const names = Array.isArray(args.names) ? args.names.map(String) : [];
    const status = await validateDatabases();
    const docs = await searchSkytellsDocs(
      names.join(" ") || "Skytells integrations database environment variables",
    );
    return {
      output: { ok: status.ok, names, databases: status, docs },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: "Checked integrations",
        detail: status.ok
          ? "Skytells Postgres and libSQL are connected for this runtime."
          : "Skytells integration requirements need attention.",
        status: status.ok ? ("done" as const) : ("error" as const),
        sources: toStepSources(docs),
      },
    };
  }

  if (rawToolName === "LSRepo") {
    const pathPrefix = sanitizePath(String(args.path || ""));
    const paths = Array.from(files.keys())
      .filter((path) => !pathPrefix || path.startsWith(pathPrefix))
      .sort();
    return {
      output: { ok: true, files: paths },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Listed files",
        detail: `${paths.length} generated file(s)`,
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "ReadFile") {
    const path = sanitizePath(String(args.filePath || args.path || ""));
    const file = path ? files.get(path) : undefined;
    if (!file) {
      return {
        output: { ok: false, error: `File not found: ${path || "unknown"}` },
        step: {
          id: `tool-${toolCall.id}`,
          type: "search" as const,
          title: "Read file",
          detail: `File not found: ${path || "unknown"}`,
          status: "error" as const,
        },
      };
    }

    const startLine = Math.max(1, Number(args.startLine || 1));
    const endLine = Math.max(startLine, Number(args.endLine || 0));
    const lines = file.content.split("\n");
    const content = endLine
      ? lines.slice(startLine - 1, endLine).join("\n")
      : file.content;
    return {
      output: { ok: true, path, content, totalLines: lines.length },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Read file",
        detail: path,
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "GrepRepo") {
    const pattern = String(args.pattern || "").trim();
    const prefix = sanitizePath(String(args.path || ""));
    if (!pattern) {
      return {
        output: { ok: false, error: "pattern is required" },
        step: {
          id: `tool-${toolCall.id}`,
          type: "search" as const,
          title: "Search files",
          detail: "Missing regex pattern.",
          status: "error" as const,
        },
      };
    }

    const matches = grepGeneratedFiles(files, pattern, prefix);
    return {
      output: { ok: true, matches },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Searched files",
        detail: `${matches.length} match(es) for "${pattern}"`,
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "SearchRepo") {
    const query = String(args.query || "").trim();
    const matches = searchGeneratedFiles(files, query);
    return {
      output: { ok: true, query, matches },
      step: {
        id: `tool-${toolCall.id}`,
        type: "search" as const,
        title: "Searched project",
        detail: `${matches.length} generated file(s) matched "${query || "project"}"`,
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "InspectSite") {
    const urls = Array.isArray(args.urls) ? args.urls.map(String) : [];
    return {
      output: {
        ok: true,
        urls,
        generatedFiles: Array.from(files.keys()).sort(),
        note: "Preview screenshots are represented by artifact state in this runtime.",
      },
      step: {
        id: `tool-${toolCall.id}`,
        type: "tool" as const,
        title: "Inspected preview",
        detail: files.size
          ? `${files.size} generated file(s) available for preview.`
          : "No generated files are available yet.",
        status: "done" as const,
      },
    };
  }

  if (rawToolName === "Move") {
    const sourcePath = sanitizePath(String(args.sourcePath || args.source_path || ""));
    const destinationPath = sanitizePath(
      String(args.destinationPath || args.destination_path || ""),
    );
    const operation = String(args.operation || "copy");
    const source = sourcePath ? files.get(sourcePath) : undefined;
    if (!source || !destinationPath || !["copy", "move"].includes(operation)) {
      return {
        output: { ok: false, error: "Move requires an existing source, destination, and copy/move operation." },
        step: {
          id: `tool-${toolCall.id}`,
          type: "file" as const,
          title: "Move file",
          detail: "Source file was not available in the generated workspace.",
          status: "error" as const,
        },
      };
    }

    files.set(destinationPath, {
      path: destinationPath,
      content: source.content,
      language: inferLanguage(destinationPath),
    });
    if (operation === "move") {
      files.delete(sourcePath);
    }
    return {
      output: { ok: true, sourcePath, destinationPath, operation },
      step: {
        id: `file-${destinationPath}`,
        type: "file" as const,
        title: operation === "move" ? "Moved file" : "Copied file",
        detail: destinationPath,
        status: "done" as const,
      },
    };
  }

  if (toolName === "update_todo_list") {
    const rawItems = args.items as Array<{
      id: string;
      label: string;
      status: string;
    }> | undefined;
    const incomingTodos: TodoItem[] = (rawItems ?? []).map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      label: String(item.label || ""),
      status: (["pending", "in-progress", "done", "error"].includes(item.status)
        ? item.status
        : "pending") as "pending" | "in-progress" | "done" | "error",
    }));
    const todos = mergeTodoItems(todoState?.items ?? [], incomingTodos);
    if (todoState) {
      todoState.items = todos;
    }

    const done = todos.filter((t) => t.status === "done").length;
    return {
      output: { ok: true, count: todos.length },
      step: {
        id: "live-todo",
        type: "todo" as const,
        title: "Live TODO",
        detail: `${done}/${todos.length} complete`,
        status: "done" as const,
        todos,
      },
    };
  }

  if (toolName === "emit_reasoning") {
    const thought = String(args.thought || "").trim();
    return {
      output: { ok: true },
      step: {
        id: `tool-${toolCall.id}`,
        type: "reasoning" as const,
        title: "Reasoning",
        detail: thought,
        status: "done" as const,
      },
    };
  }

  return {
    output: { ok: false, error: `Unknown tool ${toolCall.function.name}` },
    step: {
      id: `tool-${toolCall.id}`,
      type: "tool" as const,
      title: "Unknown tool call",
      detail: toolCall.function.name,
      status: "error" as const,
    },
  };
}

function deferExtraFileWrite(toolCall: ToolCall) {
  const args = parseToolArguments(toolCall.function.arguments);
  const path = sanitizePath(readPathArgument(args));

  return {
    output: {
      ok: false,
      deferred: true,
      path,
      reason:
        "Only one artifact file is accepted per assistant turn. Call write_file again next turn for this file.",
    },
    step: {
      id: `tool-${toolCall.id}`,
      type: "file" as const,
      title: "Deferred file write",
      detail: path || "One file per turn is enforced.",
      status: "error" as const,
    },
  };
}

function parseToolArguments(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractApprovalRequest(output: unknown) {
  if (!output || typeof output !== "object") return "";
  const value = output as Record<string, unknown>;
  if (value.needsUserApproval !== true) return "";
  return String(value.question || value.reason || "Please approve this generation before I continue.");
}

function normalizeToolName(name: string) {
  const aliases: Record<string, string> = {
    SearchWeb: "search_web",
    FetchFromWeb: "fetch_web_page",
    Write: "write_file",
    GenerateImage: "generate_image",
    GenerateVideo: "generate_video",
    GenerateAudio: "generate_audio",
  };
  return aliases[name] || name;
}

function readPathArgument(args: Record<string, unknown>) {
  const direct =
    args.path ??
    args.filePath ??
    args.file_path ??
    args.filepath ??
    args.destinationPath ??
    args.destination_path ??
    args.destination;

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const taskText = [
    args.taskNameActive,
    args.taskNameComplete,
    args.name,
    args.filename,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return extractPathFromText(taskText);
}

function readContentArgument(args: Record<string, unknown>) {
  const content = args.content ?? args.contents ?? args.data ?? args.text ?? args.body;
  return typeof content === "string" ? content : "";
}

function extractPathFromText(text: string) {
  const match = text.match(/(?:^|\s)([a-zA-Z0-9._@/-]+\.[a-zA-Z0-9]+)(?:\s|$)/);
  return match?.[1] || "";
}

function createRunningStep(toolCall: ToolCall): AgentStep | null {
  const args = parseToolArguments(toolCall.function.arguments);
  const rawToolName = toolCall.function.name;
  const toolName = normalizeToolName(rawToolName);
  const id = `tool-${toolCall.id}`;

  if (toolName === "write_file") {
    const path = sanitizePath(readPathArgument(args));
    return {
      id,
      type: "file",
      title: "Creating artifact file",
      detail: path || "Preparing file update",
      status: "running",
    };
  }

  if (toolName === "search_skytells_docs") {
    return {
      id,
      type: "search",
      title: "Searching docs",
      detail: String(args.query || "Skytells setup"),
      status: "running",
    };
  }

  if (toolName === "get_skytells_platform_context") {
    return {
      id,
      type: "tool",
      title: "Loading Skytells context",
      detail: String(args.focus || "Platform contract"),
      status: "running",
    };
  }

  if (toolName === "create_skytells_deploy_link") {
    return {
      id,
      type: "deploy",
      title: "Preparing deploy link",
      detail: String(args.repoUrl || args.repo || "Skytells Deploy"),
      status: "running",
    };
  }

  if (toolName === "get_orchestrator_webhook_contract") {
    return {
      id,
      type: "tool",
      title: "Loading workflow contract",
      detail: String(args.workflowId || "Orchestrator webhook"),
      status: "running",
    };
  }

  if (toolName === "generate_skytells_saas_schema") {
    return {
      id,
      type: "tool",
      title: "Preparing SaaS schema",
      detail: String(args.appName || args.name || "Credits and bundles"),
      status: "running",
    };
  }

  if (toolName === "search_web") {
    return {
      id,
      type: "search",
      title: "Searching web",
      detail: String(args.query || "Web research"),
      status: "running",
    };
  }

  if (toolName === "fetch_web_page") {
    return {
      id,
      type: "search",
      title: rawToolName === "FetchFromWeb" ? "Reading pages" : "Reading page",
      detail:
        rawToolName === "FetchFromWeb"
          ? `${Array.isArray(args.urls) ? args.urls.length : 0} URL(s)`
          : String(args.url || "Fetching URL"),
      status: "running",
    };
  }

  if (toolName === "generate_image") {
    return {
      id,
      type: "media",
      title: "Generating image",
      detail: String(args.prompt || "Creating image asset"),
      status: "running",
      mediaKind: "image",
    };
  }

  if (toolName === "generate_video") {
    return {
      id,
      type: "media",
      title: "Generating video",
      detail: String(args.prompt || "Creating video clip"),
      status: "running",
      mediaKind: "video",
    };
  }

  if (toolName === "generate_audio") {
    return {
      id,
      type: "media",
      title: "Generating audio",
      detail: String(args.prompt || "Creating audio track"),
      status: "running",
      mediaKind: "audio",
    };
  }

  if (toolName === "add_terminal_command") {
    return {
      id,
      type: "tool",
      title: "Preparing command",
      detail: String(args.command || "Registering terminal command"),
      status: "running",
    };
  }

  if (toolName === "update_todo_list" || rawToolName === "TodoManager") {
    return {
      id: "live-todo",
      type: "todo",
      title: "Updating task list",
      detail: "Syncing task status",
      status: "running",
      todos: [],
    };
  }

  if (toolName === "emit_reasoning") {
    return {
      id,
      type: "reasoning",
      title: "Reasoning",
      detail: "Thinking through the next task",
      status: "running",
    };
  }

  if (
    rawToolName === "GenerateDesignInspiration" ||
    rawToolName === "GetOrRequestIntegration" ||
    rawToolName === "InspectSite" ||
    rawToolName === "LSRepo" ||
    rawToolName === "ReadFile" ||
    rawToolName === "GrepRepo" ||
    rawToolName === "SearchRepo" ||
    rawToolName === "Move"
  ) {
    return {
      id,
      type: rawToolName === "Move" ? "file" : "tool",
      title: String(args.taskNameActive || rawToolName),
      detail: String(args.query || args.goal || args.filePath || args.path || args.pattern || "Running tool"),
      status: "running",
    };
  }

  return null;
}

function applyTodoManagerAction(currentItems: TodoItem[], args: Record<string, unknown>): TodoItem[] {
  const action = String(args.action || "read_list");
  const current = currentItems.map((item) => ({ ...item }));

  if (action === "set_tasks") {
    const tasks = Array.isArray(args.tasks) ? args.tasks.map(String).filter(Boolean) : [];
    const incoming = dedupeTodos(tasks.map((label, index): TodoItem => ({
      id: todoIdFromLabel(label, index),
      label,
      status: index === 0 ? "in-progress" : "pending",
    })));
    return mergeTodoItems(current, incoming);
  }

  if (action === "add_task") {
    const label = String(args.task || "").trim();
    if (!label) return current;
    return mergeTodoItems(current, [
      ...current,
      {
        id: todoIdFromLabel(label, current.length),
        label,
        status: current.some((item) => item.status === "in-progress") ? "pending" as const : "in-progress" as const,
      },
    ]);
  }

  if (action === "move_to_task") {
    const target = String(args.moveToTask || "").trim();
    const targetIndex = current.findIndex((item) => item.label === target || item.id === target);
    if (targetIndex === -1) return current;
    return current.map((item, index) => ({
      ...item,
      status:
        item.status === "error"
          ? item.status
          : index < targetIndex
            ? "done"
            : index === targetIndex
              ? "in-progress"
              : "pending",
    }));
  }

  if (action === "mark_all_done") {
    return current.map((item) => ({
      ...item,
      status: item.status === "error" ? "error" : "done",
    }));
  }

  return current;
}

function mergeTodoItems(currentItems: TodoItem[], incomingItems: TodoItem[]): TodoItem[] {
  const currentByKey = new Map<string, TodoItem>();
  for (const item of currentItems) {
    currentByKey.set(todoMergeKey(item), item);
  }

  return dedupeTodos(incomingItems).map((incoming) => {
    const existing = currentByKey.get(todoMergeKey(incoming));
    if (!existing) return incoming;
    return {
      ...incoming,
      id: existing.id || incoming.id,
      status: mergeTodoStatus(existing.status, incoming.status),
    };
  });
}

function dedupeTodos(items: TodoItem[]) {
  const byKey = new Map<string, TodoItem>();
  for (const item of items) {
    const key = todoMergeKey(item);
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
}

function todoMergeKey(item: Pick<TodoItem, "id" | "label">) {
  return (item.id || todoIdFromLabel(item.label, 0)).toLowerCase();
}

function mergeTodoStatus(
  current: TodoItem["status"],
  incoming: TodoItem["status"],
): TodoItem["status"] {
  if (current === "error" || incoming === "error") return "error";
  if (current === "done") return "done";
  if (current === "in-progress" && incoming === "pending") return "in-progress";
  return incoming;
}

function advanceTodosForArtifactFile(items: TodoItem[], path: string) {
  if (!items.length || !path) return { changed: false, items };

  const filename = path.split("/").pop() || path;
  let changed = false;
  let nextItems = items.map((item) => {
    const label = item.label.toLowerCase();
    const matchesPath =
      label.includes(path.toLowerCase()) ||
      label.includes(filename.toLowerCase());

    if (matchesPath && item.status !== "done" && item.status !== "error") {
      changed = true;
      return { ...item, status: "done" as const };
    }
    return item;
  });

  if (!nextItems.some((item) => item.status === "in-progress")) {
    const nextPendingIndex = nextItems.findIndex((item) => item.status === "pending");
    if (nextPendingIndex >= 0) {
      changed = true;
      nextItems = nextItems.map((item, index) =>
        index === nextPendingIndex ? { ...item, status: "in-progress" as const } : item,
      );
    }
  }

  return { changed, items: nextItems };
}

function createTodoStep(items: TodoItem[]): AgentStep {
  const done = items.filter((item) => item.status === "done").length;
  return {
    id: "live-todo",
    type: "todo",
    title: "Live TODO",
    detail: `${done}/${items.length} complete`,
    status: "done",
    todos: items,
  };
}

function todoIdFromLabel(label: string, index: number) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `task-${index + 1}`;
}

function generateDesignBrief(goal: string, context: string) {
  const summary = `Design direction for ${goal}: Skytells-grade dark product UI, compact controls, 3-5 tokenized colors, crisp typography, and mobile-first spacing.`;
  return {
    summary,
    principles: [
      "Use restrained neutral surfaces with one primary accent and clear contrast.",
      "Prefer dense, functional layouts over decorative cards or marketing composition.",
      "Keep touch targets at least 44px and inputs at 16px or larger on mobile.",
      "Use semantic tokens, accessible controls, loading states, and polished empty/error states.",
      context ? `Honor this extra context: ${context}` : "Match the project context already present in the conversation.",
    ],
  };
}

function getSkytellsPlatformContext(focus: string) {
  return {
    focus,
    capabilities: [
      {
        name: "Skytells Models",
        useFor: "Chat, code generation, multimodal app features, embeddings, and model usage.",
        env: ["SKYTELLS_API_KEY", "SKYTELLS_DEFAULT_MODEL", "SKYTELLS_TIMEOUT_MS"],
        implementation:
          "Use the server-side Skytells SDK behind route handlers. Never expose SKYTELLS_API_KEY to the browser.",
      },
      {
        name: "Skytells libSQL",
        useFor: "Required low-latency builder/runtime state for chats, artifacts, MCP configs, workflow metadata, deploy metadata, and fast reads.",
        env: ["LIBSQL_URL", "SKYTELLS_LIBSQL_URL", "LIBSQL_AUTH_TOKEN", "SKYTELLS_LIBSQL_AUTH_TOKEN", "SAAS_MODE"],
        implementation:
          "Use parameterized SQL, migrations, indexes, constraints, and server-side data access.",
      },
      {
        name: "Skytells Postgres",
        useFor: "Required relational data store for SaaS users, subscriptions, billing events, credit ledger, model usage accounting, and reporting.",
        env: ["POSTGRES_URL", "DATABASE_URL", "SKYTELLS_POSTGRES_URL", "POSTGRES_SSL", "SAAS_MODE"],
        implementation:
          "Use Postgres for relational SaaS/accounting data, analytics, reporting, and transactional business records.",
      },
      {
        name: "SaaS Mode",
        useFor: "Turn generated apps into SaaS products with users, subscriptions, billing events, bundles, credits, usage, entitlements, and customer API keys.",
        env: [
          "SAAS_MODE",
          "SAAS_AUTH_PROVIDER",
          "SAAS_BILLING_PROVIDER",
          "SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "BETTER_AUTH_SECRET",
          "BETTER_AUTH_URL",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
        ],
        implementation:
          "When SAAS_MODE=true, keep SaaS/accounting data in Skytells Postgres and runtime state in Skytells libSQL. Use Supabase or Better Auth only for identity.",
      },
      {
        name: "Skytells Redis",
        useFor: "Optional cache, sessions, queues, counters, rate limits, and recent activity.",
        env: ["REDIS_URL", "KV_URL", "SKYTELLS_REDIS_URL", "REDIS_REQUIRED"],
        implementation:
          "Treat Redis as optional unless REDIS_REQUIRED=true or the generated feature depends on it.",
      },
      {
        name: "Skytells Orchestrator",
        useFor: "Workflow automation, background jobs, integration chains, and deploy-time automations.",
        env: ["SKYTELLS_ORCHESTRATOR_API_KEY", "ORCHESTRATOR_API_KEY"],
        implementation:
          "Call webhook workflows through a server route using Authorization: Bearer wfb_*.",
      },
      {
        name: "Skytells Deploy",
        useFor: "Deploying generated GitHub repositories into the Skytells console.",
        env: [],
        implementation:
          "Build links with https://console.skytells.ai/deploy?repo=REPO_URL&name=APP_NAME&description=DESC.",
      },
      {
        name: "Skytells Prediction API",
        useFor: "Real image, video, and audio asset generation.",
        env: [
          "SKYTELLS_IMAGE_GENERATION",
          "SKYTELLS_VIDEO_GENERATION",
          "SKYTELLS_AUDIO_GENERATION",
          "SKYTELLS_IMAGE_DEFAULT_MODEL",
          "SKYTELLS_VIDEO_DEFAULT_MODEL",
          "SKYTELLS_AUDIO_DEFAULT_MODEL",
        ],
        implementation:
          "Respect auto/ask/off modes; in ask mode, request approval before generation.",
      },
    ],
    productionRules: [
      "Generated projects must use real data paths, route handlers, validation, and persistence.",
      "Do not use mock auth, mock billing, fake credits, localStorage persistence, or placeholder integration data.",
      "Prefer Skytells services over generic alternatives unless the user explicitly asks otherwise.",
      "For SaaS, enable SAAS_MODE and include Skytells Postgres users, organizations, subscriptions, billing events, credit ledger, bundles/plans, entitlements, usage records, customer API keys, and database indexes.",
      "Support Supabase and Better Auth for authentication, but never move application persistence out of Skytells Postgres/libSQL.",
      "Include deployment instructions and Skytells Deploy link support when a GitHub repository is involved.",
    ],
    links: [
      { title: "Skytells Console", url: "https://console.skytells.ai" },
      { title: "Skytells Projects", url: "https://console.skytells.ai/projects" },
      { title: "Skytells API Keys", url: "https://console.skytells.ai/settings/api-keys" },
      { title: "Skytells Models", url: "https://console.skytells.ai/explore/models" },
      { title: "Skytells Docs", url: "https://learn.skytells.ai/docs" },
      {
        title: "Orchestrator API Reference",
        url: "https://learn.skytells.ai/docs/products/orchestrator/api-reference",
      },
      { title: "Orchestrator", url: "https://orchestrator.skytells.ai" },
    ],
  };
}

function createSkytellsDeployLink(repoUrl: string, name: string, description: string) {
  if (!isSafeHttpUrl(repoUrl) || !repoUrl.startsWith("https://github.com/")) {
    return {
      ok: false,
      error: "repoUrl must be a valid https://github.com/... repository URL.",
    };
  }

  const params = new URLSearchParams({ repo: repoUrl });
  if (name) params.set("name", name);
  if (description) params.set("description", description);
  const url = `https://console.skytells.ai/deploy?${params.toString()}`;

  return {
    ok: true,
    url,
    markdown: `[![Deploy on Skytells](https://console.skytells.ai/brand/deploy-buttons/dark-compact.png)](${url})`,
    html: `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="https://console.skytells.ai/brand/deploy-buttons/dark-compact.png" alt="Deploy on Skytells" /></a>`,
  };
}

function getOrchestratorWebhookContract(
  workflowId: string,
  payloadExample?: unknown,
) {
  const workflowSegment = workflowId || "{workflowId}";
  const endpoint = `https://orchestrator.skytells.ai/api/workflows/${workflowSegment}/webhook`;
  const payload =
    payloadExample && typeof payloadExample === "object"
      ? payloadExample
      : {
          event: "project.generated",
          appName: "skytells-app",
          repoUrl: "https://github.com/acme/skytells-app",
        };

  return {
    endpoint,
    method: "POST",
    auth: "Authorization: Bearer wfb_<key>",
    env: ["SKYTELLS_ORCHESTRATOR_API_KEY", "ORCHESTRATOR_API_KEY"],
    payloadExample: payload,
    helper: `export async function runSkytellsWorkflow(input: unknown) {
  const workflowId = process.env.SKYTELLS_ORCHESTRATOR_WORKFLOW_ID;
  const apiKey = process.env.SKYTELLS_ORCHESTRATOR_API_KEY;

  if (!workflowId || !apiKey) {
    throw new Error("Missing Skytells Orchestrator workflow configuration.");
  }

  const response = await fetch(
    \`https://orchestrator.skytells.ai/api/workflows/\${encodeURIComponent(workflowId)}/webhook\`,
    {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${apiKey}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Skytells workflow failed.");
  }
  return data;
}`,
  };
}

function generateSkytellsSaasSchema(input: {
  appName: string;
  includeTeams: boolean;
  includeApiKeys: boolean;
}) {
  const tables = [
    "app_users",
    ...(input.includeTeams ? ["organizations", "organization_members"] : []),
    "credit_bundles",
    "subscriptions",
    "credit_ledger",
    "model_usage_events",
    "entitlements",
    ...(input.includeApiKeys ? ["customer_api_keys"] : []),
  ];

  const sql = `-- Skytells SaaS foundation for ${input.appName}
create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

${input.includeTeams ? `create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
` : ""}
create table if not exists credit_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  bundle_id uuid references credit_bundles(id) on delete set null,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists model_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists entitlements (
  user_id uuid not null references app_users(id) on delete cascade,
  key text not null,
  value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

${input.includeApiKeys ? `create table if not exists customer_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
` : ""}
create index if not exists credit_ledger_user_created_idx on credit_ledger(user_id, created_at desc);
create index if not exists model_usage_user_created_idx on model_usage_events(user_id, created_at desc);
create index if not exists subscriptions_user_status_idx on subscriptions(user_id, status);
`;

  return {
    appName: input.appName,
    tables,
    migrationPath: "db/migrations/001_saas_foundation.sql",
    sql,
    usageContract: {
      creditBalanceSql:
        "select coalesce(sum(delta), 0)::int as balance from credit_ledger where user_id = $1",
      chargeRule:
        "Insert a negative credit_ledger row in the same transaction as model_usage_events after validating balance >= charge.",
      bundleRule:
        "Purchased bundles insert positive credit_ledger rows with reason='bundle_purchase' and reference_id set to the payment/subscription id.",
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function grepGeneratedFiles(files: Map<string, CodeFile>, pattern: string, prefix = "") {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch {
    regex = new RegExp(escapeRegExp(pattern), "i");
  }

  const matches: Array<{ path: string; line: number; text: string }> = [];
  for (const file of files.values()) {
    if (prefix && !file.path.startsWith(prefix)) continue;
    const lines = file.content.split("\n");
    lines.forEach((line, index) => {
      if (matches.length < 200 && regex.test(line)) {
        matches.push({ path: file.path, line: index + 1, text: truncateText(line.trim(), 240) });
      }
    });
  }
  return matches;
}

function searchGeneratedFiles(files: Map<string, CodeFile>, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return Array.from(files.values())
    .map((file) => {
      const haystack = `${file.path}\n${file.content}`.toLowerCase();
      const score = terms.length
        ? terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0)
        : 1;
      return {
        path: file.path,
        language: file.language,
        score,
        preview: truncateText(file.content.replace(/\s+/g, " ").trim(), 260),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 20);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizePath(path: string) {
  const normalized = path.trim().replace(/\\/g, "/");
  const projectRoots = ["/skytells/share/project/", ["/ver", "cel/share/", "v", "0-project/"].join("")];
  const matchedRoot = projectRoots.find((root) => normalized.startsWith(root));
  const clean = matchedRoot
    ? normalized.slice(matchedRoot.length)
    : normalized.replace(/^\/+/, "").replace(/^\.\//, "");
  if (!clean || clean.includes("..") || clean.startsWith("/")) {
    return "";
  }
  if (!/^[a-zA-Z0-9._/@-]+$/.test(clean)) {
    return "";
  }
  return clean;
}

function inferLanguage(path: string) {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "md";
  return "txt";
}

function validateArtifactFiles(files: CodeFile[]) {
  const paths = new Set(files.map((file) => file.path));

  // Accept package.json anywhere in the tree
  const hasPackageJson = [...paths].some((p) => p === "package.json" || p.endsWith("/package.json"));

  // Require exactly app/page.tsx (not src/app/page.tsx, not page.tsx alone)
  const hasPageFile = paths.has("app/page.tsx");

  const missing: string[] = [];
  if (!hasPackageJson) missing.push("package.json");
  if (!hasPageFile) missing.push("app/page.tsx");

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required files: ${missing.join(", ")}. The artifact cannot run without them.`,
    };
  }

  return { ok: true, message: "Artifact contains required runnable files." };
}

function attachTerminalCommands(artifact: { files: CodeFile[]; terminalCommands?: TerminalCommand[] }, explicitCommands: TerminalCommand[]) {
  artifact.terminalCommands =
    explicitCommands.length > 0
      ? dedupeTerminalCommands(explicitCommands)
      : inferTerminalCommands(artifact.files);
}

function inferTerminalCommands(files: CodeFile[]): TerminalCommand[] {
  const packageFile = files.find((file) => file.path === "package.json" || file.path.endsWith("/package.json"));
  if (!packageFile) return [];

  const packageManager = detectPackageManager(files);
  const scripts = readPackageScripts(packageFile.content);
  const commands: TerminalCommand[] = [
    {
      command: `${packageManager} install`,
      reason: "Install artifact dependencies.",
    },
  ];

  if (scripts.has("dev")) {
    commands.push({
      command: runPackageScriptCommand(packageManager, "dev"),
      reason: "Start the artifact development server.",
    });
  }

  if (scripts.has("build")) {
    commands.push({
      command: runPackageScriptCommand(packageManager, "build"),
      reason: "Verify the artifact production build.",
    });
  }

  return dedupeTerminalCommands(commands);
}

function readPackageScripts(content: string) {
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, unknown> };
    return new Set(
      Object.entries(parsed.scripts ?? {})
        .filter(([, value]) => typeof value === "string")
        .map(([key]) => key),
    );
  } catch {
    return new Set<string>();
  }
}

function runPackageScriptCommand(packageManager: string, script: string) {
  if (packageManager === "npm") return `npm run ${script}`;
  return `${packageManager} ${script}`;
}

function dedupeTerminalCommands(commands: TerminalCommand[]) {
  const byCommand = new Map<string, TerminalCommand>();
  for (const command of commands) {
    if (command.command.trim()) {
      byCommand.set(command.command, command);
    }
  }
  return Array.from(byCommand.values());
}

type SkytellsDocsSearchResult = {
  id?: string;
  type?: string;
  content?: string;
  breadcrumbs?: string[];
  url?: string;
};

async function searchSkytellsDocs(query: string, tag?: string) {
  const fallbackDocs = [
    {
      title: "Skytells Documentation",
      url: "https://learn.skytells.ai/docs",
      summary: "Skytells product documentation and API references.",
    },
    {
      title: "Skytells Console",
      url: "https://console.skytells.ai",
      summary: "Create or manage Skytells projects and services.",
    },
    {
      title: "Projects",
      url: "https://console.skytells.ai/projects",
      summary: "Create or navigate to a Skytells project.",
    },
    {
      title: "API keys",
      url: "https://console.skytells.ai/settings/api-keys",
      summary: "Create Skytells API keys for model access.",
    },
    {
      title: "Models",
      url: "https://console.skytells.ai/explore/models",
      summary: "Browse Skytells text and code models.",
    },
  ];

  try {
    const retryQuery =
      query.length > 1 ? `${query[0].toUpperCase()}${query.slice(1)}` : query;
    const payload =
      (await fetchSkytellsDocsSearch(query, tag)) ||
      (retryQuery !== query ? await fetchSkytellsDocsSearch(retryQuery, tag) : null);

    const results = (payload ?? [])
      .map((item) => {
        const url = normalizeSkytellsDocsUrl(item.url || item.id || "");
        if (!url) return null;
        const content = String(item.content || "").trim();
        const breadcrumbTitle = item.breadcrumbs?.filter(Boolean).join(" / ");
        const title =
          breadcrumbTitle ||
          content.split("\n").find(Boolean)?.trim() ||
          item.id ||
          "Skytells documentation";
        return {
          title,
          url,
          summary: content || title,
          type: item.type || "result",
          breadcrumbs: item.breadcrumbs ?? [],
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const deduped = dedupeSkytellsDocs(results).slice(0, 10);
    return deduped.length ? deduped : fallbackDocs;
  } catch {
    return fallbackDocs;
  }
}

async function fetchSkytellsDocsSearch(query: string, tag?: string) {
  const params = new URLSearchParams({ query });
  if (tag?.trim()) {
    params.set("tag", tag.trim());
  }

  const response = await fetch(`https://learn.skytells.ai/api/search?${params}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as SkytellsDocsSearchResult[]) : null;
}

function normalizeSkytellsDocsUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (isSafeHttpUrl(raw)) return raw;
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return `https://learn.skytells.ai${withLeadingSlash}`;
}

function dedupeSkytellsDocs<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function searchWeb(query: string) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [] as Array<{ title: string; url: string; snippet: string }>;
    }

    const payload = (await response.json()) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
        Topics?: Array<{ Text?: string; FirstURL?: string }>;
      }>;
    };

    const results: Array<{ title: string; url: string; snippet: string }> = [];

    if (payload.AbstractText && payload.AbstractURL) {
      results.push({
        title: payload.Heading || "DuckDuckGo Result",
        url: payload.AbstractURL,
        snippet: payload.AbstractText,
      });
    }

    for (const topic of payload.RelatedTopics ?? []) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(" - ")[0] || "Related Topic",
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
      for (const nested of topic.Topics ?? []) {
        if (nested.Text && nested.FirstURL) {
          results.push({
            title: nested.Text.split(" - ")[0] || "Related Topic",
            url: nested.FirstURL,
            snippet: nested.Text,
          });
        }
      }
      if (results.length >= 8) break;
    }

    return dedupeSearchResults(results).slice(0, 8);
  } catch {
    return [] as Array<{ title: string; url: string; snippet: string }>;
  }
}

function dedupeSearchResults(results: Array<{ title: string; url: string; snippet: string }>) {
  const seen = new Set<string>();
  return results.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function toStepSources(items: Array<{ url?: string; title?: string }>) {
  const sources: Array<{ url: string; label: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const rawUrl = String(item.url || "").trim();
    if (!isSafeHttpUrl(rawUrl) || seen.has(rawUrl)) continue;
    seen.add(rawUrl);
    const host = safeHostname(rawUrl);
    sources.push({
      url: rawUrl,
      label: host || String(item.title || "source"),
    });
    if (sources.length >= 8) break;
  }
  return sources;
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchWebPage(url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        ok: false as const,
        url,
        status: response.status,
        error: `Failed with status ${response.status}`,
      };
    }

    const html = await response.text();
    const text = extractReadableText(html).slice(0, 8000);

    return {
      ok: true as const,
      url,
      status: response.status,
      content: text,
    };
  } catch {
    return {
      ok: false as const,
      url,
      status: 0,
      error: "Failed to fetch page.",
    };
  }
}

function extractReadableText(html: string) {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const noTags = noScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return noTags;
}

function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildPredictionInput(mediaKind: MediaKind, args: Record<string, unknown>) {
  const input: Record<string, unknown> = {
    prompt: String(args.prompt || "").trim(),
  };

  const aspectRatio = String(args.aspect_ratio || "").trim();
  if (aspectRatio) input.aspect_ratio = aspectRatio;

  const durationSeconds = Number(args.duration_seconds);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    input.duration_seconds = durationSeconds;
  }

  if (mediaKind === "image") {
    const negativePrompt = String(args.negative_prompt || "").trim();
    if (negativePrompt) input.negative_prompt = negativePrompt;
  }

  if (mediaKind === "audio") {
    const lyrics = String(args.lyrics || "").trim();
    const style = String(args.style || "").trim();
    if (lyrics) input.lyrics = lyrics;
    if (style) input.style = style;
  }

  return input;
}

function extractPredictionUrls(output: unknown) {
  const urls = new Set<string>();

  const walk = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string") {
      const maybeUrl = value.trim();
      if (isSafeHttpUrl(maybeUrl)) {
        urls.add(maybeUrl);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        walk(nested);
      }
    }
  };

  walk(output);
  return Array.from(urls).slice(0, 8);
}

function buildTimelineAssistantMessages(input: {
  blocks: Array<{
    content: string;
    steps: AgentStep[];
    startedAt: number;
    finishedAt?: number;
  }>;
  startedAt: number;
  finishedAt: number;
  modelId?: string;
}) {
  return input.blocks
    .filter((block) => block.content.trim() || block.steps.length)
    .map((block) => ({
      content: block.content.trim(),
      metadata: {
        phase: "timeline" as const,
        steps: block.steps,
        startedAt: block.startedAt || input.startedAt,
        finishedAt: block.finishedAt ?? input.finishedAt,
        modelId: input.modelId,
      },
    }));
}

function compactToolCallArguments(toolCall: ToolCall): ToolCall {
  const args = parseToolArguments(toolCall.function.arguments);
  const rawToolName = toolCall.function.name;
  const toolName = normalizeToolName(rawToolName);

  if (toolName === "write_file") {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          path: sanitizePath(readPathArgument(args)),
          language: String(args.language || ""),
        }),
      },
    };
  }

  if (rawToolName === "FetchFromWeb") {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          urls: Array.isArray(args.urls) ? args.urls.slice(0, 4) : [],
        }),
      },
    };
  }

  if (toolName === "fetch_web_page") {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          url: String(args.url || ""),
        }),
      },
    };
  }

  if (
    toolName === "search_web" ||
    toolName === "search_skytells_docs"
  ) {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          query: truncateText(String(args.query || ""), 180),
        }),
      },
    };
  }

  if (
    toolName === "generate_image" ||
    toolName === "generate_video" ||
    toolName === "generate_audio"
  ) {
    return {
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          prompt: truncateText(String(args.prompt || ""), 220),
        }),
      },
    };
  }

  return toolCall;
}

function compactToolResult(parsed: Record<string, unknown>) {
  if (parsed.ok === true && typeof parsed.path === "string") {
    return { ok: true, path: parsed.path };
  }

  const compacted: Record<string, unknown> = { ...parsed };

  if (typeof compacted.content === "string") {
    compacted.content = truncateText(compacted.content, 900);
  }

  if (Array.isArray(compacted.results)) {
    compacted.results = compacted.results
      .slice(0, 4)
      .map((item) => {
        if (!item || typeof item !== "object") return item;
        const value = item as Record<string, unknown>;
        return {
          title: value.title,
          url: value.url,
          snippet:
            typeof value.snippet === "string"
              ? truncateText(value.snippet, 220)
              : value.snippet,
        };
      });
  }

  if (Array.isArray(compacted.urls)) {
    compacted.urls = compacted.urls.slice(0, 4);
  }

  if (typeof compacted.detail === "string") {
    compacted.detail = truncateText(compacted.detail, 220);
  }

  return compacted;
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}

async function generateProgressNote(input: {
  client: NonNullable<ReturnType<typeof getSkytellsClient>>;
  model: string;
  userPrompt: string;
  toolCalls: ToolCall[];
}) {
  const { client, model, userPrompt, toolCalls } = input;
  try {
    const toolsSummary = toolCalls
      .map((call) => {
        const args = parseToolArguments(call.function.arguments);
        const compactArgs = Object.fromEntries(
          Object.entries(args).map(([key, value]) => [
            key,
            typeof value === "string" ? truncateText(value, 90) : value,
          ]),
        );
        return `${call.function.name}(${JSON.stringify(compactArgs)})`;
      })
      .join("; ");

    if (isCompletionsModel(model)) {
      // kimi / moonshot — Chat Completions API
      const completion = await client.chat.completions.create({
        model,
        stream: false,
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Write one short, professional assistant progress update for the user. It must describe what you are doing now and why. Keep it to one sentence.",
          },
          {
            role: "user",
            content: `User request: ${truncateText(userPrompt, 400)}\nPlanned tool calls: ${truncateText(toolsSummary, 800)}`,
          },
        ] as never,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || fallbackProgressNote(toolCalls);
    }

    // All other models — Responses API
    const result = await client.chat.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: 120,
      input: [
        {
          role: "system" as const,
          content:
            "Write one short, professional assistant progress update for the user. It must describe what you are doing now and why. Keep it to one sentence.",
        },
        {
          role: "user" as const,
          content: `User request: ${truncateText(userPrompt, 400)}\nPlanned tool calls: ${truncateText(toolsSummary, 800)}`,
        },
      ],
    } as never);
    const { content } = fromResponsesOutput(
      (result as unknown as ResponsesResult).output,
    );
    return content?.trim() || fallbackProgressNote(toolCalls);
  } catch {
    return fallbackProgressNote(toolCalls);
  }
}

function fallbackProgressNote(toolCalls: ToolCall[]) {
  const names = new Set(toolCalls.map((call) => normalizeToolName(call.function.name)));
  if (names.has("search_web") || names.has("search_skytells_docs")) {
    return "I’m checking the relevant docs and references before making the next change.";
  }
  if (names.has("fetch_web_page")) {
    return "I’m reading the source material so the implementation matches the latest details.";
  }
  if (names.has("write_file")) {
    return "I’m adding files to the generated artifact now.";
  }
  if (
    names.has("generate_image") ||
    names.has("generate_video") ||
    names.has("generate_audio")
  ) {
    return "I’m generating the media assets needed for this project.";
  }
  if (names.has("update_todo_list")) {
    return "I’m syncing the task list for this implementation pass.";
  }
  if (names.has("add_terminal_command")) {
    return "I’m preparing the run commands for the generated project.";
  }
  return "I’m moving through the next implementation step.";
}

function chunkText(text: string) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 24) {
    chunks.push(text.slice(index, index + 24));
  }
  return chunks;
}
