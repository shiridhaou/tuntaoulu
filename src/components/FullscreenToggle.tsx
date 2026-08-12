import { useEffect, useState, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Floating, semi-transparent fullscreen toggle for TV / Public Display screens.
 * Auto-hides after 2.5s of mouse inactivity to keep the broadcast clean.
 * Press F11-style toggle on click, or hit the "F" key.
 */
export function FullscreenToggle({ corner = "bottom-right" }: { corner?: "top-right" | "bottom-right" | "top-left" | "bottom-left" }) {
  const [isFs, setIsFs] = useState(false);
  const [visible, setVisible] = useState(true);

  const toggle = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore — some browsers block without user gesture */
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-hide on idle
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const ping = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 2500);
    };
    ping();
    window.addEventListener("mousemove", ping);
    window.addEventListener("touchstart", ping);
    window.addEventListener("keydown", ping);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", ping);
      window.removeEventListener("touchstart", ping);
      window.removeEventListener("keydown", ping);
    };
  }, []);

  // Keyboard shortcut: "F"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        void toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const pos =
    corner === "top-right" ? "top-4 right-4" :
    corner === "top-left" ? "top-4 left-4" :
    corner === "bottom-left" ? "bottom-4 left-4" :
    "bottom-4 right-4";

  return (
    <button
      onClick={toggle}
      title={isFs ? "خروج من ملء الشاشة (F)" : "ملء الشاشة (F)"}
      aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
      className={`fixed ${pos} z-[9999] h-10 w-10 rounded-full backdrop-blur-md border border-white/15 bg-black/30 text-white/70 hover:text-white hover:bg-black/50 hover:border-white/30 flex items-center justify-center transition-all duration-300 ${
        visible ? "opacity-60 hover:opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
