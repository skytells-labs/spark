import type { Metadata } from "next";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const { id } = params;

  return {
    title: `Workspace ${id.slice(0, 8)}`,
    description:
      "Review a Skytells Spark workspace with generated code, assets, reasoning steps, terminal guidance, and previews.",
  };
}

export default function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  return <ChatPageClient chatId={id} />;
}
