"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Play } from "lucide-react";

type Props = {
  onPlay: (proxiedUrl: string) => void;
};

export default function HttpStreamPlayer({ onPlay }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const play = async () => {
    const value = url.trim();
    setError(null);
    if (!/^https?:\/\/.+\.m3u8(\?.*)?$/i.test(value)) {
      setError("Voer een volledige http:// of https:// .m3u8-link in");
      return;
    }
    setBusy(true);
    try {
      const proxied = `/api/http-playlist?url=${encodeURIComponent(value)}`;
      const response = await fetch(proxied, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      onPlay(proxied);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream kon niet geladen worden");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-white">HTTP M3U8 afspelen</h2>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Plak een volledige .m3u8-link. De Render-server proxyt playlist en segmenten.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void play();
          }}
          placeholder="https://voorbeeld.com/live/stream.m3u8"
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 focus:outline-none"
        />
        <button
          onClick={() => void play()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Speel af
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-red-300">
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
