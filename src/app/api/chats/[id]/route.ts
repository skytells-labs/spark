import { NextRequest, NextResponse } from "next/server";
import { deleteChat, getChatById } from "@/lib/infrastructure";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json(
      { error: { message: "Invalid chat ID.", errorId: "BAD_REQUEST" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const chat = await getChatById(id);
    if (!chat) {
      return NextResponse.json(
        { error: { message: "Chat not found.", errorId: "NOT_FOUND" } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { chat },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: { message: "Failed to load chat.", errorId: "INTERNAL_ERROR" } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json(
      { error: { message: "Invalid chat ID.", errorId: "BAD_REQUEST" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const deleted = await deleteChat(id);
    if (!deleted) {
      return NextResponse.json(
        { error: { message: "Chat not found.", errorId: "NOT_FOUND" } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Failed to delete chat.", errorId: "INTERNAL_ERROR" } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
