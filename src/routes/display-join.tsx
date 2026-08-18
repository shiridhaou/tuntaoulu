import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";
import { FederationLogo } from "@/components/FederationLogo";
import { supabase } from "@/integrations/supabase/client";
import { ensureDeviceSession, joinSessionMembership } from "@/lib/sessionMembership";
import { Monitor, KeyRound, LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";


export const Route = createFileRoute("/display-join")({
  head: () => ({
    meta: [
      { title: "شاشة العرض · Display Join" },
      { name: "description", content: "بوابة الانضمام لشاشة العرض العامة" },
    ],
  }),
  component: DisplayJoinPage,
});

function DisplayJoinPage() {
  const { setSessionCode, logout } = useCompetition();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function connect() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { toast.error("أدخل رمز جلسة صالحاً"); return; }
    setLoading(true);
    try {
      // A device identity must exist BEFORE anything else, otherwise the display
      // cannot read the session's live rows once it is in.
      await ensureDeviceSession();
      // Session codes are no longer publicly listable; validate via a scoped RPC.
      const { data: active, error } = await supabase.rpc("is_active_session", { _code: c });
      if (error) throw error;
      if (!active) { toast.error("رمز الجلسة غير صحيح أو غير نشط"); return; }
      // Register the display as a session member so reads are permitted.
      await joinSessionMembership(c, "display");
      setSessionCode(c);
      toast.success("تم الاتصال — جارٍ فتح شاشة العرض");
      navigate({ to: "/scoreboard" });
    } catch (e: any) {
      toast.error(e.message ?? "فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="mesh-gradient-bg" />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative z-10 border border-purple-500/30"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <FederationLogo size="md" />
          <div className="h-12 w-12 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Monitor className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-widest text-purple-300 font-body">Public Display</p>
            <h1 className="text-xl font-heading font-bold text-gold mt-1">شاشة العرض العامة</h1>
            <p className="text-xs text-muted-foreground mt-1">أدخل رمز الجلسة الذي أنشأه الحكم الرئيسي</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs flex items-center gap-1 text-white/70">
            <KeyRound className="h-3 w-3" /> رمز الجلسة
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="ABC123"
            className="w-full h-14 rounded-xl bg-background/40 border border-white/10 text-center font-mono text-2xl tracking-widest focus:outline-none focus:border-purple-400/60"
            maxLength={8}
            autoFocus
          />

          <button
            onClick={connect}
            disabled={loading || !code.trim()}
            className="w-full h-12 rounded-xl bg-gold text-navy hover:brightness-110 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading
              ? (<><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الاتصال… · Connecting…</>)
              : (<><LogIn className="h-4 w-4" /> فتح شاشة العرض</>)}
          </button>

          <button onClick={logout} className="w-full h-10 rounded-xl text-muted-foreground hover:text-white flex items-center justify-center gap-2 text-sm">
            <LogOut className="h-4 w-4" /> رجوع
          </button>
        </div>
      </motion.div>
    </div>
  );
}
