import { createClient as createLibsqlClient } from "@libsql/client";
import type { Client as LibsqlClient, InArgs as LibsqlArgs } from "@libsql/client";
import { Client as PostgresClient } from "pg";
import { createClient as createRedisClient } from "redis";
import type {
  Artifact,
  ChatMessageMetadata,
  CodeFile,
} from "@/lib/types";

export type ServiceCheck = {
  ok: boolean;
  name: string;
  message: string;
  latencyMs?: number;
};

export type InfrastructureStatus = {
  ok: boolean;
  libsql: ServiceCheck;
  postgres: ServiceCheck;
  redis: ServiceCheck;
  redisRequired: boolean;
  saas: SaasStatus;
};

export type SaasAuthProvider = "supabase" | "betterauth" | "disabled" | "unknown";
export type SaasBillingProvider = "stripe" | "manual" | "disabled" | "unknown";

export type SaasStatus = {
  enabled: boolean;
  ok: boolean;
  authProvider: SaasAuthProvider;
  billingProvider: SaasBillingProvider;
  message: string;
  requiredEnvironment: string[];
  tables: string[];
};

const SAAS_TABLES = [
  "skytells_saas_users",
  "skytells_saas_organizations",
  "skytells_saas_organization_members",
  "skytells_saas_credit_bundles",
  "skytells_saas_subscriptions",
  "skytells_saas_billing_events",
  "skytells_saas_credit_ledger",
  "skytells_saas_model_usage_events",
  "skytells_saas_entitlements",
  "skytells_saas_customer_api_keys",
] as const;

const postgresUrl = () =>
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.SKYTELLS_POSTGRES_URL ||
  "";

const libsqlUrl = () =>
  process.env.LIBSQL_URL ||
  process.env.SKYTELLS_LIBSQL_URL ||
  "";

const libsqlAuthToken = () =>
  process.env.LIBSQL_AUTH_TOKEN ||
  process.env.SKYTELLS_LIBSQL_AUTH_TOKEN ||
  "";

const redisUrl = () =>
  process.env.REDIS_URL ||
  process.env.KV_URL ||
  process.env.SKYTELLS_REDIS_URL ||
  "";

export async function validateDatabases(): Promise<InfrastructureStatus> {
  const [libsql, postgres, redis] = await Promise.all([
    validateLibsql(),
    validatePostgres(),
    validateRedis(),
  ]);
  const redisConfigured = Boolean(redisUrl());
  const redisRequired = isRedisRequired();
  const coreDatabasesReady =
    libsql.ok && postgres.ok && (!redisConfigured && !redisRequired ? true : redis.ok);
  const saas = getSaasStatus(coreDatabasesReady);

  return {
    ok: coreDatabasesReady && (!saas.enabled || saas.ok),
    libsql,
    postgres,
    redis,
    redisRequired,
    saas,
  };
}

export async function recordUsageEvent(input: {
  model: string;
  prompt: string;
  outputChars: number;
  files: number;
}) {
  const databaseUrl = postgresUrl();
  const cacheUrl = redisUrl();
  const libsqlConnectionUrl = libsqlUrl();

  if (!databaseUrl && !libsqlConnectionUrl) {
    return;
  }

  const event = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  await Promise.allSettled([
    databaseUrl ? writePostgresEvent(databaseUrl, event) : Promise.resolve(),
    libsqlConnectionUrl ? writeLibsqlEvent(input) : Promise.resolve(),
    cacheUrl ? writeRedisEvent(cacheUrl, event) : Promise.resolve(),
  ]);
}

export async function createChatRecord(input: {
  model: string;
  prompt: string;
}) {
  if (libsqlUrl()) {
    return createLibsqlChatRecord(input);
  }

  const databaseUrl = postgresUrl();
  const cacheUrl = redisUrl();

  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    await client.query(
      `insert into code_ai_chats (id, model, prompt, created_at, updated_at)
       values ($1, $2, $3, now(), now())`,
      [id, input.model, input.prompt],
    );
    await client.query(
      `insert into code_ai_messages (chat_id, role, content, created_at)
       values ($1, 'user', $2, now())`,
      [id, input.prompt],
    );
  } finally {
    await client.end();
  }

  if (cacheUrl) {
    const redis = createRedisClient({ url: cacheUrl });
    await redis.connect();
    try {
      await redis.set(
        `skytells-builder:chat:${id}`,
        JSON.stringify({ id, ...input, createdAt }),
        { EX: 60 * 60 * 24 },
      );
    } finally {
      await redis.quit();
    }
  }

  return id;
}

