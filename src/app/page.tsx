"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  Smartphone,
  Tv,
  Unlock,
  X,
} from "lucide-react";
import PinPad from "@/components/PinPad";
import { ALL_CHANNEL_PATHS } from "@/lib/channels";

type Channel = {
  id: number;
  title: string;
  path: string;
  m3u8Url: string | null;
  kodk: string | null;
  kos: string | null;
  status: string;
  updatedAt?: string;
};

function buildM3U(list: Channel[]) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const c of list) {
    if (!c.m3u8Url) continue;
    lines.push(
      `#EXTINF:-1 tvg-id="" tvg-name="${c.title}" group-title="TurisTV",${c.title}`
    );
    lines.push(c.m3u8Url);
  }
  return lines.join("\n") + "\n";
}

function buildPlainList(list: Channel[]) {
  return list
    .filter((c) => c.m3u8Url)
    .map((c) => `${c.title} | ${c.m3u8Url}`)
    .join("\n");
}

const MASK_URL = "••••••••••••••••••••";

// Altijd direct 37 kanalen tonen; nooit meer afhankelijk van DB/API voor de eerste render.
const INITIAL_CHANNELS: Channel[] = ALL_CHANNEL_PATHS.map((channel, index) => ({
  id: index + 1,
  title: channel.title,
  path: channel.path,
  m3u8Url: null,
  kodk: null,
  kos: null,
  status: "ok",
}));

