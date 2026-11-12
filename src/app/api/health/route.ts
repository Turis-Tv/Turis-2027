import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch {
    // De app werkt met de ingebouwde 37-kanaals fallback ook zonder database.
    // Healthcheck blijft daarom 200 zodat gratis hosting zonder PostgreSQL kan.
    return Response.json({ ok: true, database: "fallback" });
  }
}
