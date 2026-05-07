import type { CodeFile } from "./types";

export function buildMockOutput(command: string): string[] {
  if (/install|add|i\s/i.test(command)) {
    return [
      `$ ${command}`,
      "Resolving packages...",
      "Fetching packages...",
      "Linking dependencies...",
      "✓ Done",
    ];
  }
  if (/dev|start/i.test(command)) {
    return [
      `$ ${command}`,
      "Starting development server...",
      "▲ Next.js ready",
      "✓ Local: http://localhost:3000",
    ];
  }
  if (/build/i.test(command)) {
    return [`$ ${command}`, "Building for production...", "Compiled successfully.", "✓ Done"];
  }
  return [`$ ${command}`, "Executing...", "✓ Done"];
}

export function detectPackageManager(files: CodeFile[]): string {
  if (files.some((f) => f.path.endsWith("pnpm-lock.yaml"))) return "pnpm";
  if (files.some((f) => f.path.endsWith("yarn.lock"))) return "yarn";
  if (files.some((f) => f.path.endsWith("bun.lockb"))) return "bun";
  return "npm";
}
