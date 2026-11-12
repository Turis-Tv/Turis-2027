import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function validatePublicSegment(raw: string): URL {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Yalnızca HTTP(S) video parçalarına izin verilir");
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
    isIP(hostname) === 0
  ) {
    throw new Error("Bu sunucu adresine izin verilmez");
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Bağlantı eksik" }, { status: 400 });
  try {
    const target = validatePublicSegment(raw);
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Segment HTTP ${upstream.status}` },
        { status: 502 }
      );
    }

    let contentType = upstream.headers.get("content-type") || "";
    if (!contentType || /text\/plain|application\/octet-stream/i.test(contentType)) {
      contentType = /\.m4s(\?|$)/i.test(target.pathname)
        ? "video/iso.segment"
        : /\.aac(\?|$)/i.test(target.pathname)
        ? "audio/aac"
        : /\.mp4(\?|$)/i.test(target.pathname)
        ? "video/mp4"
        : "video/mp2t";
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Video parçası yüklenemedi" },
      { status: 400 }
    );
  }
}
