import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { SEED_CHANNELS } from "@/lib/channels";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!getSessionFromRequest(req)) {
    return NextResponse.json(
      { error: "locked", message: "PIN vereist voor downloads." },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const useRelay = url.searchParams.get("relay") === "1";
  const origin = url.origin;

  let rows: { title: string; m3u8Url: string | null; path?: string }[] = [];
  try {
    rows = await db
      .select({
        title: channels.title,
        m3u8Url: channels.m3u8Url,
        path: channels.path,
      })
      .from(channels);
    if (rows.length === 0) throw new Error("empty");
  } catch {
    rows = SEED_CHANNELS.map((c) => ({ title: c.title, m3u8Url: c.m3u8Url }));
  }

  const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const r of rows) {
    const streamUrl = useRelay
      ? r.path
        ? `${origin}/api/hls?p=${encodeURIComponent(r.path)}`
        : null
      : r.m3u8Url;
    if (!streamUrl) continue;
    lines.push(
      `#EXTINF:-1 tvg-id="" tvg-name="${r.title}" group-title="OxaxTV",${r.title}`
    );
    lines.push(streamUrl);
  }
  const content = lines.join("\n") + "\n";

  return new NextResponse(content, {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${
        useRelay ? "oxax-tv-relay.m3u" : "oxax-tv.m3u"
      }"`,
      "Cache-Control": "no-store",
    },
  });
}
