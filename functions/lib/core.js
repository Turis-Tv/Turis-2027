const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DEFAULT_PIN_HASH = "954446921d7cda37f7f285ffbd7df61b5215886a1ff2b7abb55c4c29f151011f";
const DEFAULT_SESSION_SECRET = "turis-tv-27f85c286eace287c66b43d2e9783d8c396fc0fce1be89d4";
const SESSION_COOKIE = "turis_session";
const SESSION_TTL = 12 * 60 * 60 * 1000;
const ALLOWED_HOSTS = new Set(["s.oxax.tv", "oxax.tv"]);
const tokenCache = new Map();
const pending = new Map();

// PlayerJS plaatst deze vaste sleutelfragmenten in de base64-string.
// Verwijderen levert dezelfde JSON op als de originele speler, zonder eval/jsdom.
const PLAYER_INSERTS = [
  "NTU2RzNEUTFW",
  "NTU2RzNEUTE=",
  "NTU2RzNEUQ==",
  "NTU2RzNE",
  "NTU2RzM=",
];

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(signature);
}

export async function pinMatches(pin, env = {}) {
  const expected = env.LINK_PIN_HASH || DEFAULT_PIN_HASH;
  return (await sha256Hex(pin)) === expected;
}

export async function createSessionCookie(env = {}) {
  const exp = String(Date.now() + SESSION_TTL);
  const sig = await hmac(exp, env.SESSION_SECRET || DEFAULT_SESSION_SECRET);
  return `${SESSION_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL / 1000)}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isUnlocked(request, env = {}) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [exp, sig] = match[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp, env.SESSION_SECRET || DEFAULT_SESSION_SECRET);
  return sig === expected;
}

function decodePlayerConfig(encoded) {
  let value = encoded;
  if (value.startsWith("#F")) value = value.slice(2);
  else if (value.startsWith("#")) value = value.slice(1);
  // Elk fragment wordt door PlayerJS met een extra "F"-markering ingevoegd.
  for (const fragment of PLAYER_INSERTS) {
    value = value.replaceAll(`F${fragment}`, "");
  }
  for (const fragment of PLAYER_INSERTS) value = value.replaceAll(fragment, "");
  return JSON.parse(atob(value));
}

export async function fetchFreshLink(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`https://oxax.tv${cleanPath}`, {
    headers: { "User-Agent": UA },
  });
  if (!response.ok) throw new Error(`Kanal sayfası açılamadı: ${response.status}`);
  const html = await response.text();
  if (html.includes("Онлайн трансляция телеканала не доступа")) {
    throw new Error("Kanal şu anda çevrimdışı");
  }
  const match = html.match(/var kodk="([^"]+)";var kos="([^"]+)";\s*var player = new Playerjs\("([^"]+)"\)/);
  if (!match) throw new Error("Yayın bilgisi bulunamadı");
  const [, kodk, kos, encoded] = match;
  const config = decodePlayerConfig(encoded);
  const template = String(config.file || "").split(" or ")[0].trim();
  const m3u8Url = template
    .replaceAll("{v1}", kodk)
    .replaceAll("{v2}", kos)
    .replaceAll("{v3}", kodk)
    .replaceAll("{v4}", kos)
    .replaceAll("{v5}", kodk);
  if (!m3u8Url.startsWith("https://")) throw new Error("Geçersiz yayın bağlantısı");
  return { m3u8Url, kodk, kos };
}

async function freshAndCache(path) {
  const fresh = await fetchFreshLink(path);
  tokenCache.set(path, { url: fresh.m3u8Url, at: Date.now() });
  return fresh.m3u8Url;
}

export async function getChannelUrl(path, force = false) {
  const key = path.startsWith("/") ? path : `/${path}`;
  const cached = tokenCache.get(key);
  if (!force && cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.url;
  if (force) tokenCache.delete(key);
  if (pending.has(key)) return pending.get(key);
  const task = freshAndCache(key).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export function encodeB64(value) {
  return btoa(unescape(encodeURIComponent(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeB64(value) {
  let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  while (base64.length % 4) base64 += "=";
  return decodeURIComponent(escape(atob(base64)));
}

export function assertAllowed(url) {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error("İzin verilmeyen kaynak");
  return parsed;
}

export function isPlaylistUrl(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function proxyUrl(abs, playlist) {
  const encoded = encodeB64(abs);
  return playlist ? `/api/hls?u=${encoded}` : `/api/hlsseg?u=${encoded}`;
}

export function rewritePlaylist(text, base) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const abs = new URL(uri, base).toString();
        return `URI="${proxyUrl(abs, isPlaylistUrl(abs))}"`;
      });
    }
    const abs = new URL(trimmed, base).toString();
    return proxyUrl(abs, isPlaylistUrl(abs));
  }).join("\n");
}

export async function fetchUpstream(url) {
  return fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://oxax.tv/" },
    redirect: "follow",
  });
}
