import { db } from "@/db";
import { channels } from "@/db/schema";
import { fetchFreshLink } from "@/lib/oxax";
import { eq } from "drizzle-orm";

export const ALLOWED_HOSTS = new Set(["s.oxax.tv", "oxax.tv"]);

export function encodeB64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function decodeB64(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function isPlaylistUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export function assertAllowed(url: string): URL {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }
  return parsed;
}

type CacheEntry = { url: string; at: number };
const tokenCache = new Map<string, CacheEntry>();
const pendingRefreshes = new Map<string, Promise<string>>();
const MAX_TOKEN_AGE = 1000 * 60 * 5; // 5 minuten: voorkomt verlopen streams

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function fetchAndStore(key: string): Promise<string> {
  const fresh = await fetchFreshLink(key);
  tokenCache.set(key, { url: fresh.m3u8Url, at: Date.now() });
  // Database is optioneel: nooit het afspelen laten wachten op een DB-update.
  void db
    .update(channels)
    .set({
      m3u8Url: fresh.m3u8Url,
      kodk: fresh.kodk,
      kos: fresh.kos,
      status: "ok",
      updatedAt: new Date(),
    })
    .where(eq(channels.path, key))
    .catch((dbErr) => console.error("token cache db update failed", dbErr));

  return fresh.m3u8Url;
}

/**
 * Geeft een werkende m3u8-url voor een kanaal.
 * - cache maximaal 5 minuten
 * - single-flight: gelijktijdige playlist-polls delen één token-request
 * - force=true ververst meteen na een upstream-fout
 */
export async function getChannelUrl(
  path: string,
  force = false
): Promise<string> {
  const key = normalizePath(path);
  const entry = tokenCache.get(key);

  if (!force && entry && Date.now() - entry.at < MAX_TOKEN_AGE) {
    return entry.url;
  }
  if (force) tokenCache.delete(key);

  const pending = pendingRefreshes.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      return await fetchAndStore(key);
    } catch (err) {
      // Alleen als noodoplossing: laatste bekende url uit de database.
      try {
        const rows = await db.select().from(channels).where(eq(channels.path, key));
        const fallback = rows[0]?.m3u8Url;
        if (fallback) return fallback;
      } catch {}
      throw err;
    } finally {
      pendingRefreshes.delete(key);
    }
  })();

  pendingRefreshes.set(key, request);
  return request;
}

export function proxyUrl(abs: string, playlist: boolean): string {
  const enc = encodeB64(abs);
  return playlist ? `/api/hls?u=${enc}` : `/api/hlsseg?u=${enc}`;
}

/** Herschrijft segmenten/varianten zodat alles via de eigen relay loopt. */
export function rewritePlaylist(text: string, base: URL): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const abs = new URL(uri, base).toString();
          return `URI="${proxyUrl(abs, isPlaylistUrl(abs))}"`;
        });
      }
      const abs = new URL(trimmed, base).toString();
      return proxyUrl(abs, isPlaylistUrl(abs));
    })
    .join("\n");
}
