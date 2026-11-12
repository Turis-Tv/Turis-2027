"use client";

import { useCallback, useEffect, useState } from "react";
import { Delete, Loader2, Lock, X } from "lucide-react";

type PinPadProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pinLength?: number;
};

export default function PinPad({
  open,
  onClose,
  onSuccess,
  pinLength = 4,
}: PinPadProps) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const reset = useCallback(() => {
    setPin("");
    setError(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Sluiten met Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (/^\d$/.test(e.key)) push(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        reset();
        onSuccess();
        return;
      }
      setError(data.error || "Yanlış PIN.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin("");
    } catch {
      setError("Ağ hatası. Tekrar deneyin.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const push = (digit: string) => {
    if (busy) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      const next = prev + digit;
      if (next.length === pinLength) {
        // kleine vertraging zodat het laatste bolletje zichtbaar is
        setTimeout(() => submit(next), 120);
      }
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl ${
          shake ? "animate-[pin-shake_0.4s_ease-in-out]" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/15 text-red-500">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Bağlantıların kilidini aç
              </h2>
              <p className="text-xs text-zinc-400">
                Kişisel PIN kodunuzu girin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* PIN-bolletjes */}
        <div className="mt-6 flex justify-center gap-3">
          {Array.from({ length: pinLength }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border transition-all ${
                i < pin.length
                  ? "border-red-500 bg-red-500"
                  : "border-zinc-600 bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <div className="mt-3 h-5 text-center text-xs text-red-400">
          {error ? error : busy ? "Kontrol ediliyor…" : "\u00A0"}
        </div>

        {/* Numpad */}
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => push(d)}
              disabled={busy}
              className="rounded-2xl border border-zinc-800 bg-zinc-800/70 py-3.5 text-xl font-semibold text-white transition hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={busy}
            aria-label="Sil"
            className="rounded-2xl border border-zinc-800 bg-zinc-800/40 py-3.5 text-zinc-300 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
          >
            <Delete className="mx-auto h-5 w-5" />
          </button>
          <button
            onClick={() => push("0")}
            disabled={busy}
            className="rounded-2xl border border-zinc-800 bg-zinc-800/70 py-3.5 text-xl font-semibold text-white transition hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={() => submit(pin)}
            disabled={busy || pin.length < 4}
            aria-label="Onayla"
            className="rounded-2xl bg-red-600 py-3.5 text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              <Lock className="mx-auto h-5 w-5" />
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
          Bu PIN kodunu yalnızca siz biliyorsunuz. 5 hatalı denemeden sonra
          geçici engelleme uygulanır. Oturumunuz 12 saat geçerlidir.
        </p>
      </div>
    </div>
  );
}
