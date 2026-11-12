"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ListVideo, Loader2, Play } from "lucide-react";

type CustomChannel = { name: string; url: string };

type Props = {
  selectedName: string | null;
  onCustomSelect: (url: string, name: string) => void;
};

/**
 * Alleen de eigen kanalen uit public/custom-channels.json.
 * De ingebouwde 37 kanalen staan al onder de speler en komen hier dus NIET
 * nog eens in de dropdown te staan.
 */
export default function CustomChannelSelect({
  selectedName,
  onCustomSelect,
}: Props) {
  const [custom, setCustom] = useState<CustomChannel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/custom-channels", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { channels?: CustomChannel[] }) => {
        if (alive) setCustom(data.channels || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const label = selectedName ?? "Özel kanal seç";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`group flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition-all duration-200 sm:px-3.5 sm:py-2.5 ${
          open
            ? "border-rose-500/70 bg-gradient-to-r from-rose-950/60 to-zinc-950 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]"
            : "border-zinc-700/80 bg-gradient-to-r from-zinc-900 to-zinc-950 hover:border-rose-600/50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-sm">
            <ListVideo className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">
              Özel kanallarım
            </span>
            <span
              className={`block truncate text-[12px] font-medium sm:text-[13px] ${
                selectedName ? "text-white" : "text-zinc-400"
              }`}
            >
              {label}
            </span>
          </span>
        </span>
        {loaded && custom.length === 0 ? (
          <span className="shrink-0 text-[10px] text-zinc-500">boş</span>
        ) : !loaded ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
              open ? "rotate-180 text-rose-300" : ""
            }`}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Özel kanallarım"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-2xl border border-zinc-700/80 bg-zinc-950/98 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          {custom.length === 0 ? (
            <p className="px-3 py-3 text-[12px] leading-relaxed text-zinc-400">
              Henüz özel kanal yok. Kanal eklemek için
              <span className="text-rose-300"> public/custom-channels.json </span>
              dosyasını düzenleyin.
            </p>
          ) : (
            custom.map((channel) => {
              const active = selectedName === channel.name;
              return (
                <button
                  key={`${channel.name}-${channel.url}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onCustomSelect(channel.url, channel.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                    active
                      ? "bg-rose-600/15 text-rose-100"
                      : "text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] ${
                      active ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {active ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium sm:text-[13px]">
                    {channel.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
