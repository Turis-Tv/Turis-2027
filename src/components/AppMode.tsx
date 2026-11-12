"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Echte PWA-installatieknop.
 * Geen "schakelaar" meer: die kon de adresbalk toch niet verbergen.
 * De adresbalk verdwijnt alleen als je de app daarna vanaf het startscherm opent.
 */
export default function AppMode() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setReady(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch(() => {});
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
        onClick={install}
        title={installed ? "Uygulama yüklü" : "Ana ekrana yükle"}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/70 bg-emerald-950/50 px-2.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/60 sm:px-3"
      >
        {installed ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        <span className="hidden sm:inline">{installed ? "Yüklü" : "Yükle"}</span>
      </button>

      {ready && helpOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 px-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Ana ekrana ekle</h2>
                  <p className="text-xs text-zinc-400">Turis Tv uygulaması</p>
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

            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-semibold text-white">Android — Chrome</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-400">
                  <li>Siteyi Chrome'da açın.</li>
                  <li>Sağ üstteki üç noktaya dokunun.</li>
                  <li><strong className="text-zinc-200">Ana ekrana ekle</strong> seçin.</li>
                  <li><strong className="text-zinc-200">Yükle</strong> düğmesine dokunun.</li>
                  <li>Sonra Turis Tv'yi <strong className="text-zinc-200">ana ekrandaki simgeden</strong> açın.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-semibold text-white">iPhone — Safari</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-400">
                  <li>Siteyi Safari'de açın.</li>
                  <li>Paylaş düğmesine dokunun.</li>
                  <li><strong className="text-zinc-200">Ana Ekrana Ekle</strong> seçin.</li>
                  <li><strong className="text-zinc-200">Ekle</strong> düğmesine dokunun.</li>
                </ol>
              </div>
            </div>

            <p className="mt-4 rounded-2xl border border-amber-900/40 bg-amber-950/25 p-3 text-xs leading-relaxed text-amber-100/80">
              <strong>Önemli:</strong> Web adresi normal tarayıcı sekmesinde her zaman görünür.
              Adres çubuğu yalnızca uygulamayı ana ekrandaki simgeden açtığınızda kaybolur.
              Bunu bir düğme ile değiştirmek teknik olarak mümkün değildir.
            </p>

            {promptEvent && (
              <button
                onClick={install}
                className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
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
