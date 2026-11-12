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

function json(data, status = 200, extra = {}) {
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

async function pinMatches(pin, env = {}) {
  const expected = env.LINK_PIN_HASH || DEFAULT_PIN_HASH;
  return (await sha256Hex(pin)) === expected;
}

async function createSessionCookie(env = {}) {
  const exp = String(Date.now() + SESSION_TTL);
  const sig = await hmac(exp, env.SESSION_SECRET || DEFAULT_SESSION_SECRET);
  return `${SESSION_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL / 1000)}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function isUnlocked(request, env = {}) {
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

async function fetchFreshLink(path) {
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

async function getChannelUrl(path, force = false) {
  const key = path.startsWith("/") ? path : `/${path}`;
  const cached = tokenCache.get(key);
  if (!force && cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.url;
  if (force) tokenCache.delete(key);
  if (pending.has(key)) return pending.get(key);
  const task = freshAndCache(key).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

function encodeB64(value) {
  return btoa(unescape(encodeURIComponent(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeB64(value) {
  let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  while (base64.length % 4) base64 += "=";
  return decodeURIComponent(escape(atob(base64)));
}

function assertAllowed(url) {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error("İzin verilmeyen kaynak");
  return parsed;
}

function isPlaylistUrl(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function proxyUrl(abs, playlist) {
  const encoded = encodeB64(abs);
  return playlist ? `/api/hls?u=${encoded}` : `/api/hlsseg?u=${encoded}`;
}

function rewritePlaylist(text, base) {
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

async function fetchUpstream(url) {
  return fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://oxax.tv/" },
    redirect: "follow",
  });
}

const CHANNELS = [
  { title: "ОХ-АХ HD", path: "/oh-ah.html", m3u8Url: "https://s.oxax.tv/1/index.m3u8?k=1794382679p101i491i922i8S2edda5b79f8f89a9f1a41ee18d1ee83d", kodk: "1/index.m3u8?k=1794382679p101i491i922i8S", kos: "da5b79f" },
  { title: "Superone HD", path: "/superone-hd.html", m3u8Url: "https://s.oxax.tv/45/index.m3u8?k=1794382681p101i491i922i8S51769cadd6999d183641d3b9c23061b6", kodk: "45/index.m3u8?k=1794382681p101i491i922i8S", kos: "dd6999d1836" },
  { title: "CineMan XXX HD", path: "/sl-hot1.html", m3u8Url: "https://s.oxax.tv/59/index.m3u8?k=1794382682p101i491i922i8S32d195eb7caed518dc057aae2d7e3d5b", kodk: "59/index.m3u8?k=1794382682p101i491i922i8S", kos: "b7caed518d" },
  { title: "CineMan XXX2 HD", path: "/sl-hot2.html", m3u8Url: "https://s.oxax.tv/58/index.m3u8?k=1794382683p101i491i922i8S7209b6dfe512997fe3a6cc4b01ddbad3", kodk: "58/index.m3u8?k=1794382683p101i491i922i8S", kos: "6dfe512997f" },
  { title: "Brazzers TV Europe", path: "/brazzers-tv-europe.html", m3u8Url: "https://s.oxax.tv/2/index.m3u8?k=1794382684p101i491i922i8Sd5d2553ebe89017eaae6f25e64689756", kodk: "2/index.m3u8?k=1794382684p101i491i922i8S", kos: "ebe89017e" },
  { title: "Brazzers TV", path: "/brazzers-tv.html", m3u8Url: "https://s.oxax.tv/46/index.m3u8?k=1794382685p101i491i922i8S07eb6c682562e3a5c40f785469f3acc8", kodk: "46/index.m3u8?k=1794382685p101i491i922i8S", kos: "682562e" },
  { title: "Red Lips", path: "/red-lips.html", m3u8Url: "https://s.oxax.tv/3/index.m3u8?k=1794382686p101i491i922i8S11841cf5e3d050414e084b258e649f8b", kodk: "3/index.m3u8?k=1794382686p101i491i922i8S", kos: "41cf5" },
  { title: "KinoXXX", path: "/kino-xxx.html", m3u8Url: "https://s.oxax.tv/49/index.m3u8?k=1794382687p101i491i922i8S8c6212246f42a74388cafd2c1f4f648d", kodk: "49/index.m3u8?k=1794382687p101i491i922i8S", kos: "12246f4" },
  { title: "XY Max HD", path: "/xy-max-hd.html", m3u8Url: "https://s.oxax.tv/43/index.m3u8?k=1794382688p101i491i922i8S8e49be0b81a0cf760cef5813a8b141cd", kodk: "43/index.m3u8?k=1794382688p101i491i922i8S", kos: "9be0b81a" },
  { title: "XY Plus HD", path: "/xy-plus-hd.html", m3u8Url: "https://s.oxax.tv/50/index.m3u8?k=1794382689p101i491i922i8S7a1be8fcb994329dd1dd12e28a368d8e", kodk: "50/index.m3u8?k=1794382689p101i491i922i8S", kos: "8fcb994329" },
  { title: "XY Mix HD", path: "/xy-mix-hd.html", m3u8Url: "https://s.oxax.tv/55/index.m3u8?k=1794382690p101i491i922i8S73667f35f31e0622c2c078ff5f292a2d", kodk: "55/index.m3u8?k=1794382690p101i491i922i8S", kos: "5f31e0622c" },
  { title: "Playboy TV", path: "/playboy-tv.html", m3u8Url: "https://s.oxax.tv/6/index.m3u8?k=1794382692p101i491i922i8Sc09dd6a3c5f856e70322a8212b80315a", kodk: "6/index.m3u8?k=1794382692p101i491i922i8S", kos: "6a3c5f856e7" },
  { title: "Vivid Red HD", path: "/vivid-red.html", m3u8Url: "https://s.oxax.tv/7/index.m3u8?k=1794382693p101i491i922i8S18f327662d0d953ab52c667518f1b5cc", kodk: "7/index.m3u8?k=1794382693p101i491i922i8S", kos: "27662d0" },
  { title: "Exxxotica HD", path: "/hot-pleasure.html", m3u8Url: "https://s.oxax.tv/52/index.m3u8?k=1794382694p101i491i922i8S7a5095b53e2ba1d9cda2073a38730ee1", kodk: "52/index.m3u8?k=1794382694p101i491i922i8S", kos: "95b53e" },
  { title: "Babes TV", path: "/babes-tv.html", m3u8Url: "https://s.oxax.tv/14/index.m3u8?k=1794382695p101i491i922i8S7c1c317f09c47b0ada8b2f7acfb68500", kodk: "14/index.m3u8?k=1794382695p101i491i922i8S", kos: "f09c47b0ad" },
  { title: "Pink O TV", path: "/pink-o.html", m3u8Url: "https://s.oxax.tv/22/index.m3u8?k=1794382704p101i491i922i8Sd7debfe79ff84d31d9e27fc488c805cf", kodk: "22/index.m3u8?k=1794382704p101i491i922i8S", kos: "fe79f" },
  { title: "Erox HD", path: "/erox-hd.html", m3u8Url: "https://s.oxax.tv/9/index.m3u8?k=1794382705p101i491i922i8Sa4e76c38c4f6c57ce70d81ed415bc420", kodk: "9/index.m3u8?k=1794382705p101i491i922i8S", kos: "c38c4f6c5" },
  { title: "Eroxxx HD", path: "/eroxxx-hd.html", m3u8Url: "https://s.oxax.tv/47/index.m3u8?k=1794382706p101i491i922i8S197acabd911d740060cb57bd9dace20d", kodk: "47/index.m3u8?k=1794382706p101i491i922i8S", kos: "d911d" },
  { title: "Hustler HD", path: "/hustler-hd.html", m3u8Url: "https://s.oxax.tv/10/index.m3u8?k=1794382707p101i491i922i8Sfa3d34b15c5b2f6fa06cb374bca93b79", kodk: "10/index.m3u8?k=1794382707p101i491i922i8S", kos: "34b15" },
  { title: "Private TV", path: "/private-tv.html", m3u8Url: "https://s.oxax.tv/11/index.m3u8?k=1794382708p101i491i922i8S0ffd289b1781a4d5ec9005a67b224481", kodk: "11/index.m3u8?k=1794382708p101i491i922i8S", kos: "289b1781a4" },
  { title: "Redlight HD", path: "/redlight-hd.html", m3u8Url: "https://s.oxax.tv/12/index.m3u8?k=1794382709p101i491i922i8Sa41afe3c1958df7a09b807cffdab4636", kodk: "12/index.m3u8?k=1794382709p101i491i922i8S", kos: "3c1958df" },
  { title: "Penthouse Gold HD", path: "/penthouse-gold.html", m3u8Url: "https://s.oxax.tv/39/index.m3u8?k=1794382710p101i491i922i8S81fda90462cd62eec7561019185a9be3", kodk: "39/index.m3u8?k=1794382710p101i491i922i8S", kos: "0462cd62e" },
  { title: "Penthouse Quickies", path: "/penthouse-2.html", m3u8Url: "https://s.oxax.tv/16/index.m3u8?k=1794382711p101i491i922i8S04255759706fcc927a4f207341101c8e", kodk: "16/index.m3u8?k=1794382711p101i491i922i8S", kos: "55759706fcc" },
  { title: "O-la-la", path: "/o-la-la.html", m3u8Url: "https://s.oxax.tv/17/index.m3u8?k=1794382712p101i491i922i8S56a8975e382510712a74ca1f4ab0131f", kodk: "17/index.m3u8?k=1794382712p101i491i922i8S", kos: "5e382" },
  { title: "Blue Hustler", path: "/blue-hustler.html", m3u8Url: "https://s.oxax.tv/19/index.m3u8?k=1794382713p101i491i922i8Sbbdad7df2e202c8f31eec78ba57822d5", kodk: "19/index.m3u8?k=1794382713p101i491i922i8S", kos: "ad7df2e" },
  { title: "Шалун", path: "/shalun.html", m3u8Url: "https://s.oxax.tv/20/index.m3u8?k=1794382714p101i491i922i8S627596beb3e7f35fa605f148e98aa0dd", kodk: "20/index.m3u8?k=1794382714p101i491i922i8S", kos: "6beb3e7f" },
  { title: "Dorcel TV", path: "/dorcel-tv.html", m3u8Url: "https://s.oxax.tv/21/index.m3u8?k=1794382715p101i491i922i8S2a7baab85b619828910044027bb78180", kodk: "21/index.m3u8?k=1794382715p101i491i922i8S", kos: "ab85b6198" },
  { title: "Extasy HD", path: "/extasyhd.html", m3u8Url: "https://s.oxax.tv/29/index.m3u8?k=1794382716p101i491i922i8Sf6762b4b7edf9b52efec7bae4f4752eb", kodk: "29/index.m3u8?k=1794382716p101i491i922i8S", kos: "4b7edf9b" },
  { title: "XXL", path: "/xxl.html", m3u8Url: "https://s.oxax.tv/30/index.m3u8?k=1794382717p101i491i922i8S557cea404758e60bcf9a0fd192dcc8b3", kodk: "30/index.m3u8?k=1794382717p101i491i922i8S", kos: "a404758e60" },
  { title: "FAP TV 2", path: "/fap-tv-2.html", m3u8Url: "https://s.oxax.tv/26/index.m3u8?k=1794382718p101i491i922i8S5403b9cab6a001810b20b98e8072b11d", kodk: "26/index.m3u8?k=1794382718p101i491i922i8S", kos: "b9cab6" },
  { title: "FAP TV 3", path: "/fap-tv-3.html", m3u8Url: "https://s.oxax.tv/27/index.m3u8?k=1794382719p101i491i922i8S6a48555eebf4a05b940aa5b4e549613f", kodk: "27/index.m3u8?k=1794382719p101i491i922i8S", kos: "5eebf" },
  { title: "FAP TV 4", path: "/fap-tv-4.html", m3u8Url: "https://s.oxax.tv/28/index.m3u8?k=1794382720p101i491i922i8Sa60ccc0c9f4397725eab31902cfef17d", kodk: "28/index.m3u8?k=1794382720p101i491i922i8S", kos: "cc0c9f43" },
  { title: "FAP TV Parody", path: "/fap-tv-parody.html", m3u8Url: "https://s.oxax.tv/32/index.m3u8?k=1794382721p101i491i922i8Sad9d2c55392b9b1ece7b3ca206152be6", kodk: "32/index.m3u8?k=1794382721p101i491i922i8S", kos: "5392b" },
  { title: "FAP TV Compilation", path: "/fap-tv-compilation.html", m3u8Url: "https://s.oxax.tv/34/index.m3u8?k=1794382722p101i491i922i8Sb3f42f2df86ce292c6012636ebbb1211", kodk: "34/index.m3u8?k=1794382722p101i491i922i8S", kos: "2df86ce292" },
  { title: "FAP TV Anal", path: "/fap-tv-anal.html", m3u8Url: "https://s.oxax.tv/35/index.m3u8?k=1794382723p101i491i922i8S488b0c69834033afe0fdc392ea9b5aee", kodk: "35/index.m3u8?k=1794382723p101i491i922i8S", kos: "c69834033af" },
  { title: "FAP TV Lesbian", path: "/fap-tv-lesbian.html", m3u8Url: "https://s.oxax.tv/37/index.m3u8?k=1794382725p101i491i922i8S56bf8c0334f290ef8e659c2be893c588", kodk: "37/index.m3u8?k=1794382725p101i491i922i8S", kos: "f8c0334f" },
  { title: "FAP TV BBW", path: "/fap-tv-bbw.html", m3u8Url: "https://s.oxax.tv/38/index.m3u8?k=1794382725p101i491i922i8S75ba1de6ebba5a24e59108885f1ed783", kodk: "38/index.m3u8?k=1794382725p101i491i922i8S", kos: "e6ebba5a" },
];


// IP-gebonden streams: token, playlist en segment altijd in DEZELFDE invocation
// ophalen. Geen token-cache tussen Cloudflare-requests.
async function fetchChannelResource(channelPath, encodedSegment) {
  const fresh = await fetchFreshLink(channelPath);
  let upstream = await fetchUpstream(fresh.m3u8Url);
  if (!upstream.ok) throw new Error(`Playlist kaynağı: ${upstream.status}`);
  if (encodedSegment) {
    const relative = decodeB64(encodedSegment);
    const target = new URL(relative, upstream.url).toString();
    assertAllowed(target);
    upstream = await fetchUpstream(target);
    if (!upstream.ok) throw new Error(`Segment kaynağı: ${upstream.status}`);
  }
  return upstream;
}

function rewriteChannelPlaylist(text, base, channelPath) {
  const p = encodeURIComponent(channelPath);
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    const convert = (uri) => {
      const seg = encodeB64(uri);
      return isPlaylistUrl(new URL(uri, base).toString())
        ? `/api/hls?p=${p}&seg=${seg}`
        : `/api/hlsseg?p=${p}&seg=${seg}`;
    };
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${convert(uri)}"`);
    }
    return convert(trimmed);
  }).join("\n");
}

