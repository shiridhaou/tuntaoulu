import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Subtle, non-blocking offline indicator. Purely presentational: it never
 * unmounts or resets any scoring UI, it only tells the operator that the
 * device lost its network link so results may not be syncing yet.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      dir="rtl"
      role="status"
      className="fixed top-2 inset-x-0 z-[9998] flex justify-center pointer-events-none px-3"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 backdrop-blur-md px-4 py-1.5 text-[11px] font-arabic text-amber-200 shadow-lg">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>وضع عدم الاتصال — التطبيق يعمل محلياً وسيتم المزامنة عند استعادة الشبكة</span>
      </div>
    </div>
  );
}
