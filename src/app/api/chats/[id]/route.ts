import { NextRequest, NextResponse } from "next/server";
import { deleteChat, getChatById } from "@/lib/infrastructure";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
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
      { error: { message: "Failed to load chat.", errorId: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
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
      { error: { message: "Failed to delete chat.", errorId: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
