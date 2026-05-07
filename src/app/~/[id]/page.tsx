import type { Metadata } from "next";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `Workspace ${id.slice(0, 8)}`,
    description:
      "Review a Skytells Spark workspace with generated code, assets, reasoning steps, terminal guidance, and previews.",
  };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatPageClient chatId={id} />;
}
