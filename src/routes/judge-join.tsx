import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCompetition, type RequestedRole } from "@/store/competition-store";
import { FederationLogo } from "@/components/FederationLogo";
import { ShieldCheck, Star, Zap, Target, Users, Cpu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { joinSessionMembership } from "@/lib/sessionMembership";

const ORANGE = "#FF7A1A";
const GOLD = "#F4C542";

type Search = { code?: string };

export const Route = createFileRoute("/judge-join")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "انضمام القاضي · Judge Join" },
      { name: "description", content: "بوابة انضمام القضاة لجلسة التحكيم برمز الجلسة" },
    ],
  }),
  component: JudgeJoinPage,
});

type JoinRole = RequestedRole | "TA";

async function ensureDeviceSession(): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

const ROLE_OPTIONS: { id: JoinRole; title: string; subtitle: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: "A",   title: "Quality Judge",     subtitle: "حكم الجودة (A)",           color: "#34D399", bg: "rgba(52,211,153,0.12)", icon: <Star className="h-6 w-6" /> },
  { id: "B",   title: "Performance Judge", subtitle: "حكم الأداء (B)",           color: "#FB923C", bg: "rgba(251,146,60,0.12)", icon: <Zap className="h-6 w-6" /> },
  { id: "C",   title: "Difficulty Judge",  subtitle: "حكم الصعوبة (C)",          color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: <Target className="h-6 w-6" /> },
  { id: "AHJ", title: "VAR",               subtitle: "حكم الفيديو المساعد (VAR)", color: "#60A5FA", bg: "rgba(96,165,250,0.12)", icon: <Users className="h-6 w-6" /> },
  { id: "TA",  title: "Technical Assistant", subtitle: "المساعد التقني (TA)",     color: "#22D3EE", bg: "rgba(34,211,238,0.12)", icon: <Cpu className="h-6 w-6" /> },
];

function roleFromSelected(selected: string | null): JoinRole | null {
  switch (selected) {
    case "a-quality-judge": return "A";
    case "b-performance-judge": return "B";
    case "c-difficulty-judge": return "C";
    case "assistant-referee": return "AHJ";
    case "technical-assistant": return "TA";
    default: return null;
  }
}

