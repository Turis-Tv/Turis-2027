import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type CustomChannel = { name: string; url: string };

export async function GET() {
  try {
    const file = path.join(process.cwd(), "public", "custom-channels.json");
    const content = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("JSON moet een array zijn");

    const channels: CustomChannel[] = parsed
      .filter(
        (item): item is CustomChannel =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as CustomChannel).name === "string" &&
          typeof (item as CustomChannel).url === "string" &&
          /^https?:\/\/.+\.m3u8(\?.*)?$/i.test((item as CustomChannel).url)
      )
      .map((item) => ({ name: item.name.trim(), url: item.url.trim() }))
      .filter((item) => item.name.length > 0);

    return NextResponse.json(
      { channels },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { channels: [], error: error instanceof Error ? error.message : "JSON okunamadı" },
      { status: 200 }
    );
  }
}
