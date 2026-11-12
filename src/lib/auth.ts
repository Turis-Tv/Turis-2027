import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "oxax_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 uur geldig
const MAX_FAILS = 5;
const LOCKOUT_MS = 1000 * 60 * 5; // 5 minuten blokkade

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function secret(): string {
  return process.env.SESSION_SECRET || "oxax-session-secret";
}

function safeEqual(a: string, b: string): boolean {
  const ha = sha256Hex(a);
  const hb = sha256Hex(b);
  if (ha.length !== hb.length) return false;
  try {
    return timingSafeEqual(Buffer.from(ha, "hex"), Buffer.from(hb, "hex"));
  } catch {
    return false;
  }
}

// Zelfde hash als in render.yaml (PIN: 6636). Alleen een sha256-hash, nooit de
// PIN zelf. Zo blijft de PIN werken ook als de env-var op Render ontbreekt.
const DEFAULT_PIN_HASH =
  "954446921d7cda37f7f285ffbd7df61b5215886a1ff2b7abb55c4c29f151011f";

export function pinConfigured(): boolean {
  return Boolean(
    process.env.LINK_PIN_HASH || process.env.LINK_PIN || DEFAULT_PIN_HASH
  );
}

/**
 * Compares a PIN against the configured secret.
 * The PIN itself is never stored: only its sha256 hash (LINK_PIN_HASH).
 */
export function pinMatches(pin: string): boolean {
  const plain = process.env.LINK_PIN;
  if (plain) return safeEqual(sha256Hex(pin), sha256Hex(plain));
  const hash = (process.env.LINK_PIN_HASH || DEFAULT_PIN_HASH)
    .trim()
    .toLowerCase();
  if (!hash) return false;
  return safeEqual(sha256Hex(pin), hash);
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = String(exp);
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  return safeEqual(sig, expected);
}

export function getSessionFromRequest(req: Request): boolean {
  const header = req.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return verifySessionToken(match?.[1]);
}

export function buildSessionCookie(secure: boolean): string {
  const token = createSessionToken();
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

export function buildClearCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${
    secure ? "; Secure" : ""
  }`;
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  return proto === "https";
}

// --- Rate limiting op IP ---
type Attempt = { fails: number; lockedUntil: number };
const attempts = new Map<string, Attempt>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitStatus(ip: string): { ok: boolean; retryAfter: number } {
  const entry = attempts.get(ip);
  if (!entry) return { ok: true, retryAfter: 0 };
  if (entry.lockedUntil > Date.now()) {
    return {
      ok: false,
      retryAfter: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  return { ok: true, retryAfter: 0 };
}

export function registerFailedAttempt(ip: string): void {
  const entry = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.fails = 0;
  }
  attempts.set(ip, entry);
}

export function clearFailedAttempts(ip: string): void {
  attempts.delete(ip);
}
