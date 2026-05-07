import { NextResponse } from "next/server";
import { listRecentChats } from "@/lib/infrastructure";

export const runtime = "nodejs";

export async function GET() {
  try {
    const chats = await listRecentChats();
    return NextResponse.json({ chats });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorId: "CHATS_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Could not load persisted chats.",
        },
      },
      { status: 500 },
    );
  }
}