export async function saveAssistantResult(input: {
  chatId: string;
  content: string;
  artifact: Artifact;
  model: string;
  prompt: string;
  metadata?: ChatMessageMetadata;
  assistantMessages?: Array<{
    content: string;
    metadata?: ChatMessageMetadata;
  }>;
}) {
  if (libsqlUrl()) {
    await saveLibsqlAssistantResult(input);
    return;
  }

  const databaseUrl = postgresUrl();
  const cacheUrl = redisUrl();

  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }

  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    const assistantMessages =
      input.assistantMessages?.length
        ? input.assistantMessages
        : [{ content: input.content, metadata: input.metadata }];

    for (const message of assistantMessages) {
      await client.query(
        `insert into code_ai_messages (chat_id, role, content, metadata, created_at)
         values ($1, 'assistant', $2, $3::jsonb, now())`,
        [input.chatId, message.content, JSON.stringify(message.metadata ?? null)],
      );
    }

    await client.query(
      `insert into code_ai_artifacts (chat_id, title, files, preview_html, created_at)
       values ($1, $2, $3::jsonb, $4, now())`,
      [
        input.chatId,
        input.artifact.title,
        JSON.stringify(input.artifact.files),
        input.artifact.previewHtml,
      ],
    );
    await client.query(
      `update code_ai_chats set updated_at = now() where id = $1`,
      [input.chatId],
    );
  } finally {
    await client.end();
  }

  if (cacheUrl) {
    const redis = createRedisClient({ url: cacheUrl });
    await redis.connect();
    try {
      await redis.set(
        `skytells-builder:artifact:${input.chatId}`,
        JSON.stringify(input.artifact),
        { EX: 60 * 60 * 24 },
      );
      await redis.lPush(
        "skytells-builder:recent-chats",
        JSON.stringify({
          id: input.chatId,
          model: input.model,
          prompt: input.prompt,
          files: input.artifact.files.length,
          createdAt: new Date().toISOString(),
        }),
      );
      await redis.lTrim("skytells-builder:recent-chats", 0, 99);
    } finally {
      await redis.quit();
    }
  }
}

export async function saveAssistantMessages(input: {
  chatId: string;
  assistantMessages: Array<{
    content: string;
    metadata?: ChatMessageMetadata;
  }>;
}) {
  if (libsqlUrl()) {
    await saveLibsqlAssistantMessages(input);
    return;
  }

  const databaseUrl = postgresUrl();

  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }

  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    for (const message of input.assistantMessages) {
      await client.query(
        `insert into code_ai_messages (chat_id, role, content, metadata, created_at)
         values ($1, 'assistant', $2, $3::jsonb, now())`,
        [input.chatId, message.content, JSON.stringify(message.metadata ?? null)],
      );
    }
    await client.query(
      `update code_ai_chats set updated_at = now() where id = $1`,
      [input.chatId],
    );
  } finally {
    await client.end();
  }
}

export async function getChatById(id: string) {
  if (libsqlUrl()) {
    return getLibsqlChatById(id);
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) return null;

  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);

    const chatResult = await client.query<{ model: string; prompt: string }>(
      `select model, prompt from code_ai_chats where id = $1`,
      [id],
    );
    if (!chatResult.rows.length) return null;

    const messagesResult = await client.query<{
      role: string;
      content: string;
      metadata: unknown;
    }>(
      `select role, content, metadata from code_ai_messages
       where chat_id = $1 order by id asc`,
      [id],
    );

    const artifactResult = await client.query<{
      title: string;
      files: string;
      preview_html: string;
    }>(
      `select title, files, preview_html from code_ai_artifacts
       where chat_id = $1 order by created_at desc limit 1`,
      [id],
    );

    const row = artifactResult.rows[0];
    const artifact: Artifact | null = row
      ? {
          title: row.title,
          route: "/",
          files: (typeof row.files === "string" ? JSON.parse(row.files) : row.files) as CodeFile[],
          previewHtml: row.preview_html,
          databaseStatus: "not-connected",
          databaseNote: "Loaded from chat history.",
        }
      : null;

    return {
      id,
      model: chatResult.rows[0].model,
      messages: messagesResult.rows.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        metadata: m.metadata
          ? ((typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata) as ChatMessageMetadata)
          : null,
      })),
      artifact,
    };
  } finally {
    await client.end();
  }
}

export async function listRecentChats() {
  if (libsqlUrl()) {
    return listLibsqlRecentChats();
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }

  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    const result = await client.query<{
      id: string;
      model: string;
      prompt: string;
      updated_at: string;
      artifact_count: string;
    }>(`
      select
        c.id,
        c.model,
        c.prompt,
        c.updated_at::text,
        count(a.id)::text as artifact_count
      from code_ai_chats c
      left join code_ai_artifacts a on a.chat_id = c.id
      group by c.id
      order by c.updated_at desc
      limit 20
    `);

    return result.rows.map((row) => ({
      id: row.id,
      model: row.model,
      prompt: row.prompt,
      updatedAt: row.updated_at,
      artifactCount: Number(row.artifact_count),
    }));
  } finally {
    await client.end();
  }
}