function JudgeJoinPage() {
  const { code: prefilled } = useSearch({ from: "/judge-join" });
  const navigate = useNavigate();
  const {
    sessionCode, setSessionCode, setJudgeId, setSelectedRole, setAuthenticated, selectedRole,
  } = useCompetition();

  const [code, setCode] = useState(prefilled ?? sessionCode ?? "");
  const [role, setRole] = useState<JoinRole | null>(roleFromSelected(selectedRole));
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionCode && !code) setCode(sessionCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  useEffect(() => {
    const derived = roleFromSelected(selectedRole);
    if (derived) setRole(derived);
  }, [selectedRole]);

  const userRoleFromRequested = (r: RequestedRole) =>
    r === "A" ? "a-quality-judge" :
    r === "B" ? "b-performance-judge" :
    r === "C" ? "c-difficulty-judge" : "assistant-referee";

  // Picks the first free seat (1..8) for this role in this session.
  const pickFreeSlot = async (trimmedCode: string, r: RequestedRole): Promise<number> => {
    try {
      const { data } = await supabase
        .from("judge_requests")
        .select("assigned_slot")
        .eq("session_code", trimmedCode)
        .eq("requested_role", r);
      const taken = new Set(
        (data ?? [])
          .map(row => Number(String(row.assigned_slot ?? "").replace(/^[A-Z]+/i, "")))
          .filter(n => Number.isFinite(n) && n > 0),
      );
      for (let n = 1; n <= 8; n++) if (!taken.has(n)) return n;
    } catch { /* offline / RLS → fall through */ }
    return 1;
  };

  const submit = async () => {
    setError("");
    const trimmedCode = code.trim().toUpperCase();
    if (!role) { setError("اختر دورك في التحكيم"); return; }
    if (trimmedCode.length < 4) { setError("أدخل رمز الجلسة الصحيح"); return; }

    setSubmitting(true);
    try {
      // A device identity must exist FIRST: the code check and every later read/write
      // happen as this device, and racing them was the cause of "فشل الدخول".
      await ensureDeviceSession();

      // Verify the code matches an active session created by the Chief.
      const { data: sessionActive, error: sErr } = await supabase
        .rpc("is_active_session", { _code: trimmedCode });

      if (sErr) throw sErr;
      if (!sessionActive) {
        setError("رمز الجلسة غير صحيح أو منتهي — تحقق مع رئيس القضاة");
        setSubmitting(false);
        return;
      }

      // Register this device as a member of the session — required by RLS
      // before any score/status write is accepted.
      await joinSessionMembership(trimmedCode, role);


      setSessionCode(trimmedCode);
      setAuthenticated(true);

      // Technical Assistant: no judging slot, straight into the TA dashboard.
      if (role === "TA") {
        setJudgeId(null);
        setSelectedRole("technical-assistant");
        toast.success("تم الدخول", { description: `المساعد التقني · الجلسة ${trimmedCode}` });
        navigate({ to: "/" });
        return;
      }

      // Judging roles: automatic slot assignment (first free seat 1..8).
      const n = await pickFreeSlot(trimmedCode, role);
      const slotKey = `${role}${n}`;
      await joinSessionMembership(trimmedCode, role, slotKey);

      // Best-effort roster record — never blocks entry.
      try {
        await supabase.from("judge_requests").insert({
          session_code: trimmedCode,
          judge_name: slotKey,
          requested_role: role,
          status: "approved",
          assigned_slot: slotKey,
        });
      } catch { /* ignore */ }

      setSelectedRole(userRoleFromRequested(role));
      setJudgeId(slotKey);
      toast.success("تم الدخول", { description: `الفتحة ${slotKey} · الجلسة ${trimmedCode}` });
      navigate({ to: "/" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الدخول";
      setError(msg);
      toast.error("فشل الدخول", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white" style={{ background: "#050505" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <FederationLogo size="md" />
        </div>
        <div className="rounded-3xl border bg-[#0a0a0a] p-6 space-y-5"
          style={{ borderColor: `${ORANGE}55`, boxShadow: `0 0 40px ${ORANGE}22` }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border flex items-center justify-center"
              style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}66` }}>
              <ShieldCheck className="h-5 w-5" style={{ color: ORANGE }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-body" style={{ color: ORANGE }}>Judge Portal</p>
              <h1 className="text-xl font-heading font-black text-white">الدخول برمز الجلسة</h1>
            </div>
          </div>

          <div>
            <label className="text-xs font-body font-semibold text-white/70 mb-1.5 block">دورك في التحكيم · Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(opt => {
                const active = role === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setRole(opt.id); }}
                    className="relative rounded-2xl border p-3 text-right transition-all hover:brightness-110"
                    style={{
                      background: active ? opt.bg : "rgba(255,255,255,0.02)",
                      borderColor: active ? opt.color : "rgba(255,255,255,0.08)",
                      boxShadow: active ? `0 0 20px ${opt.color}55` : "none",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                        style={{ background: opt.bg, color: opt.color }}>
                        {opt.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-body" style={{ color: opt.color }} dir="ltr">{opt.title}</p>
                        <p className="text-xs font-heading font-bold text-white truncate">{opt.subtitle}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-body font-semibold text-white/70 mb-1.5 block">رمز الجلسة · Session Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") void submit(); }}
              placeholder="ABC123"
              dir="ltr"
              maxLength={6}
              className="w-full h-14 rounded-xl bg-black/40 border border-white/10 text-center text-2xl font-heading font-black tracking-[0.3em] focus:outline-none focus:border-white/30"
              style={{ color: ORANGE }}
            />
          </div>

          {error && <p className="text-sm text-red-400 font-body text-center">{error}</p>}

          <button onClick={submit}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-heading font-black text-base tracking-[0.25em] hover:brightness-110 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000" }}>
            {submitting ? "جارٍ الدخول..." : "دخول الجلسة"}
          </button>
          <p className="text-[11px] text-white/40 font-body text-center">
            لا حاجة لبريد إلكتروني أو كلمة مرور — فقط رمز الجلسة الذي يولّده رئيس الحكام.
          </p>
        </div>
      </div>
    </div>
  );
}
