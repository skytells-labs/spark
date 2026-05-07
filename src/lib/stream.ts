import type { AgentStep, Artifact } from "./types";

export type StreamHandlers = {
  delta: (data: { token: string }) => void;
  step: (data: AgentStep) => void;
  progress?: (data: { content: string }) => void;
  usage?: (data: { usage: unknown; modelId?: string }) => void;
  artifact: (data: { artifact: Artifact | null }) => void;
  error: (data: { message: string; errorId: string }) => void;
  done?: (data: { ok: boolean; chatId: string }) => void;
};

function parseServerEvent(raw: string) {
  const name = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim();
  const data = raw.match(/^data:\s*(.+)$/m)?.[1];
  if (!name || !data) return null;
  return { name, data: JSON.parse(data) as unknown };
}

export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const raw of events) {
      const event = parseServerEvent(raw);
      if (!event) continue;

      if (event.name === "error") {
        handlers.error(event.data as { message: string; errorId: string });
        continue;
      }
      if (event.name === "delta") handlers.delta(event.data as { token: string });
      if (event.name === "step") handlers.step(event.data as AgentStep);
      if (event.name === "progress" && handlers.progress)
        handlers.progress(event.data as { content: string });
      if (event.name === "usage" && handlers.usage)
        handlers.usage(event.data as { usage: unknown; modelId?: string });
      if (event.name === "artifact")
        handlers.artifact(event.data as { artifact: Artifact | null });
      if (event.name === "done" && handlers.done)
        handlers.done(event.data as { ok: boolean; chatId: string });
    }
  }
}
