import { assertAllowed, decodeB64, fetchUpstream, getChannelUrl, json, rewritePlaylist } from "../lib/core.js";

function playlistResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const path = url.searchParams.get("p");
  const encoded = url.searchParams.get("u");
  try {
    let target = encoded ? decodeB64(encoded) : path ? await getChannelUrl(path) : null;
    if (!target) return json({ error: "Kanal of bağlantı eksik" }, 400);
    assertAllowed(target);

    let upstream = await fetchUpstream(target);
    if (!upstream.ok && path) {
      target = await getChannelUrl(path, true);
      upstream = await fetchUpstream(target);
    }
    if (!upstream.ok) {
      return new Response(`Yayın kaynağı hatası: ${upstream.status}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    let text = await upstream.text();
    if (!text.includes("#EXTM3U") && path) {
      target = await getChannelUrl(path, true);
      upstream = await fetchUpstream(target);
      text = await upstream.text();
    }
    if (!upstream.ok || !text.includes("#EXTM3U")) {
      return new Response("Geçersiz yayın listesi", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    return playlistResponse(rewritePlaylist(text, new URL(upstream.url)));
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Yayın yüklenemedi", {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}
