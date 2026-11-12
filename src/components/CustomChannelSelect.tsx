"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ListVideo, Loader2, Play } from "lucide-react";

type CustomChannel = { name: string; url: string };

type Props = {
  selectedName: string | null;
  onCustomSelect: (url: string, name: string) => void;
  /** Vertelt de pagina of het paneel open is (gewone lijst wordt dan verborgen). */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Alleen de eigen kanalen uit public/custom-channels.json.
 * Bij openen krijgt de lijst een eigen kleur en neemt hij de plaats van de
 * gewone kanaallijst in, zodat je er rustig doorheen kunt scrollen.
 */
export default function CustomChannelSelect({
  selectedName,
  onCustomSelect,
  onOpenChange,
}: Props) {
  const [custom, setCustom] = useState<CustomChannel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

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

  const setPanel = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  const label = selectedName ?? "Özel kanal seç";

  return (
    <div>
      <button
        type="button"
        onClick={() => setPanel(!open)}
        aria-expanded={open}
        aria-controls="ozel-turis-panel"
        className={`group flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition-all duration-200 sm:px-3.5 sm:py-2.5 ${
          open
            ? "border-violet-500/70 bg-gradient-to-r from-violet-950/70 to-zinc-950 shadow-[0_0_0_3px_rgba(139,92,246,0.14)]"
            : "border-zinc-700/80 bg-gradient-to-r from-zinc-900 to-zinc-950 hover:border-violet-500/50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-700 text-white shadow-sm">
            <ListVideo className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-violet-300/85">
              Özel Turis
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
        {!loaded ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
              open ? "rotate-180 text-violet-300" : ""
            }`}
          />
        )}
      </button>

      {open && (
        <div
          id="ozel-turis-panel"
          role="listbox"
          aria-label="Özel Turis"
          className="mt-2 max-h-[380px] overflow-y-auto rounded-2xl border border-violet-700/50 bg-gradient-to-b from-[#1a1038] via-[#120b28] to-[#0a0618] p-2 shadow-2xl shadow-violet-950/50 sm:max-h-[480px]"
        >
          <div className="mb-1.5 flex items-center justify-between px-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/80">
              Özel Turis listesi
            </span>
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200">
              {custom.length} kanal
            </span>
          </div>

          {custom.length === 0 ? (
            <p className="px-2 py-3 text-[12px] leading-relaxed text-violet-200/70">
              Henüz özel kanal yok. Kanal eklemek için
              <span className="text-violet-200"> public/custom-channels.json </span>
              dosyasını düzenleyin.
            </p>
          ) : (
            <div className="space-y-1">
              {custom.map((channel, index) => {
                const active = selectedName === channel.name;
                return (
                  <button
                    key={`${channel.name}-${channel.url}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onCustomSelect(channel.url, channel.name);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                      active
                        ? "border-violet-400/60 bg-violet-500/25 text-white"
                        : "border-transparent bg-white/[0.03] text-violet-100/85 hover:border-violet-500/30 hover:bg-violet-500/15 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                        active
                          ? "bg-violet-500 text-white"
                          : "bg-violet-950/80 text-violet-300"
                      }`}
                    >
                      {active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium sm:text-[13px]">
                      {channel.name}
                    </span>
                    <Play className="h-3 w-3 shrink-0 text-violet-300/60" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
