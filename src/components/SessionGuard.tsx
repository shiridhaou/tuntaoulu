import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompetition } from "@/store/competition-store";
import { ShieldAlert, Loader2 } from "lucide-react";

const ORANGE = "#FF7A1A";

/**
 * SessionGuard — verifies the active sessionCode exists in the `sessions` table.
 *
 * Used by judge & TA panels so a stale localStorage code (or a guess) cannot grant
 * access to a tournament. Each Chief's session is hard-isolated by its unique code:
 * if it isn't found, we render a "Session Unauthorized" screen and force the user to
 * re-join. The Chief role bypasses this guard (they own / generate the session).
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { sessionCode, logout } = useCompetition();
  const [state, setState] = useState<"checking" | "ok" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    if (!sessionCode) {
      setState("invalid");
      return;
    }
    setState("checking");
    supabase
      .rpc("is_active_session", { _code: sessionCode })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.warn("[SessionGuard] invalid/expired session", { sessionCode, error });
          setState("invalid");
        } else {
          setState("ok");
        }
      });
    return () => { cancelled = true; };
  }, [sessionCode]);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs font-body tracking-widest uppercase">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-white" style={{ background: "#050505" }}>
        <div className="max-w-md w-full rounded-3xl border bg-[#0a0a0a] p-6 text-center"
          style={{ borderColor: `${ORANGE}55`, boxShadow: `0 0 60px ${ORANGE}22` }}>
          <div className="h-14 w-14 mx-auto rounded-2xl border flex items-center justify-center mb-4"
            style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}66` }}>
            <ShieldAlert className="h-7 w-7" style={{ color: ORANGE }} />
          </div>
          <h1 className="text-xl font-heading font-black text-white mb-1">Session Unauthorized</h1>
          <p className="text-sm text-white/60 font-body mb-1">جلسة غير صالحة أو منتهية</p>
          <p className="text-xs text-white/40 font-body mb-5">
            رمز الجلسة <span className="text-gold font-heading" dir="ltr">{sessionCode || "------"}</span> غير معترف به. اطلب رمزًا جديدًا من الحكم الرئيسي.
          </p>
          <button onClick={logout}
            className="w-full h-12 rounded-xl font-heading font-black text-sm tracking-widest"
            style={{ background: ORANGE, color: "#000" }}>
            رجوع · BACK TO START
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
