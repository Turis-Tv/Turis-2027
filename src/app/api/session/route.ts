import { getSessionFromRequest, pinConfigured } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/session — is de gebruiker ontgrendeld? */
export async function GET(req: Request) {
  return NextResponse.json({
    unlocked: getSessionFromRequest(req),
    pinConfigured: pinConfigured(),
  });
}
