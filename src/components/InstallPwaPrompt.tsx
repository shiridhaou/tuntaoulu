import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tuntaolu_pwa_dismissed_at";
const DISMISS_DAYS = 7;

export function InstallPwaPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't show in iframe (Lovable preview)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    // Already installed
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Recently dismissed
    try {
      const last = localStorage.getItem(DISMISS_KEY);
      if (last && Date.now() - Number(last) < DISMISS_DAYS * 86400000) return;
    } catch { /* ignore */ }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    // Once installed, never show the banner again.
    const installed = () => {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
      setDeferred(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible || !deferred) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[9999] rounded-2xl border border-gold/40 bg-[#0A192F]/95 backdrop-blur-xl p-4 shadow-2xl font-arabic animate-in slide-in-from-bottom-4"
    >
      <button
        onClick={dismiss}
        className="absolute top-2 left-2 h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60"
        aria-label="إغلاق"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <img
          src="/icons/tuntaolu-icon.png"
          alt="TunTaolu"
          className="h-12 w-12 rounded-xl ring-1 ring-gold/40 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-heading font-bold text-gold">
            هل تريد تثبيت نظام التحكيم على جهازك؟
          </h3>
          <p className="text-xs text-white/70 mt-1">
            ثبّت TunTaolu للوصول السريع وتشغيله كتطبيق مستقل.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={install}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gold text-black text-xs font-heading font-bold hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" />
              تثبيت
            </button>
            <button
              onClick={dismiss}
              className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-heading"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
