import type { Metadata } from "next";
import { ChatPageClient } from "@/components/chat/chat-page-client";

type ChatPageProps = {
  params: {
    id: string;
  };
};

export function generateMetadata({ params }: ChatPageProps): Metadata {
  const { id } = params;

  return {
    title: `Workspace ${id.slice(0, 8)}`,
    description:
      "Review a Skytells Spark workspace with generated code, assets, reasoning steps, terminal guidance, and previews.",
  };
}

export default function ChatPage({ params }: ChatPageProps) {
  return <ChatPageClient chatId={params.id} />;
}
