import { isUnlocked, json } from "../lib/core.js";

export async function onRequestGet({ request, env }) {
  return json({ unlocked: await isUnlocked(request, env), pinConfigured: true });
}
