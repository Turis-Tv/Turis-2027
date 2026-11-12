import {
  buildSessionCookie,
  clearFailedAttempts,
  clientIp,
  isSecureRequest,
  pinConfigured,
  pinMatches,
  rateLimitStatus,
  registerFailedAttempt,
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/unlock  { pin: "123456" }
 * Zet een httpOnly sessie-cookie als de PIN klopt.
 * De PIN zelf wordt nergens opgeslagen, alleen vergeleken met de hash.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!pinConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Sunucuda PIN yapılandırılmamış." },
      { status: 500 }
    );
  }

  const limit = rateLimitStatus(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Çok fazla deneme. ${limit.retryAfter} saniye sonra tekrar deneyin.`,
        retryAfter: limit.retryAfter,
      },
      { status: 429 }
    );
  }

  let pin = "";
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz istek." },
      { status: 400 }
    );
  }

  if (!/^\d{4,10}$/.test(pin)) {
    registerFailedAttempt(ip);
    return NextResponse.json(
      { ok: false, error: "Yanlış PIN." },
      { status: 401 }
    );
  }

  if (!pinMatches(pin)) {
    registerFailedAttempt(ip);
    const status = rateLimitStatus(ip);
    return NextResponse.json(
      {
        ok: false,
        error: status.ok
          ? "Yanlış PIN."
          : `Çok fazla deneme. ${status.retryAfter} saniye bekleyin.`,
        retryAfter: status.retryAfter,
      },
      { status: 401 }
    );
  }

  clearFailedAttempts(ip);
  const res = NextResponse.json({ ok: true, unlocked: true });
  res.headers.set("Set-Cookie", buildSessionCookie(isSecureRequest(req)));
  return res;
}
