import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/media-capabilities";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getRuntimeConfig());
}

