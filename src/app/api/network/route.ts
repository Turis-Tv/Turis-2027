import { networkInterfaces } from "node:os";
import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const port = req.nextUrl.host.split(":")[1] || "3000";
  const urls = new Set<string>();

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      urls.add(`http://${entry.address}:${port}`);
    }
  }

  const list = Array.from(urls);
  const primary = list[0] || `http://127.0.0.1:${port}`;
  const qr = await QRCode.toDataURL(primary, {
    width: 320,
    margin: 2,
    color: { dark: "#09090b", light: "#ffffff" },
  });

  return NextResponse.json({
    urls: list,
    primary,
    qr,
    note: "Telefonda 127.0.0.1 kullanmayın; bilgisayarın yerel IP adresini kullanın.",
  });
}