const unlockAttempts = new Map();

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }});
  }

  if (path === "/api/health") return json({ ok: true, runtime: "cloudflare-worker" });

  if (path === "/api/channels" && request.method === "GET") {
    const unlocked = await isUnlocked(request, env);
    return json({ locked: !unlocked, channels: CHANNELS.map((channel, index) => ({
      id: index + 1,
      title: channel.title,
      path: channel.path,
      status: "ok",
      m3u8Url: unlocked ? channel.m3u8Url : null,
      kodk: unlocked ? channel.kodk : null,
      kos: unlocked ? channel.kos : null,
    }))});
  }

  if (path === "/api/session" && request.method === "GET") {
    return json({ unlocked: await isUnlocked(request, env), pinConfigured: true });
  }

  if (path === "/api/unlock" && request.method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const entry = unlockAttempts.get(ip);
    if (entry && entry.until > Date.now()) {
      const retryAfter = Math.ceil((entry.until - Date.now()) / 1000);
      return json({ ok: false, error: `Çok fazla deneme. ${retryAfter} saniye bekleyin.`, retryAfter }, 429);
    }
    let pin = "";
    try { pin = String((await request.json()).pin || ""); }
    catch { return json({ ok: false, error: "Geçersiz istek" }, 400); }
    if (!/^\d{4,10}$/.test(pin) || !(await pinMatches(pin, env))) {
      const fails = (entry?.fails || 0) + 1;
      unlockAttempts.set(ip, { fails: fails >= 5 ? 0 : fails, until: fails >= 5 ? Date.now() + 300000 : 0 });
      return json({ ok: false, error: "Yanlış PIN." }, 401);
    }
    unlockAttempts.delete(ip);
    return json({ ok: true, unlocked: true }, 200, { "Set-Cookie": await createSessionCookie(env) });
  }

  if (path === "/api/lock" && request.method === "POST") {
    return json({ ok: true, unlocked: false }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (path === "/api/refresh" && request.method === "POST") {
    let channelPath = "";
    try { channelPath = String((await request.json()).path || ""); }
    catch { return json({ ok: false, error: "Geçersiz istek" }, 400); }
    if (!channelPath) return json({ ok: false, error: "Kanal yolu gerekli" }, 400);
    try {
      const fresh = await fetchFreshLink(channelPath);
      const unlocked = await isUnlocked(request, env);
      return json({ ok: true, path: channelPath, ...(unlocked ? fresh : {}), refreshedAt: new Date().toISOString() });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Yenileme başarısız" }, 502);
    }
  }

  if (path === "/api/stream-url" && request.method === "GET") {
    const channelPath = url.searchParams.get("p");
    if (!channelPath) return json({ ok: false, error: "Kanal yolu gerekli" }, 400);
    try {
      const streamUrl = await getChannelUrl(channelPath);
      return json({ ok: true, url: streamUrl }, 200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Yayın adresi alınamadı" }, 502, {
        "Access-Control-Allow-Origin": "*",
      });
    }
  }

  if (path === "/api/playlist" && request.method === "GET") {
    if (!(await isUnlocked(request, env))) return json({ error: "PIN gerekli" }, 401);
    const relay = url.searchParams.get("relay") === "1";
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    for (const channel of CHANNELS) {
      const stream = relay ? `${url.origin}/api/hls?p=${encodeURIComponent(channel.path)}` : channel.m3u8Url;
      lines.push(`#EXTINF:-1 tvg-name="${channel.title}" group-title="TurisTV",${channel.title}`, stream);
    }
    return new Response(lines.join("\n") + "\n", { headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `attachment; filename="turis-tv${relay ? "-kalici" : ""}.m3u"`,
      "Cache-Control": "no-store",
    }});
  }

  if (path === "/api/hls" && request.method === "GET") {
    const channelPath = url.searchParams.get("p");
    const encoded = url.searchParams.get("u");
    const segment = url.searchParams.get("seg");
    try {
      if (channelPath) {
        const upstream = await fetchChannelResource(channelPath, segment);
        const text = await upstream.text();
        if (!text.includes("#EXTM3U")) throw new Error("Geçersiz yayın listesi");
        return new Response(rewriteChannelPlaylist(text, new URL(upstream.url), channelPath), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }
      if (!encoded) return json({ error: "Kanal of bağlantı eksik" }, 400);
      const target = decodeB64(encoded);
      assertAllowed(target);
      const upstream = await fetchUpstream(target);
      if (!upstream.ok) throw new Error(`Yayın kaynağı hatası: ${upstream.status}`);
      const text = await upstream.text();
      return new Response(rewritePlaylist(text, new URL(upstream.url)), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : "Yayın yüklenemedi", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  if (path === "/api/hlsseg" && request.method === "GET") {
    const channelPath = url.searchParams.get("p");
    const segment = url.searchParams.get("seg");
    const encoded = url.searchParams.get("u");
    try {
      let upstream;
      let targetForType = "";
      if (channelPath && segment) {
        upstream = await fetchChannelResource(channelPath, segment);
        targetForType = upstream.url;
      } else {
        if (!encoded) return new Response("Bağlantı eksik", { status: 400 });
        const target = decodeB64(encoded);
        assertAllowed(target);
        if (isPlaylistUrl(target)) return new Response("Geçersiz segment", { status: 400 });
        upstream = await fetchUpstream(target);
        targetForType = target;
        if (!upstream.ok) throw new Error(`Segment hatası: ${upstream.status}`);
      }
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
        type = /\.m4s(\?|$)/i.test(targetForType) ? "video/iso.segment" : /\.aac(\?|$)/i.test(targetForType) ? "audio/aac" : "video/mp2t";
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

  return json({ error: "API bulunamadı" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
