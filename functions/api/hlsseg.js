import { assertAllowed, decodeB64, fetchUpstream, isPlaylistUrl } from "../lib/core.js";

export async function onRequestGet({ request }) {
  const encoded = new URL(request.url).searchParams.get("u");
  if (!encoded) return new Response("Bağlantı eksik", { status: 400 });
  try {
    const target = decodeB64(encoded);
    assertAllowed(target);
    if (isPlaylistUrl(target)) return new Response("Geçersiz segment", { status: 400 });
    const upstream = await fetchUpstream(target);
    if (!upstream.ok) return new Response(`Segment hatası: ${upstream.status}`, { status: 502 });
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    let type = upstream.headers.get("content-type") || "";
    if (!type || /text\/plain|application\/octet-stream/i.test(type)) {
      type = /\.m4s(\?|$)/i.test(target) ? "video/iso.segment" : /\.aac(\?|$)/i.test(target) ? "audio/aac" : "video/mp2t";
    }
    headers.set("Content-Type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Segment yüklenemedi", {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
