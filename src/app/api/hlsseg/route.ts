import { assertAllowed, decodeB64, isPlaylistUrl } from "@/lib/stream";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Media segment relay (/api/hlsseg?u=<base64url>).
 * Passes the video/audio segments through with CORS + Range support.
 */
export async function GET(req: NextRequest) {
  // Segmenten voor afspelen zijn vrij toegankelijk, zonder PIN.
  const u = req.nextUrl.searchParams.get("u");
  if (!u) {
    return new NextResponse("Missing u", {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const target = decodeB64(u);
    assertAllowed(target);

    // Never relay playlists through this route
    if (isPlaylistUrl(target)) {
      return NextResponse.json(
        { error: "Playlists must go through /api/hls" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const range = req.headers.get("range");
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Referer: "https://oxax.tv/",
    };
    if (range) headers["Range"] = range;

    const upstream = await fetch(target, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(`Upstream error ${upstream.status}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges",
      "Cache-Control": "no-store",
    });

    const passThrough = ["content-length", "content-range", "accept-ranges"];
    for (const name of passThrough) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // Upstream often serves .ts as text/plain — correct it for real players
    const upstreamType = upstream.headers.get("content-type") || "";
    let contentType = upstreamType;
    if (!contentType || /text\/plain|application\/octet-stream/i.test(contentType)) {
      if (/\.m4s(\?|$)/i.test(target)) contentType = "video/iso.segment";
      else if (/\.aac(\?|$)/i.test(target)) contentType = "audio/aac";
      else if (/\.mp4(\?|$)/i.test(target)) contentType = "video/mp4";
      else if (/\.vtt(\?|$)/i.test(target)) contentType = "text/vtt";
      else contentType = "video/mp2t";
    }
    responseHeaders.set("content-type", contentType);
    if (!responseHeaders.has("accept-ranges")) {
      responseHeaders.set("accept-ranges", "bytes");
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Segment relay failed";
    console.error("GET /api/hlsseg failed", err);
    return new NextResponse(message, {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
