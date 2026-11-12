import { JSDOM } from "jsdom";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cachedPjs: string | null = null;
let cachedPjsAt = 0;

async function getPjsCode(): Promise<string> {
  const now = Date.now();
  if (cachedPjs && now - cachedPjsAt < 1000 * 60 * 60) return cachedPjs;
  const res = await fetch("https://oxax.tv/p_20_02.js", {
    headers: { "User-Agent": UA, Referer: "https://oxax.tv/" },
  });
  if (!res.ok) throw new Error(`p_20_02.js fetch failed: ${res.status}`);
  const text = await res.text();
  cachedPjs = text;
  cachedPjsAt = now;
  return text;
}

export type FreshLink = {
  m3u8Url: string;
  kodk: string;
  kos: string;
  template: string;
};

function decodeTemplateWithJsdom(
  pjsCode: string,
  encoded: string,
  kodk: string,
  kos: string
): string {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body><div id="pl_ok"></div></body></html>`,
    {
      url: "https://oxax.tv/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    }
  );
  const win = dom.window as unknown as Record<string, unknown> & {
    atob: (s: string) => string;
    btoa: (s: string) => string;
    eval: (s: string) => unknown;
    HTMLMediaElement: { prototype: Record<string, unknown> };
    close: () => void;
  };

  (win as unknown as { kodk: string }).kodk = kodk;
  (win as unknown as { kos: string }).kos = kos;

  const origAtob = win.atob.bind(win);
  let capturedTemplate: string | null = null;

  win.atob = (s: string) => {
    const out = origAtob(s);
    if (out && out.startsWith('{"id"') && out.includes('"file"')) {
      capturedTemplate = out;
    }
    return out;
  };

  // Mock media element
  try {
    const proto = win.HTMLMediaElement.prototype as Record<string, unknown>;
    proto.play = () => Promise.resolve();
    proto.pause = () => {};
    proto.load = () => {};
    proto.canPlayType = () => "maybe";
  } catch {}

  try {
    win.eval(pjsCode);
    win.eval(`var player = new Playerjs(${JSON.stringify(encoded)});`);
  } finally {
    try {
      win.close();
    } catch {}
  }

  if (!capturedTemplate) {
    throw new Error("Playerjs decode did not produce a template");
  }
  return capturedTemplate as string;
}

export async function fetchFreshLink(path: string): Promise<FreshLink> {
  const url = `https://oxax.tv${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`Channel page fetch failed: ${res.status} for ${path}`);
  }
  const html = await res.text();

  if (html.includes("Онлайн трансляция телеканала не доступа")) {
    throw new Error("Channel is currently offline");
  }

  const match = html.match(
    /var kodk="([^"]+)";var kos="([^"]+)";\s*var player = new Playerjs\("([^"]+)"\)/
  );
  if (!match) {
    throw new Error("Could not find kodk/kos/Playerjs in page");
  }
  const [, kodk, kos, encoded] = match;

  const pjsCode = await getPjsCode();
  const templateJson = decodeTemplateWithJsdom(pjsCode, encoded, kodk, kos);

  let parsed: { file?: string };
  try {
    parsed = JSON.parse(templateJson);
  } catch {
    throw new Error("Template JSON parse failed");
  }
  if (!parsed.file) throw new Error("Template has no file field");

  const firstFile = parsed.file.split(" or ")[0].trim();
  const m3u8Url = firstFile
    .replaceAll("{v1}", kodk)
    .replaceAll("{v2}", kos)
    .replaceAll("{v3}", kodk)
    .replaceAll("{v4}", kos)
    .replaceAll("{v5}", kodk);

  if (!m3u8Url.startsWith("http")) {
    throw new Error(`Invalid m3u8 url generated: ${m3u8Url}`);
  }

  return { m3u8Url, kodk, kos, template: firstFile };
}

export async function checkLink(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    // 302 redirect to real playlist is a good sign, 200 also good
    return res.status === 200 || res.status === 302 || res.status === 301;
  } catch {
    return false;
  }
}
