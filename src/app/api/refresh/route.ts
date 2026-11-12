import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { fetchFreshLink } from "@/lib/oxax";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  // Vernieuwen is voor iedereen toegestaan; alleen links/downloads vereisen PIN.
  const unlocked = getSessionFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const path: string | undefined = body.path;

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const fresh = await fetchFreshLink(path);

    // Update DB if channel exists
    try {
      await db
        .update(channels)
        .set({
          m3u8Url: fresh.m3u8Url,
          kodk: fresh.kodk,
          kos: fresh.kos,
          status: "ok",
          updatedAt: new Date(),
        })
        .where(eq(channels.path, path));
    } catch (dbErr) {
      console.error("DB update failed", dbErr);
    }

    return NextResponse.json({
      ok: true,
      path,
      // Zonder PIN alleen bevestigen; nooit de geheime streamlink teruggeven.
      ...(unlocked
        ? { m3u8Url: fresh.m3u8Url, kodk: fresh.kodk, kos: fresh.kos }
        : {}),
      refreshedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refresh failed";
    console.error("Refresh failed for", path, e);
    try {
      await db
        .update(channels)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(channels.path, path));
    } catch {}
    return NextResponse.json({ ok: false, path, error: message }, { status: 502 });
  }
}
