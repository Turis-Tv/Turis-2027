import { fetchFreshLink, isUnlocked, json } from "../lib/core.js";

export async function onRequestPost({ request, env }) {
  let path = "";
  try {
    const body = await request.json();
    path = String(body.path || "");
  } catch {
    return json({ ok: false, error: "Geçersiz istek" }, 400);
  }
  if (!path) return json({ ok: false, error: "Kanal yolu gerekli" }, 400);
  try {
    const fresh = await fetchFreshLink(path);
    const unlocked = await isUnlocked(request, env);
    return json({
      ok: true,
      path,
      ...(unlocked ? fresh : {}),
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ ok: false, path, error: error instanceof Error ? error.message : "Yenileme başarısız" }, 502);
  }
}
