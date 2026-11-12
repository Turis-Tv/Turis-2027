import { buildClearCookie, isSecureRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/lock — sessie wissen, alles weer vergrendelen. */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true, unlocked: false });
  res.headers.set("Set-Cookie", buildClearCookie(isSecureRequest(req)));
  return res;
}
