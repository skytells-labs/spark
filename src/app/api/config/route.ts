import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/media-capabilities";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(getRuntimeConfig(), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