export default function HomePage() {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Channel | null>(INITIAL_CHANNELS[0] ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshAllRunning, setRefreshAllRunning] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ done: 0, total: 0 });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerAttempt, setPlayerAttempt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileInfo, setMobileInfo] = useState<{
    primary: string;
    urls: string[];
    qr: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const relayUrlFor = (c: Channel) =>
    `${appOrigin}/api/hls?p=${encodeURIComponent(c.path)}`;

  const openMobileInfo = async () => {
    setMobileOpen(true);
    setMobileInfo(null);
    try {
      const res = await fetch("/api/network", { cache: "no-store" });
      const data = await res.json();
      setMobileInfo(data);
    } catch {
      showToast("Yerel ağ adresi alınamadı");
    }
  };

  const fetchChannels = useCallback(async (): Promise<Channel[]> => {
    try {
      const res = await fetch("/api/channels", {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      const list = (data.channels || []) as Channel[];
      return list.length > 0 ? list : INITIAL_CHANNELS;
    } catch (e) {
      console.error(e);
      return INITIAL_CHANNELS;
    }
  }, []);

  const loadChannels = useCallback(async () => {
    const list = await fetchChannels();
    setChannels(list.length > 0 ? list : INITIAL_CHANNELS);
    setSelected((prev) => prev ?? list[0] ?? INITIAL_CHANNELS[0] ?? null);
    setLoading(false);
  }, [fetchChannels]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = await res.json();
        setUnlocked(Boolean(data.unlocked));
        await loadChannels();
      } catch {
        setLoading(false);
      }
    })();
  }, [loadChannels]);

  // ---------- PIN ----------
  const requireUnlock = (action?: () => void) => {
    if (unlocked) {
      action?.();
      return;
    }
    pendingRef.current = action ?? null;
    setPinOpen(true);
  };

  const lockEverything = async () => {
    await fetch("/api/lock", { method: "POST" }).catch(() => {});
    setUnlocked(false);
    setLinksOpen(false);
    showToast("Tüm bağlantılar kilitlendi");
  };

  const toggleLinksSection = () => {
    if (linksOpen) {
      setLinksOpen(false);
      return;
    }
    requireUnlock(() => {
      setLinksOpen(true);
      setTimeout(() => {
        document
          .getElementById("alle-m3u8-links")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    });
  };

  const handleUnlockSuccess = () => {
    setPinOpen(false);
    setUnlocked(true);
    if (pendingRef.current) setLinksOpen(true);
    showToast("Kilit açıldı — tüm bağlantılar görünür");
    loadChannels();
    const action = pendingRef.current;
    pendingRef.current = null;
    if (action) setTimeout(action, 400);
  };

  // ---------- Kopyalama ve indirme ----------
  const writeClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const flashCopied = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
    showToast("Panoya kopyalandı");
  };

  const copyChannelLink = (c: Channel) =>
    requireUnlock(async () => {
      const fresh = await fetchChannels();
      const row = fresh.find((x) => x.path === c.path);
      const url = row?.m3u8Url;
      if (!url) {
        showToast("Bağlantı yok — önce yenileyin");
        return;
      }
      await writeClipboard(url);
      flashCopied(`copy-${c.path}`);
    });

  const copyChannelRelay = (c: Channel) =>
    requireUnlock(async () => {
      await writeClipboard(relayUrlFor(c));
      flashCopied(`copyr-${c.path}`);
    });

  const copyAllM3U = () =>
    requireUnlock(async () => {
      const fresh = await fetchChannels();
      await writeClipboard(buildM3U(fresh));
      flashCopied("copy-m3u-all");
    });

  const copyAllPlain = () =>
    requireUnlock(async () => {
      const fresh = await fetchChannels();
      await writeClipboard(buildPlainList(fresh));
      flashCopied("copy-plain-all");
    });

  const copyAllRelay = () =>
    requireUnlock(async () => {
      await writeClipboard(
        channels
          .map((c, i) => `${i + 1}. ${c.title} | ${relayUrlFor(c)}`)
          .join("\n")
      );
      flashCopied("copy-relay-plain");
    });

  const saveBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadM3U = () =>
    requireUnlock(async () => {
      const fresh = await fetchChannels();
      saveBlob(buildM3U(fresh), "turis-tv.m3u", "audio/x-mpegurl");
      showToast("M3U oynatma listesi indirildi");
    });

  const downloadM3URelay = () =>
    requireUnlock(async () => {
      const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
      channels.forEach((c) => {
        lines.push(
          `#EXTINF:-1 tvg-id="" tvg-name="${c.title}" group-title="TurisTV",${c.title}`
        );
        lines.push(relayUrlFor(c));
      });
      saveBlob(lines.join("\n") + "\n", "turis-tv-kalici.m3u", "audio/x-mpegurl");
      showToast("Kalıcı M3U oynatma listesi indirildi");
    });

  const downloadTxt = () =>
    requireUnlock(async () => {
      const fresh = await fetchChannels();
      saveBlob(buildPlainList(fresh), "turis-tv-m3u8.txt", "text/plain");
      showToast("Bağlantı listesi indirildi");
    });

  // ---------- Oynatıcı: PIN yok, otomatik hata giderme ----------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected?.path) return;

    setPlayerError(null);
    setPlayerLoading(true);

    const baseSrc = `/api/hls?p=${encodeURIComponent(selected.path)}`;
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;

    const cleanup = () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 25000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 30000,
      });
      hlsRef.current = hls;
      hls.loadSource(`${baseSrc}&attempt=${playerAttempt}`);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        setPlayerLoading(false);
        setPlayerError(null);
        video.play().catch(() => {
          // Tarayıcı otomatik oynatmayı engellerse kullanıcı play'e basabilir.
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (destroyed || !data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 3) {
          networkRetries += 1;
          setPlayerLoading(true);
          setPlayerError(null);
          retryTimer = setTimeout(() => {
            if (destroyed) return;
            hls.stopLoad();
            hls.loadSource(`${baseSrc}&retry=${Date.now()}`);
            hls.startLoad();
          }, 800 * networkRetries);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
          mediaRetries += 1;
          setPlayerLoading(true);
          setPlayerError(null);
          hls.recoverMediaError();
          return;
        }

        setPlayerLoading(false);
        setPlayerError(
          data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? "Yayın yüklenirken ağ hatası oluştu. Otomatik denemeler tamamlandı; Tekrar dene düğmesine basın."
            : data.type === Hls.ErrorTypes.MEDIA_ERROR
            ? "Video oynatılırken medya hatası oluştu. Tekrar deneyin."
            : "Oynatıcı hatası oluştu. Tekrar deneyin."
        );
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onLoaded = () => {
        setPlayerLoading(false);
        video.play().catch(() => {});
      };
      const onError = () => {
        setPlayerLoading(false);
        setPlayerError("Yayın yüklenemedi. Tekrar deneyin.");
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.src = baseSrc;
      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        cleanup();
      };
    } else {
      setPlayerLoading(false);
      setPlayerError("Bu tarayıcı HLS oynatmayı desteklemiyor.");
    }

    return cleanup;
  }, [selected, playerAttempt]);

  // ---------- Yenileme ----------
  const refreshOne = async (ch: Channel) => {
    setRefreshing((r) => ({ ...r, [ch.path]: true }));
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ch.path }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("refresh");
      const freshUrl = data.m3u8Url as string | undefined;
      setChannels((prev) =>
        prev.map((c) =>
          c.path === ch.path
            ? {
                ...c,
                ...(freshUrl
                  ? { m3u8Url: freshUrl, kodk: data.kodk, kos: data.kos }
                  : {}),
                status: "ok",
              }
            : c
        )
      );
      if (freshUrl && selected?.path === ch.path) {
        setSelected((prev) =>
          prev ? { ...prev, m3u8Url: freshUrl, kodk: data.kodk, kos: data.kos } : prev
        );
      }
      showToast(`${ch.title} yenilendi`);
    } catch {
      showToast(`${ch.title}: yenileme başarısız`);
    } finally {
      setRefreshing((r) => ({ ...r, [ch.path]: false }));
    }
  };

  const refreshAll = async () => {
    if (refreshAllRunning) return;
    setRefreshAllRunning(true);
    setRefreshProgress({ done: 0, total: channels.length });
    let done = 0;
    for (const ch of channels) {
      await refreshOne(ch);
      done += 1;
      setRefreshProgress({ done, total: channels.length });
    }
    setRefreshAllRunning(false);
    showToast("Tüm kanallar yenilendi");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return channels;
    return channels.filter((c) =>
      c.title.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [channels, search]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white">
              <Tv className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Turis Tv
              </h1>
              <p className="text-sm text-zinc-400">
                {channels.length} kanal · PIN olmadan izle ·{" "}
                {unlocked ? "bağlantılar açık" : "bağlantılar PIN ile kilitli"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openMobileInfo}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Smartphone className="h-4 w-4" />
              Mobil
            </button>
            <button
              onClick={refreshAll}
              disabled={refreshAllRunning || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {refreshAllRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {refreshAllRunning
                ? `Yenileniyor ${refreshProgress.done}/${refreshProgress.total}`
                : "Tüm bağlantıları yenile"}
            </button>
            {unlocked ? (
              <button
                onClick={lockEverything}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
              >
                <Unlock className="h-4 w-4" />
                Kilitle
              </button>
            ) : (
              <button
                onClick={() => setPinOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                <Lock className="h-4 w-4" />
                Bağlantıları göster (PIN)
              </button>
            )}
          </div>
        </div>
        {refreshAllRunning && (
          <div className="h-1 w-full bg-zinc-800">
            <div
              className="h-1 bg-red-600 transition-all"
              style={{
                width: `${
                  channels.length
                    ? (refreshProgress.done / refreshProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Mobiel: kanalen altijd direct boven de speler bereikbaar */}
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 lg:hidden">
          <label
            htmlFor="mobile-channel-select"
            className="mb-2 block text-sm font-semibold text-white"
          >
            Kanal seç
          </label>
          <select
            id="mobile-channel-select"
            value={selected?.path ?? ""}
            onChange={(e) => {
              const next = channels.find((c) => c.path === e.target.value);
              if (next) setSelected(next);
            }}
            disabled={loading || channels.length === 0}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3.5 text-base font-medium text-white focus:border-red-600 focus:outline-none disabled:opacity-50"
          >
            {loading ? (
              <option value="">Kanallar yükleniyor…</option>
            ) : channels.length === 0 ? (
              <option value="">Kanal bulunamadı</option>
            ) : (
              channels.map((c, idx) => (
                <option key={c.path} value={c.path}>
                  {idx + 1}. {c.title}
                </option>
              ))
            )}
          </select>
          <p className="mt-2 text-xs text-zinc-400">
            {channels.length} kanal · oynatmak için listeden seçim yapın
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="min-w-0 truncate text-sm font-semibold text-white">
                  {selected ? selected.title : "Kanal seçilmedi"}
                </p>
                <div className="flex items-center gap-2">
                  {playerLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  )}
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    HLS / M3U8
                  </span>
                </div>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full"
                  controls
                  playsInline
                />
                {playerLoading && !playerError && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
                    <div className="flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-zinc-200">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Kanal yükleniyor…
                    </div>
                  </div>
                )}
              </div>
              {playerError && (
                <div className="flex flex-col gap-3 border-t border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>{playerError}</span>
                  <button
                    onClick={() => setPlayerAttempt((a) => a + 1)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tekrar dene
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Kanallar</h2>
                <p className="mt-0.5 text-xs text-zinc-500 lg:hidden">
                  Tüm kanallar burada — seçmek için dokunun
                </p>
              </div>
              <span className="text-xs text-zinc-400">
                {filtered.length} / {channels.length}
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kanal ara..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none"
              />
            </div>
            <div className="mt-3 max-h-[400px] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[480px] lg:max-h-[560px]">
              {loading ? (
                <div className="grid place-items-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Kanal bulunamadı
                </p>
              ) : (
                filtered.map((c, idx) => {
                  const active = selected?.path === c.path;
                  return (
                    <button
                      key={c.path}
                      onClick={() => setSelected(c)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-red-600/60 bg-red-600/10 text-white"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          active ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {c.title}
                      </span>
                      {active && <Play className="h-4 w-4 shrink-0 text-red-500" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <button
          onClick={toggleLinksSection}
          aria-expanded={linksOpen}
          aria-controls="alle-m3u8-links"
          className="group mt-8 flex w-full items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 px-5 py-5 text-left transition hover:border-red-700/50 hover:bg-zinc-800/70"
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                linksOpen ? "bg-red-600 text-white" : "bg-zinc-800 text-red-400"
              }`}
            >
              {linksOpen ? <Link2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-semibold text-white sm:text-lg">
                Tüm M3U8 bağlantıları tek listede
              </h2>
              <p className="text-xs text-zinc-400 sm:text-sm">
                {linksOpen
                  ? "Açık — her şeyi kapatmak için oka tıklayın"
                  : unlocked
                  ? "Tüm bağlantıları, listeleri ve indirmeleri açmak için oka tıklayın"
                  : "Oka tıklayın ve her şeyi açmak için PIN kodunuzu girin"}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-3">
            <span className="hidden rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 sm:inline">
              {channels.length} bağlantı
            </span>
            {linksOpen ? (
              <ChevronUp className="h-7 w-7 shrink-0 text-zinc-300 transition group-hover:text-white" />
            ) : (
              <ChevronDown className="h-7 w-7 shrink-0 animate-[chevron-bounce_1.8s_ease-in-out_infinite] text-zinc-300 transition group-hover:text-white" />
            )}
          </span>
        </button>

        {linksOpen && (
          <div id="alle-m3u8-links" className="scroll-mt-4">
            <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-base font-semibold text-white">
                  Tüm M3U8 bağlantıları tek listede
                </h2>
                <p className="text-sm text-zinc-400">
                  Kanal başına kopyalayın veya sayfanın altından tümünü indirin
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Kanal</th>
                      <th className="px-4 py-3 font-medium">M3U8 bağlantısı</th>
                      <th className="px-4 py-3 text-right font-medium">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr
                        key={c.path}
                        className="border-b border-zinc-800/60 transition hover:bg-zinc-800/40"
                      >
                        <td className="px-4 py-3 text-zinc-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-white">{c.title}</td>
                        <td className="max-w-[420px] px-4 py-3">
                          <code className="block truncate font-mono text-xs text-zinc-400">
                            {unlocked ? c.m3u8Url || "— bağlantı yok —" : MASK_URL}
                          </code>
                          <code className="mt-1 block truncate font-mono text-xs text-emerald-400/90">
                            {unlocked ? relayUrlFor(c) : MASK_URL}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => copyChannelLink(c)}
                              title="Doğrudan M3U8 bağlantısını kopyala"
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                            >
                              {copiedId === `copy-${c.path}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Doğrudan
                            </button>
                            <button
                              onClick={() => copyChannelRelay(c)}
                              title="Kalıcı bağlantıyı kopyala"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-800 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-900/40"
                            >
                              {copiedId === `copyr-${c.path}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" />
                              )}
                              Kalıcı
                            </button>
                            <button
                              onClick={() => refreshOne(c)}
                              disabled={!!refreshing[c.path]}
                              title="Bağlantıyı yenile"
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
                            >
                              {refreshing[c.path] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Yenile
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Doğrudan M3U8 bağlantıları
                    </h2>
                    <p className="text-xs text-zinc-400">
                      İmzalı bağlantılar — yaklaşık 1 saat sonra süresi dolar
                    </p>
                  </div>
                  <button
                    onClick={copyAllPlain}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-700"
                  >
                    {copiedId === "copy-plain-all" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Tümünü kopyala
                  </button>
                </div>
                <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-300">
                  {unlocked
                    ? buildPlainList(channels) || "— bağlantı yok —"
                    : "Kilitli.\nTüm bağlantıları görmek için PIN kodunuzu girin."}
                </pre>
              </div>

              <div className="rounded-3xl border border-emerald-900/40 bg-zinc-900 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Kalıcı bağlantılar (relay)
                    </h2>
                    <p className="text-xs text-emerald-400/80">
                      Her zaman çalışır — token otomatik yenilenir
                    </p>
                  </div>
                  <button
                    onClick={copyAllRelay}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-600"
                  >
                    {copiedId === "copy-relay-plain" ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Tümünü kopyala
                  </button>
                </div>
                <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-emerald-950/60 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-emerald-200/90">
                  {unlocked
                    ? channels
                        .map((c, i) => `${i + 1}. ${c.title} | ${relayUrlFor(c)}`)
                        .join("\n")
                    : "Kilitli.\nTüm bağlantıları görmek için PIN kodunuzu girin."}
                </pre>
              </div>
            </section>

            <section
              id="downloads"
              className="mt-6 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6"
            >
              <div className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">
                  İndirmeler ve tümünü kopyala
                </h2>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Tüm indirme ve kopyalama seçenekleri sayfanın en altında, PIN korumalıdır.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={downloadM3U}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  <Download className="h-4 w-4" />
                  .m3u indir (doğrudan)
                </button>
                <button
                  onClick={downloadM3URelay}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  <Download className="h-4 w-4" />
                  .m3u indir (kalıcı)
                </button>
                <button
                  onClick={downloadTxt}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                >
                  <FileText className="h-4 w-4" />
                  .txt indir
                </button>
                <button
                  onClick={copyAllM3U}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                >
                  {copiedId === "copy-m3u-all" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Tüm M3U listesini kopyala
                </button>
                <button
                  onClick={copyAllPlain}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                >
                  {copiedId === "copy-plain-all" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Tüm bağlantıları metin olarak kopyala
                </button>
                <button
                  onClick={copyAllRelay}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-800 bg-emerald-950/40 px-4 py-3.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/50"
                >
                  {copiedId === "copy-relay-plain" ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Tüm kalıcı bağlantıları kopyala
                </button>
              </div>
            </section>

            <button
              onClick={() => setLinksOpen(false)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm font-medium text-zinc-300 transition hover:border-red-700/50 hover:bg-zinc-800 hover:text-white"
            >
              <ChevronUp className="h-5 w-5" />
              Tümünü kapat
            </button>
          </div>
        )}

        <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-zinc-800 pt-6 text-xs text-zinc-500 sm:flex-row">
          <p>Turis Tv — PIN olmadan izle, bağlantılar PIN ile korunur.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLinksSection}
              className="inline-flex items-center gap-1 text-zinc-400 transition hover:text-zinc-200"
            >
              {linksOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {linksOpen ? "Bağlantıları kapat" : "Bağlantılar ve indirmeler"}
            </button>
          </div>
        </footer>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Telefonda aç</h2>
                  <p className="text-xs text-zinc-400">Aynı Wi-Fi ağında QR kod veya yerel adres</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mobileInfo ? (
              <div className="mt-5 text-center">
                <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                  {/* QR-code is bewust als afbeelding zodat de telefooncamera hem direct kan scannen. */}
                  <img src={mobileInfo.qr} alt="Turis Tv mobil QR kod" className="h-64 w-64" />
                </div>
                <p className="mt-4 break-all rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-3 font-mono text-sm font-semibold text-emerald-200">
                  {mobileInfo.primary}
                </p>
                <button
                  onClick={async () => {
                    await writeClipboard(mobileInfo.primary);
                    showToast("Mobil adres kopyalandı");
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-700"
                >
                  <Copy className="h-4 w-4" />
                  Adresi kopyala
                </button>
                {mobileInfo.urls.length > 1 && (
                  <div className="mt-3 text-left text-xs text-zinc-400">
                    <p className="mb-1 font-semibold text-zinc-300">Diğer olası adresler:</p>
                    {mobileInfo.urls.slice(1).map((url) => (
                      <p key={url} className="break-all font-mono">{url}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            )}

            <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-400">
              <li>Bilgisayardaki Turis Tv sunucusu açık kalmalıdır.</li>
              <li>Telefon ve bilgisayar aynı Wi-Fi ağında olmalıdır.</li>
              <li>QR kodu telefon kamerasıyla okutun veya adresi yazın.</li>
              <li><strong className="text-red-300">127.0.0.1 kullanmayın</strong> — o adres telefonun kendisidir.</li>
            </ol>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}

      <PinPad
        open={pinOpen}
        onClose={() => {
          setPinOpen(false);
          pendingRef.current = null;
        }}
        onSuccess={handleUnlockSuccess}
      />
    </main>
  );
}
