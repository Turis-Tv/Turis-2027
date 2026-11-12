import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function validatePublicHttpUrl(raw: string): URL {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Yalnızca http:// ve https:// bağlantıları desteklenir");
  }
  if (!parsed.pathname.toLowerCase().endsWith(".m3u8")) {
    throw new Error("Bağlantı .m3u8 ile bitmelidir");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80") ||
    PRIVATE_V4.some((pattern) => pattern.test(hostname)) ||
    (isIP(hostname) === 4 && PRIVATE_V4.some((pattern) => pattern.test(hostname)))
  ) {
    throw new Error("Özel ağ adreslerine izin verilmez");
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Bağlantı eksik" }, { status: 400 });

  try {
    const target = validatePublicHttpUrl(raw);
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream HTTP ${upstream.status}` },
        { status: 502 }
      );
    }
    const text = await upstream.text();
    if (!text.includes("#EXTM3U")) {
      return NextResponse.json(
        { error: "Geçerli bir M3U8 oynatma listesi değil" },
        { status: 422 }
      );
    }

    const base = new URL(upstream.url);
    const origin = req.nextUrl.origin;
    const body = text
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
            const abs = new URL(uri, base).toString();
            const route = /\.m3u8(\?|$)/i.test(abs)
              ? "/api/http-playlist"
              : "/api/http-segment";
            return `URI="${origin}${route}?url=${encodeURIComponent(abs)}"`;
          });
        }
        const abs = new URL(trimmed, base).toString();
        const nestedPlaylist = /\.m3u8(\?|$)/i.test(abs);
        return nestedPlaylist
          ? `${origin}/api/http-playlist?url=${encodeURIComponent(abs)}`
          : `${origin}/api/http-segment?url=${encodeURIComponent(abs)}`;
      })
      .join("\n");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Yayın yüklenemedi" },
      { status: 400 }
    );
  }
}
