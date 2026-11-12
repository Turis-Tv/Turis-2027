import { getChannelUrl, json } from "../lib/core.js";

export async function onRequestGet({ request }) {
  const path = new URL(request.url).searchParams.get("p");
  if (!path) return json({ ok: false, error: "Kanal yolu gerekli" }, 400);
  try {
    const url = await getChannelUrl(path);
    return json({ ok: true, url }, 200, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Yayın adresi alınamadı" }, 502, { "Access-Control-Allow-Origin": "*" });
  }
}
