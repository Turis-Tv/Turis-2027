import { getChannelUrl } from "@/lib/stream";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alleen voor afspelen: verse directe URL, geen PIN. Lijsten/downloads blijven beveiligd. */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("p");
  if (!path) {
    return NextResponse.json(
      { ok: false, error: "Kanal yolu gerekli" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
  try {
    const url = await getChannelUrl(path);
    return NextResponse.json(
      { ok: true, url },
      { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Yayın adresi alınamadı" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
