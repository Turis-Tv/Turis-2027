"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function AppMode() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("turis-app-mode");
    setEnabled(saved === null ? true : saved === "1");
    setReady(true);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.update().catch(() => {});
      }).catch(() => {});
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHelpOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("turis-app-mode", next ? "1" : "0");
    if (next) setHelpOpen(true);
  };

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setHelpOpen(false);
      setPromptEvent(null);
    } else {
      setHelpOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-pressed={enabled}
        title={installed ? "Turis Tv uygulaması yüklü" : "Uygulama modu / ana ekran"}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition sm:px-3 ${
          enabled
            ? "border-emerald-700 bg-emerald-950/60 text-emerald-300"
            : "border-zinc-700 bg-zinc-800 text-zinc-400"
        }`}
      >
        <Smartphone className="h-4 w-4" />
        <span className="hidden md:inline">Uygulama</span>
        <span className={`relative h-4 w-7 rounded-full transition ${enabled ? "bg-emerald-600" : "bg-zinc-600"}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${enabled ? "left-3.5" : "left-0.5"}`} />
        </span>
      </button>

      <button
        onClick={install}
        title="Turis Tv'yi ana ekrana yükle"
        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 py-2.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 sm:px-3"
      >
        <Download className="h-4 w-4" />
        <span className="hidden lg:inline">{installed ? "Yüklendi" : "Yükle"}</span>
      </button>

      {ready && helpOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Turis Tv uygulaması</h2>
                  <p className="text-xs text-zinc-400">Ana ekrana yükleme</p>
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-relaxed text-zinc-300">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-semibold text-white">Android — Chrome</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-400">
                  <li>Turis Tv'yi Chrome'da açın.</li>
                  <li>Sağ üstteki üç nokta menüsüne dokunun.</li>
                  <li><strong className="text-zinc-200">Ana ekrana ekle</strong> seçeneğini seçin.</li>
                  <li><strong className="text-zinc-200">Yükle</strong> düğmesine dokunun.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-semibold text-white">iPhone — Safari</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-400">
                  <li>Siteyi Safari'de açın.</li>
                  <li>Paylaş düğmesine dokunun.</li>
                  <li><strong className="text-zinc-200">Ana Ekrana Ekle</strong> seçeneğini seçin.</li>
                  <li><strong className="text-zinc-200">Ekle</strong> düğmesine dokunun.</li>
                </ol>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Uygulama modu varsayılan olarak açıktır ve bu cihazda saklanır.
              <strong className="text-zinc-300"> Adres çubuğu yalnızca uygulamayı ana ekrandaki simgeden açtığınızda kaybolur.</strong>
              Normal Chrome sekmesinde web adresi görünmeye devam eder.
              Yayınlar çevrimiçi Render sunucusu üzerinden çalışır.
            </p>
            {promptEvent && (
              <button
                onClick={install}
                className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Şimdi yükle
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
