import { NextRequest, NextResponse } from "next/server";
import { deleteChat, getChatById } from "@/lib/infrastructure";

export const runtime = "nodejs";

const CHAT_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type ChatRouteContext = {
  params: {
    id: string;
  };
};

function isValidChatId(id: string) {
  return CHAT_ID_PATTERN.test(id);
}

export async function GET(_request: NextRequest, { params }: ChatRouteContext) {
  const { id } = params;

  if (!id || !isValidChatId(id)) {
    return NextResponse.json(
      { error: { message: "Invalid chat ID.", errorId: "BAD_REQUEST" } },
      { status: 400 },
    );
  }

  try {
    const chat = await getChatById(id);

    if (!chat) {
      return NextResponse.json(
        { error: { message: "Chat not found.", errorId: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ chat });
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Failed to load chat.",
          errorId: "INTERNAL_ERROR",
        },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: ChatRouteContext) {
  const { id } = params;

  if (!id || !isValidChatId(id)) {
    return NextResponse.json(
      { error: { message: "Invalid chat ID.", errorId: "BAD_REQUEST" } },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteChat(id);

    if (!deleted) {
      return NextResponse.json(
        { error: { message: "Chat not found.", errorId: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Failed to delete chat.",
          errorId: "INTERNAL_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
