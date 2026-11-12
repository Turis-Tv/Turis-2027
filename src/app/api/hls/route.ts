import {
  assertAllowed,
  decodeB64,
  getChannelUrl,
  rewritePlaylist,
} from "@/lib/stream";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchPlaylist(target: string): Promise<Response> {
  return fetch(target, {
    headers: { "User-Agent": UA, Referer: "https://oxax.tv/" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
}

/**
 * Vrije afspeel-relay (geen PIN). Bij een verlopen/ongeldige token wordt
 * automatisch één nieuwe token opgehaald en de playlist opnieuw geladen.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p");
  const u = req.nextUrl.searchParams.get("u");

  try {
    let target: string | null = null;
    if (u) target = decodeB64(u);
    else if (p) target = await getChannelUrl(p);

    if (!target) {
      return NextResponse.json(
        { error: "Kanal veya bağlantı eksik" },
        { status: 400 }
      );
    }
    assertAllowed(target);

    let upstream: Response;
    try {
      upstream = await fetchPlaylist(target);
    } catch (firstError) {
      if (!p) throw firstError;
      target = await getChannelUrl(p, true);
      upstream = await fetchPlaylist(target);
    }

    // Verlopen token? Direct verversen en één keer opnieuw proberen.
    if (!upstream.ok && p) {
      target = await getChannelUrl(p, true);
      upstream = await fetchPlaylist(target);
    }

    if (!upstream.ok) {
      return new NextResponse(`Yayın kaynağı hatası: ${upstream.status}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const finalUrl = new URL(upstream.url);
    const text = await upstream.text();
    if (!text.includes("#EXTM3U")) {
      if (p) {
        target = await getChannelUrl(p, true);
        const retry = await fetchPlaylist(target);
        const retryText = await retry.text();
        if (retry.ok && retryText.includes("#EXTM3U")) {
          return playlistResponse(
            rewritePlaylist(retryText, new URL(retry.url))
          );
        }
      }
      return new NextResponse("Geçersiz yayın listesi", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return playlistResponse(rewritePlaylist(text, finalUrl));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yayın yüklenemedi";
    console.error("GET /api/hls failed", err);
    return new NextResponse(message, {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}

function playlistResponse(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
