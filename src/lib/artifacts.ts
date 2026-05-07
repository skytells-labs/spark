import type { Artifact, CodeFile } from "@/lib/types";

const fileFencePattern =
  /```([a-zA-Z0-9_-]+)?[ \t]*(?:filename=|file=|path=)?([^\n`]*)\n([\s\S]*?)```/g;

export function extractFilesFromMarkdown(markdown: string): CodeFile[] {
  const files: CodeFile[] = [];
  let match: RegExpExecArray | null;

  while ((match = fileFencePattern.exec(markdown)) !== null) {
    const language = (match[1] || "txt").trim();
    const rawMeta = (match[2] || "").trim();
    const path = normalizePath(rawMeta);

    if (!path || !isProjectPath(path)) {
      continue;
    }

    files.push({
      path,
      language: inferLanguage(path, language),
      content: match[3].replace(/\n$/, ""),
    });
  }

  return dedupeFiles(files);
}

export function createArtifactFromMarkdown(
  title: string,
  markdown: string,
): Artifact | null {
  const files = extractFilesFromMarkdown(markdown);

  if (files.length === 0) {
    return null;
  }

  return {
    title: titleFromPrompt(title),
    route: "/",
    files,
    previewHtml: createPreviewHtml(files),
    databaseStatus: "not-connected",
    databaseNote:
      "No Skytells database is attached yet. Deploy one from Console > Projects > Databases when this project needs persistence.",
  };
}

export function createArtifactFromFiles(
  title: string,
  files: CodeFile[],
): Artifact | null {
  if (files.length === 0) {
    return null;
  }

  return {
    title: titleFromPrompt(title),
    route: "/",
    files: dedupeFiles(files),
    previewHtml: createPreviewHtml(files),
    databaseStatus: "not-connected",
    databaseNote:
      "Skytells Postgres and libSQL are required and validated by Skytells Spark before generation. Redis is optional for cache, queues, sessions, and counters.",
  };
}

function normalizePath(meta: string) {
  const first = meta
    .split(/\s+/)
    .find((part) => part.includes("/") || part.includes("."));

  return first
    ?.replace(/^["']|["']$/g, "")
    .replace(/^\.?\//, "")
    .trim();
}

function isProjectPath(path: string) {
  return (
    !path.includes("..") &&
    !path.startsWith("/") &&
    /^[a-zA-Z0-9._/@-]+$/.test(path) &&
    path.length < 160
  );
}

function inferLanguage(path: string, fallback: string) {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "md";
  if (path.endsWith(".html")) return "html";
  return fallback || "txt";
}

function dedupeFiles(files: CodeFile[]) {
  const byPath = new Map<string, CodeFile>();
  for (const file of files) {
    byPath.set(file.path, file);
  }
  return Array.from(byPath.values()).slice(0, 40);
}

function titleFromPrompt(prompt: string) {
  return (
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 5)
      .join(" ") || "code ai project"
  );
}

function createPreviewHtml(files: CodeFile[]) {
  const htmlFile = files.find((file) => file.path.endsWith(".html"));
  if (htmlFile) {
    return htmlFile.content;
  }

  const page = files.find((file) => /app\/.*page\.tsx$/.test(file.path));
  const css = files
    .filter((file) => file.path.endsWith(".css"))
    .map((file) => file.content)
    .join("\n");

  const headline =
    page?.content
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Generated project";

  const paragraph =
    page?.content
      .match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Skytells Spark generated files for this artifact.";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      ${css}
      html, body { margin: 0; min-height: 100%; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
      section { max-width: 860px; text-align: center; }
      h1 { font-size: clamp(42px, 8vw, 88px); line-height: .96; margin: 0; }
      p { color: #a1a1a1; font-size: 18px; line-height: 1.65; max-width: 680px; margin: 24px auto 0; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${escapeHtml(headline)}</h1>
        <p>${escapeHtml(paragraph)}</p>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
