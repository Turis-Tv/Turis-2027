import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { SEED_CHANNELS } from "@/lib/channels";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function withTimeout<T>(promise: Promise<T>, ms = 1800): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Database timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensureSeeded() {
  const existing = await withTimeout(db.select().from(channels));
  if (existing.length > 0) return existing;

  for (const c of SEED_CHANNELS) {
    await db
      .insert(channels)
      .values({
        title: c.title,
        path: c.path,
        m3u8Url: c.m3u8Url,
        kodk: c.kodk,
        kos: c.kos,
        status: "ok",
      })
      .onConflictDoNothing();
  }
  return db.select().from(channels);
}

type Row = {
  id: number;
  title: string;
  path: string;
  m3u8Url: string | null;
  kodk: string | null;
  kos: string | null;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

/** Zonder sessie: kanaalnamen wel, maar alle links gemaskeerd. */
function maskRows(rows: Row[]) {
  return rows.map((r) => ({
    ...r,
    m3u8Url: null,
    kodk: null,
    kos: null,
  }));
}

export async function GET(req: Request) {
  const unlocked = getSessionFromRequest(req);

  try {
    const rows = (await ensureSeeded()) as unknown as Row[];
    return NextResponse.json({
      locked: !unlocked,
      channels: unlocked ? rows : maskRows(rows),
    });
  } catch (e) {
    console.error("GET /api/channels error", e);
    const fallbackRows: Row[] = SEED_CHANNELS.map((c, i) => ({
      id: i + 1,
      title: c.title,
      path: c.path,
      m3u8Url: c.m3u8Url,
      kodk: c.kodk,
      kos: c.kos,
      status: "ok",
    }));
    return NextResponse.json({
      locked: !unlocked,
      fallback: true,
      channels: unlocked ? fallbackRows : maskRows(fallbackRows),
    });
  }
}

export async function POST(req: Request) {
  if (!getSessionFromRequest(req)) {
    return NextResponse.json(
      { error: "locked", message: "PIN vereist." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (body.path && body.m3u8Url) {
    const [row] = await db
      .insert(channels)
      .values({
        title: body.title || body.path,
        path: body.path,
        m3u8Url: body.m3u8Url,
        kodk: body.kodk || null,
        kos: body.kos || null,
        status: "ok",
      })
      .onConflictDoUpdate({
        target: channels.path,
        set: { m3u8Url: body.m3u8Url, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json({ channel: row });
  }
  return NextResponse.json(
    { error: "path and m3u8Url required" },
    { status: 400 }
  );
}
