import { createSessionCookie, json, pinMatches } from "../lib/core.js";

const attempts = new Map();

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const entry = attempts.get(ip);
  if (entry && entry.until > Date.now()) {
    const retryAfter = Math.ceil((entry.until - Date.now()) / 1000);
    return json({ ok: false, error: `Çok fazla deneme. ${retryAfter} saniye bekleyin.`, retryAfter }, 429);
  }

  let pin = "";
  try {
    const body = await request.json();
    pin = String(body.pin || "");
  } catch {
    return json({ ok: false, error: "Geçersiz istek" }, 400);
  }

  const validFormat = /^\d{4,10}$/.test(pin);
  if (!validFormat || !(await pinMatches(pin, env))) {
    const fails = (entry?.fails || 0) + 1;
    attempts.set(ip, { fails: fails >= 5 ? 0 : fails, until: fails >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
    return json({ ok: false, error: "Yanlış PIN." }, 401);
  }

  attempts.delete(ip);
  return json({ ok: true, unlocked: true }, 200, { "Set-Cookie": await createSessionCookie(env) });
}
