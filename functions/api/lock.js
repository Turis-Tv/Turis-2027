import { clearSessionCookie, json } from "../lib/core.js";

export async function onRequestPost() {
  return json({ ok: true, unlocked: false }, 200, { "Set-Cookie": clearSessionCookie() });
}