export async function deleteChat(id: string): Promise<boolean> {
  if (libsqlUrl()) {
    return deleteLibsqlChat(id);
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }

  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    const result = await client.query(
      `delete from code_ai_chats where id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

async function deleteLibsqlChat(id: string): Promise<boolean> {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    const result = await client.execute({
      sql: `delete from code_ai_chats where id = ?`,
      args: [id],
    });
    return (result.rowsAffected ?? 0) > 0;
  } finally {
    client.close();
  }
}

export type McpConfigRow = {
  id: string;
  name: string;
  config: unknown;
  createdAt: string;
};

export async function listMcpConfigs(): Promise<McpConfigRow[]> {
  if (libsqlUrl()) {
    return listLibsqlMcpConfigs();
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }
  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    const result = await client.query<{
      id: string;
      name: string;
      config: unknown;
      created_at: string;
    }>(`select id, name, config, created_at::text from code_ai_mcps order by created_at desc`);
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      config: row.config,
      createdAt: row.created_at,
    }));
  } finally {
    await client.end();
  }
}

export async function createMcpConfig(input: {
  name: string;
  config: unknown;
}): Promise<McpConfigRow> {
  if (libsqlUrl()) {
    return createLibsqlMcpConfig(input);
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }
  const client = await openPostgresClient(databaseUrl);
  const id = crypto.randomUUID();
  try {
    await ensureSchema(client);
    await client.query(
      `insert into code_ai_mcps (id, name, config, created_at) values ($1, $2, $3::jsonb, now())`,
      [id, input.name, JSON.stringify(input.config)],
    );
    return {
      id,
      name: input.name,
      config: input.config,
      createdAt: new Date().toISOString(),
    };
  } finally {
    await client.end();
  }
}

export async function deleteMcpConfig(id: string): Promise<boolean> {
  if (libsqlUrl()) {
    return deleteLibsqlMcpConfig(id);
  }

  const databaseUrl = postgresUrl();
  if (!databaseUrl) {
    throw new Error("Postgres URL is required.");
  }
  const client = await openPostgresClient(databaseUrl);
  try {
    await ensureSchema(client);
    const result = await client.query(`delete from code_ai_mcps where id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

function openLibsqlClient() {
  const rawUrl = libsqlUrl();
  if (!rawUrl) {
    throw new Error("LIBSQL_URL is required.");
  }

  // @libsql/client uses the fetch API internally, which rejects URLs with
  // embedded credentials (http://user:pass@host). Strip them and inject a
  // custom fetch wrapper that adds the correct Authorization header.
  // Skytells libSQL uses HTTP Basic auth; Bearer auth (authToken) is separate.
  let url = rawUrl;
  const authToken = libsqlAuthToken();
  let customFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      const basicCreds = Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64");
      parsed.username = "";
      parsed.password = "";
      url = parsed.toString();
      // Inject Basic auth header on every request
      customFetch = (input, init) => {
        const headers = new Headers((init as RequestInit)?.headers);
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Basic ${basicCreds}`);
        }
        return fetch(input, { ...(init as RequestInit), headers });
      };
    }
  } catch {
    // malformed URL — let createLibsqlClient surface the error
  }

  return createLibsqlClient({
    url,
    authToken: authToken || undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch: customFetch as any,
  });
}

async function validateLibsql(): Promise<ServiceCheck> {
  const url = libsqlUrl();
  const started = Date.now();

  if (!url) {
    return {
      ok: false,
      name: "libSQL",
      message:
        "Missing LIBSQL_URL. Deploy libSQL from Skytells Console > Project > Databases.",
    };
  }

  const client = openLibsqlClient();
  try {
    await withTimeout(ensureLibsqlSchema(client), 8000, "libSQL schema validation timed out.");
    await withTimeout(client.execute("select 1"), 5000, "libSQL ping timed out.");

    return {
      ok: true,
      name: "libSQL",
      message: "Connected and schema is ready.",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      name: "libSQL",
      message: error instanceof Error ? error.message : "libSQL validation failed.",
      latencyMs: Date.now() - started,
    };
  } finally {
    client.close();
  }
}

async function createLibsqlChatRecord(input: {
  model: string;
  prompt: string;
}) {
  const id = crypto.randomUUID();
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    await client.batch(
      [
        {
          sql: `insert into code_ai_chats (id, model, prompt, created_at, updated_at)
                values (?, ?, ?, current_timestamp, current_timestamp)`,
          args: [id, input.model, input.prompt],
        },
        {
          sql: `insert into code_ai_messages (chat_id, role, content, created_at)
                values (?, 'user', ?, current_timestamp)`,
          args: [id, input.prompt],
        },
      ],
      "write",
    );
    return id;
  } finally {
    client.close();
  }
}

async function saveLibsqlAssistantResult(input: {
  chatId: string;
  content: string;
  artifact: Artifact;
  model: string;
  prompt: string;
  metadata?: ChatMessageMetadata;
  assistantMessages?: Array<{
    content: string;
    metadata?: ChatMessageMetadata;
  }>;
}) {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    const assistantMessages =
      input.assistantMessages?.length
        ? input.assistantMessages
        : [{ content: input.content, metadata: input.metadata }];

    const statements = assistantMessages.map((message) => ({
      sql: `insert into code_ai_messages (chat_id, role, content, metadata, created_at)
            values (?, 'assistant', ?, ?, current_timestamp)`,
      args: [
        input.chatId,
        message.content,
        JSON.stringify(message.metadata ?? null),
      ] satisfies LibsqlArgs,
    }));

    await client.batch(
      [
        ...statements,
        {
          sql: `insert into code_ai_artifacts (chat_id, title, files, preview_html, created_at)
                values (?, ?, ?, ?, current_timestamp)`,
          args: [
            input.chatId,
            input.artifact.title,
            JSON.stringify(input.artifact.files),
            input.artifact.previewHtml,
          ],
        },
        {
          sql: `update code_ai_chats set updated_at = current_timestamp where id = ?`,
          args: [input.chatId],
        },
      ],
      "write",
    );
  } finally {
    client.close();
  }

  const cacheUrl = redisUrl();
  if (cacheUrl) {
    const redis = createRedisClient({ url: cacheUrl });
    await redis.connect();
    try {
      await redis.set(
        `skytells-builder:artifact:${input.chatId}`,
        JSON.stringify(input.artifact),
        { EX: 60 * 60 * 24 },
      );
      await redis.lPush(
        "skytells-builder:recent-chats",
        JSON.stringify({
          id: input.chatId,
          model: input.model,
          prompt: input.prompt,
          files: input.artifact.files.length,
          createdAt: new Date().toISOString(),
        }),
      );
      await redis.lTrim("skytells-builder:recent-chats", 0, 99);
    } finally {
      await redis.quit();
    }
  }
}

async function saveLibsqlAssistantMessages(input: {
  chatId: string;
  assistantMessages: Array<{
    content: string;
    metadata?: ChatMessageMetadata;
  }>;
}) {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    await client.batch(
      [
        ...input.assistantMessages.map((message) => ({
          sql: `insert into code_ai_messages (chat_id, role, content, metadata, created_at)
                values (?, 'assistant', ?, ?, current_timestamp)`,
          args: [
            input.chatId,
            message.content,
            JSON.stringify(message.metadata ?? null),
          ] satisfies LibsqlArgs,
        })),
        {
          sql: `update code_ai_chats set updated_at = current_timestamp where id = ?`,
          args: [input.chatId],
        },
      ],
      "write",
    );
  } finally {
    client.close();
  }
}

async function getLibsqlChatById(id: string) {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);

    const chatResult = await client.execute({
      sql: `select model, prompt from code_ai_chats where id = ?`,
      args: [id],
    });
    const chat = chatResult.rows[0] as Record<string, unknown> | undefined;
    if (!chat) return null;

    const messagesResult = await client.execute({
      sql: `select role, content, metadata from code_ai_messages
            where chat_id = ? order by id asc`,
      args: [id],
    });

    const artifactResult = await client.execute({
      sql: `select title, files, preview_html from code_ai_artifacts
            where chat_id = ? order by created_at desc, id desc limit 1`,
      args: [id],
    });

    const row = artifactResult.rows[0] as Record<string, unknown> | undefined;
    const artifact: Artifact | null = row
      ? {
          title: String(row.title || ""),
          route: "/",
          files: parseJsonValue<CodeFile[]>(row.files, []),
          previewHtml: String(row.preview_html || ""),
          databaseStatus: "connected",
          databaseNote: "Loaded from Skytells libSQL history.",
        }
      : null;

    return {
      id,
      model: String(chat.model || ""),
      messages: messagesResult.rows.map((message) => {
        const row = message as Record<string, unknown>;
        return {
          role: row.role as "user" | "assistant",
          content: String(row.content || ""),
          metadata: parseJsonValue<ChatMessageMetadata | null>(row.metadata, null),
        };
      }),
      artifact,
    };
  } finally {
    client.close();
  }
}

async function listLibsqlRecentChats() {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    const result = await client.execute(`
      select
        c.id,
        c.model,
        c.prompt,
        c.updated_at,
        cast(count(a.id) as text) as artifact_count
      from code_ai_chats c
      left join code_ai_artifacts a on a.chat_id = c.id
      group by c.id
      order by c.updated_at desc
      limit 20
    `);

    return result.rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || ""),
        model: String(item.model || ""),
        prompt: String(item.prompt || ""),
        updatedAt: String(item.updated_at || ""),
        artifactCount: Number(item.artifact_count || 0),
      };
    });
  } finally {
    client.close();
  }
}

async function listLibsqlMcpConfigs(): Promise<McpConfigRow[]> {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    const result = await client.execute(
      `select id, name, config, created_at from code_ai_mcps order by created_at desc`,
    );
    return result.rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || ""),
        name: String(item.name || ""),
        config: parseJsonValue(item.config, {}),
        createdAt: String(item.created_at || ""),
      };
    });
  } finally {
    client.close();
  }
}

async function createLibsqlMcpConfig(input: {
  name: string;
  config: unknown;
}): Promise<McpConfigRow> {
  const id = crypto.randomUUID();
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    await client.execute({
      sql: `insert into code_ai_mcps (id, name, config, created_at)
            values (?, ?, ?, current_timestamp)`,
      args: [id, input.name, JSON.stringify(input.config)],
    });
    return {
      id,
      name: input.name,
      config: input.config,
      createdAt: new Date().toISOString(),
    };
  } finally {
    client.close();
  }
}

async function deleteLibsqlMcpConfig(id: string): Promise<boolean> {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    const result = await client.execute({
      sql: `delete from code_ai_mcps where id = ?`,
      args: [id],
    });
    return result.rowsAffected > 0;
  } finally {
    client.close();
  }
}

async function validatePostgres(): Promise<ServiceCheck> {
  const url = postgresUrl();
  const started = Date.now();
  let client: PostgresClient | undefined;

  if (!url) {
    return {
      ok: false,
      name: "Postgres",
      message:
        "Missing POSTGRES_URL or DATABASE_URL. Deploy Postgres from Skytells Console > Project > Databases.",
    };
  }

  try {
    client = await withTimeout(
      openPostgresClient(url),
      8000,
      "Postgres connection timed out.",
    );
    await withTimeout(ensureSchema(client), 8000, "Postgres schema validation timed out.");
    await withTimeout(client.query("select 1"), 5000, "Postgres ping timed out.");

    return {
      ok: true,
      name: "Postgres",
      message: "Connected and schema is ready.",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      name: "Postgres",
      message: error instanceof Error ? error.message : "Postgres validation failed.",
      latencyMs: Date.now() - started,
    };
  } finally {
    await client?.end().catch(() => undefined);
  }
}

async function ensureSchema(client: PostgresClient) {
  await client.query(`
    create table if not exists code_ai_chats (
      id uuid primary key,
      model text not null,
      prompt text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists code_ai_messages (
      id bigserial primary key,
      chat_id uuid not null references code_ai_chats(id) on delete cascade,
      role text not null check (role in ('user', 'assistant', 'tool')),
      content text not null,
      metadata jsonb,
      created_at timestamptz not null default now()
    );

    alter table code_ai_messages
      add column if not exists metadata jsonb;

    create table if not exists code_ai_artifacts (
      id bigserial primary key,
      chat_id uuid not null references code_ai_chats(id) on delete cascade,
      title text not null,
      files jsonb not null,
      preview_html text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists code_ai_events (
      id bigserial primary key,
      model text not null,
      prompt text not null,
      output_chars integer not null default 0,
      files integer not null default 0,
      created_at timestamptz not null default now()
    );

    create table if not exists code_ai_mcps (
      id uuid primary key,
      name text not null,
      config jsonb not null,
      created_at timestamptz not null default now()
    );
  `);

  if (isSaasModeEnabled()) {
    await ensureSaasSchema(client);
  }
}

async function ensureLibsqlSchema(client: LibsqlClient) {
  await client.batch(
    [
      `create table if not exists code_ai_chats (
        id text primary key,
        model text not null,
        prompt text not null,
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists code_ai_messages (
        id integer primary key autoincrement,
        chat_id text not null references code_ai_chats(id) on delete cascade,
        role text not null check (role in ('user', 'assistant', 'tool')),
        content text not null,
        metadata text,
        created_at text not null default current_timestamp
      )`,
      `create table if not exists code_ai_artifacts (
        id integer primary key autoincrement,
        chat_id text not null references code_ai_chats(id) on delete cascade,
        title text not null,
        files text not null,
        preview_html text not null,
        created_at text not null default current_timestamp
      )`,
      `create table if not exists code_ai_events (
        id integer primary key autoincrement,
        model text not null,
        prompt text not null,
        output_chars integer not null default 0,
        files integer not null default 0,
        created_at text not null default current_timestamp
      )`,
      `create table if not exists code_ai_mcps (
        id text primary key,
        name text not null,
        config text not null,
        created_at text not null default current_timestamp
      )`,
    ],
    "write",
  );

  if (isSaasModeEnabled()) {
    await ensureLibsqlSaasSchema(client);
  }
}

function isSaasModeEnabled() {
  return process.env.SAAS_MODE === "true";
}

function isRedisRequired() {
  return process.env.REDIS_REQUIRED === "true";
}

function getSaasAuthProvider(): SaasAuthProvider {
  if (!isSaasModeEnabled()) return "disabled";
  const provider = (process.env.SAAS_AUTH_PROVIDER || "").trim().toLowerCase();
  if (provider === "supabase" || provider === "betterauth") return provider;
  return "unknown";
}

function getSaasBillingProvider(): SaasBillingProvider {
  if (!isSaasModeEnabled()) return "disabled";
  const provider = (process.env.SAAS_BILLING_PROVIDER || "manual").trim().toLowerCase();
  if (provider === "stripe" || provider === "manual") return provider;
  return "unknown";
}

export function getSaasStatus(databasesReady = true): SaasStatus {
  const enabled = isSaasModeEnabled();
  const authProvider = getSaasAuthProvider();
  const billingProvider = getSaasBillingProvider();
  const requiredEnvironment = getSaasRequiredEnvironment(authProvider, billingProvider);
  const missing = requiredEnvironment.filter((key) => !process.env[key]?.trim());
  const ok =
    !enabled ||
    (databasesReady &&
      (authProvider === "supabase" || authProvider === "betterauth") &&
      (billingProvider === "stripe" || billingProvider === "manual") &&
      missing.length === 0);

  return {
    enabled,
    ok,
    authProvider,
    billingProvider,
    requiredEnvironment,
    tables: [...SAAS_TABLES],
    message: !enabled
      ? "SaaS mode is disabled. Set SAAS_MODE=true to create SaaS tables across Skytells Postgres and libSQL."
      : ok
        ? `SaaS mode is enabled with ${authProvider} auth and ${billingProvider} billing.`
        : [
            !databasesReady ? "Skytells Postgres and libSQL must both be connected." : "",
            authProvider === "unknown"
              ? "Set SAAS_AUTH_PROVIDER to supabase or betterauth."
              : "",
            billingProvider === "unknown"
              ? "Set SAAS_BILLING_PROVIDER to stripe or manual."
              : "",
            missing.length ? `Missing env: ${missing.join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
  };
}

function getSaasRequiredEnvironment(
  authProvider: SaasAuthProvider,
  billingProvider: SaasBillingProvider,
) {
  const required = ["LIBSQL_URL", "POSTGRES_URL"];

  if (authProvider === "supabase") {
    required.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  }

  if (authProvider === "betterauth") {
    required.push("BETTER_AUTH_SECRET", "BETTER_AUTH_URL");
  }

  if (billingProvider === "stripe") {
    required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET");
  }

  return required;
}

async function ensureSaasSchema(client: PostgresClient) {
  await client.query(`
    create extension if not exists pgcrypto;

    create table if not exists skytells_saas_users (
      id uuid primary key default gen_random_uuid(),
      auth_provider text not null check (auth_provider in ('supabase', 'betterauth')),
      auth_user_id text not null,
      email text not null,
      name text,
      avatar_url text,
      role text not null default 'user' check (role in ('user', 'admin')),
      status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (auth_provider, auth_user_id),
      unique (email)
    );

    create table if not exists skytells_saas_organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      owner_user_id uuid not null references skytells_saas_users(id) on delete restrict,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_organization_members (
      organization_id uuid not null references skytells_saas_organizations(id) on delete cascade,
      user_id uuid not null references skytells_saas_users(id) on delete cascade,
      role text not null default 'member' check (role in ('owner', 'admin', 'member')),
      created_at timestamptz not null default now(),
      primary key (organization_id, user_id)
    );

    create table if not exists skytells_saas_credit_bundles (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      credits integer not null check (credits > 0),
      price_cents integer not null check (price_cents >= 0),
      currency text not null default 'usd',
      interval text check (interval in ('one_time', 'month', 'year')),
      active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references skytells_saas_users(id) on delete cascade,
      organization_id uuid references skytells_saas_organizations(id) on delete cascade,
      bundle_id uuid references skytells_saas_credit_bundles(id) on delete set null,
      provider text not null default 'manual',
      provider_customer_id text,
      provider_subscription_id text unique,
      status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean not null default false,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_billing_events (
      id uuid primary key default gen_random_uuid(),
      provider text not null,
      provider_event_id text not null unique,
      event_type text not null,
      user_id uuid references skytells_saas_users(id) on delete set null,
      subscription_id uuid references skytells_saas_subscriptions(id) on delete set null,
      payload jsonb not null,
      processed_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_credit_ledger (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references skytells_saas_users(id) on delete cascade,
      organization_id uuid references skytells_saas_organizations(id) on delete cascade,
      delta integer not null,
      balance_after integer,
      reason text not null,
      reference_type text,
      reference_id text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_model_usage_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references skytells_saas_users(id) on delete set null,
      organization_id uuid references skytells_saas_organizations(id) on delete set null,
      model text not null,
      prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
      completion_tokens integer not null default 0 check (completion_tokens >= 0),
      total_tokens integer not null default 0 check (total_tokens >= 0),
      credits_charged integer not null default 0 check (credits_charged >= 0),
      request_id text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists skytells_saas_entitlements (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references skytells_saas_users(id) on delete cascade,
      organization_id uuid references skytells_saas_organizations(id) on delete cascade,
      key text not null,
      value jsonb not null default 'true'::jsonb,
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      check (user_id is not null or organization_id is not null)
    );

    create table if not exists skytells_saas_customer_api_keys (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references skytells_saas_users(id) on delete cascade,
      organization_id uuid references skytells_saas_organizations(id) on delete cascade,
      name text not null,
      key_prefix text not null,
      key_hash text not null unique,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    );

    create index if not exists skytells_saas_users_auth_idx
      on skytells_saas_users(auth_provider, auth_user_id);
    create index if not exists skytells_saas_credit_ledger_user_created_idx
      on skytells_saas_credit_ledger(user_id, created_at desc);
    create index if not exists skytells_saas_usage_user_created_idx
      on skytells_saas_model_usage_events(user_id, created_at desc);
    create index if not exists skytells_saas_subscriptions_user_status_idx
      on skytells_saas_subscriptions(user_id, status);
    create index if not exists skytells_saas_entitlements_user_key_idx
      on skytells_saas_entitlements(user_id, key);
  `);
}

async function ensureLibsqlSaasSchema(client: LibsqlClient) {
  await client.batch(
    [
      `create table if not exists skytells_saas_users (
        id text primary key,
        auth_provider text not null check (auth_provider in ('supabase', 'betterauth')),
        auth_user_id text not null,
        email text not null unique,
        name text,
        avatar_url text,
        role text not null default 'user' check (role in ('user', 'admin')),
        status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
        metadata text not null default '{}',
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        unique (auth_provider, auth_user_id)
      )`,
      `create table if not exists skytells_saas_organizations (
        id text primary key,
        name text not null,
        slug text not null unique,
        owner_user_id text not null references skytells_saas_users(id) on delete restrict,
        metadata text not null default '{}',
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_organization_members (
        organization_id text not null references skytells_saas_organizations(id) on delete cascade,
        user_id text not null references skytells_saas_users(id) on delete cascade,
        role text not null default 'member' check (role in ('owner', 'admin', 'member')),
        created_at text not null default current_timestamp,
        primary key (organization_id, user_id)
      )`,
      `create table if not exists skytells_saas_credit_bundles (
        id text primary key,
        name text not null,
        slug text not null unique,
        credits integer not null check (credits > 0),
        price_cents integer not null check (price_cents >= 0),
        currency text not null default 'usd',
        interval text check (interval in ('one_time', 'month', 'year')),
        active integer not null default 1,
        metadata text not null default '{}',
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_subscriptions (
        id text primary key,
        user_id text not null references skytells_saas_users(id) on delete cascade,
        organization_id text references skytells_saas_organizations(id) on delete cascade,
        bundle_id text references skytells_saas_credit_bundles(id) on delete set null,
        provider text not null default 'manual',
        provider_customer_id text,
        provider_subscription_id text unique,
        status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
        current_period_start text,
        current_period_end text,
        cancel_at_period_end integer not null default 0,
        metadata text not null default '{}',
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_billing_events (
        id text primary key,
        provider text not null,
        provider_event_id text not null unique,
        event_type text not null,
        user_id text references skytells_saas_users(id) on delete set null,
        subscription_id text references skytells_saas_subscriptions(id) on delete set null,
        payload text not null,
        processed_at text,
        created_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_credit_ledger (
        id text primary key,
        user_id text not null references skytells_saas_users(id) on delete cascade,
        organization_id text references skytells_saas_organizations(id) on delete cascade,
        delta integer not null,
        balance_after integer,
        reason text not null,
        reference_type text,
        reference_id text,
        metadata text not null default '{}',
        created_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_model_usage_events (
        id text primary key,
        user_id text references skytells_saas_users(id) on delete set null,
        organization_id text references skytells_saas_organizations(id) on delete set null,
        model text not null,
        prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
        completion_tokens integer not null default 0 check (completion_tokens >= 0),
        total_tokens integer not null default 0 check (total_tokens >= 0),
        credits_charged integer not null default 0 check (credits_charged >= 0),
        request_id text,
        metadata text not null default '{}',
        created_at text not null default current_timestamp
      )`,
      `create table if not exists skytells_saas_entitlements (
        id text primary key,
        user_id text references skytells_saas_users(id) on delete cascade,
        organization_id text references skytells_saas_organizations(id) on delete cascade,
        key text not null,
        value text not null default 'true',
        expires_at text,
        created_at text not null default current_timestamp,
        check (user_id is not null or organization_id is not null)
      )`,
      `create table if not exists skytells_saas_customer_api_keys (
        id text primary key,
        user_id text not null references skytells_saas_users(id) on delete cascade,
        organization_id text references skytells_saas_organizations(id) on delete cascade,
        name text not null,
        key_prefix text not null,
        key_hash text not null unique,
        last_used_at text,
        revoked_at text,
        created_at text not null default current_timestamp
      )`,
      `create index if not exists skytells_saas_users_auth_idx
        on skytells_saas_users(auth_provider, auth_user_id)`,
      `create index if not exists skytells_saas_credit_ledger_user_created_idx
        on skytells_saas_credit_ledger(user_id, created_at desc)`,
      `create index if not exists skytells_saas_usage_user_created_idx
        on skytells_saas_model_usage_events(user_id, created_at desc)`,
      `create index if not exists skytells_saas_subscriptions_user_status_idx
        on skytells_saas_subscriptions(user_id, status)`,
      `create index if not exists skytells_saas_entitlements_user_key_idx
        on skytells_saas_entitlements(user_id, key)`,
    ],
    "write",
  );
}

async function validateRedis(): Promise<ServiceCheck> {
  const url = redisUrl();
  const started = Date.now();

  if (!url) {
    return {
      ok: !isRedisRequired(),
      name: "Redis",
      message: isRedisRequired()
        ? "Missing REDIS_URL. Set REDIS_URL or set REDIS_REQUIRED=false."
        : "Optional. Add REDIS_URL to enable faster active-state caching.",
    };
  }

  const client = createRedisClient({ url });

  try {
    client.on("error", () => undefined);
    await withTimeout(client.connect(), 8000, "Redis connection timed out.");
    const pong = await withTimeout(client.ping(), 5000, "Redis ping timed out.");
    await withTimeout(
      client.set("skytells-builder:health", new Date().toISOString(), { EX: 120 }),
      5000,
      "Redis write validation timed out.",
    );

    return {
      ok: pong === "PONG",
      name: "Redis",
      message: pong === "PONG" ? "Connected and writable." : "Redis ping failed.",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      name: "Redis",
      message: error instanceof Error ? error.message : "Redis validation failed.",
      latencyMs: Date.now() - started,
    };
  } finally {
    await client.quit().catch(() => undefined);
  }
}

async function writePostgresEvent(
  databaseUrl: string,
  event: {
    model: string;
    prompt: string;
    outputChars: number;
    files: number;
  },
) {
  const client = await openPostgresClient(databaseUrl);
  try {
    await client.query(
      `insert into code_ai_events (model, prompt, output_chars, files)
       values ($1, $2, $3, $4)`,
      [event.model, event.prompt, event.outputChars, event.files],
    );
  } finally {
    await client.end();
  }
}

async function writeLibsqlEvent(event: {
  model: string;
  prompt: string;
  outputChars: number;
  files: number;
}) {
  const client = openLibsqlClient();
  try {
    await ensureLibsqlSchema(client);
    await client.execute({
      sql: `insert into code_ai_events (model, prompt, output_chars, files)
            values (?, ?, ?, ?)`,
      args: [event.model, event.prompt, event.outputChars, event.files],
    });
  } finally {
    client.close();
  }
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function writeRedisEvent(
  redisConnectionUrl: string,
  event: { model: string; createdAt: string },
) {
  const client = createRedisClient({ url: redisConnectionUrl });
  await client.connect();
  try {
    await client.lPush("skytells-builder:events", JSON.stringify(event));
    await client.lTrim("skytells-builder:events", 0, 199);
  } finally {
    await client.quit();
  }
}

async function openPostgresClient(connectionString: string) {
  const ssl =
    process.env.POSTGRES_SSL === "disable"
      ? undefined
      : { rejectUnauthorized: false };
  const client = new PostgresClient({ connectionString, ssl });

  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    const canRetryWithoutSsl =
      process.env.POSTGRES_SSL !== "require" &&
      /does not support SSL|no pg_hba.*SSL|SSL off/i.test(message);

    if (!canRetryWithoutSsl) {
      throw error;
    }

    const fallback = new PostgresClient({ connectionString });
    await fallback.connect();
    return fallback;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
