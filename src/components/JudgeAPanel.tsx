import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCompetition, STYLE_CONFIGS } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";
import { submitJudgeScore } from "@/lib/scoreSubmit";
import { toast } from "sonner";
import { ArrowRight, Send, Undo2, Wifi, WifiOff, CheckCircle2, RotateCcw } from "lucide-react";
import { useMatchSync } from "@/hooks/useMatchSync";
import { useScoringGate } from "@/hooks/useScoringGate";
import { useJudgeStatus } from "@/hooks/useJudgeStatus";
import { modeCaps, type MatchMode } from "@/lib/matchMode";

/* Official Group A code catalogue lives in @/lib/deductionCodes */
import { type CodeEntry } from "@/lib/deductionCodes";
import { enabledKeysForStyle, rulesForKey, type GroupARule } from "@/config/groupARulesEngine";
import { GroupAKeypad } from "@/components/GroupAKeypad";
import { styleShort, styleLabelAr } from "@/lib/styleNames";
import { SessionBadge } from "@/components/SessionBadge";
import { useActiveSessionCode } from "@/hooks/useActiveSession";
import { useRoomPresence } from "@/hooks/useRoomPresence";



const toEntry = (r: GroupARule): CodeEntry => ({
  code: r.errorCode,
  label: r.englishDescription,
  labelAr: r.arabicDescription,
  value: r.deductionValue,
});



function haptic(ms: number | number[] = 25) {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean })?.vibrate?.(ms); } catch { /* noop */ }
}
function fmtTime(total: number) {
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function JudgeAPanel() {
  const {
    competitionStyle, setSelectedRole,
    judgeAScore, addJudgeADeduction, resetJudgeADeductions,
    athletes, currentAthleteIndex,
    sessionCode, judgeId,
  } = useCompetition();
  const logout = useLogout();


  const activeSession = useActiveSessionCode(sessionCode);
  useRoomPresence(activeSession, { role: "A", slot: judgeId });

  const aSync = useMatchSync(sessionCode);
  // Timer + hard lock are mirrored from the Technical Assistant (single source of truth).
  const { locked, timerSec: timerElapsed, timerRunning } = useScoringGate(aSync);
  // Live style broadcast by the Technical Assistant wins over the local pick.

  const liveStyle = (aSync.style ?? competitionStyle) as string | null;
  const config = liveStyle && STYLE_CONFIGS[liveStyle] ? STYLE_CONFIGS[liveStyle] : STYLE_CONFIGS.changquan;
  const liveMode: MatchMode = ((aSync.payload as Record<string, unknown> | null)?.match_mode as MatchMode | undefined) ?? "optional";
  const maxA = modeCaps(liveMode).maxA;
  const performanceTime = config.performanceTime;
  const timeUp = timerElapsed >= performanceTime;
  const currentAthlete = athletes[currentAthleteIndex] || null;
  const remaining = Math.max(0, performanceTime - timerElapsed);

  const [confirmed, setConfirmed] = useState<CodeEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Report presence/state to the Chief's judge matrix (Judging → Sent).
  useJudgeStatus(sessionCode, judgeId, submitted ? "sent" : "judging", null);


  // Style-aware rules engine: keys 0–7 always render, availability is style-driven.
  const decades = useMemo(() => enabledKeysForStyle(liveStyle), [liveStyle]);

  const [decade, setDecade] = useState<string>(decades[0] ?? "0");
  useEffect(() => {
    if (!decades.includes(decade)) setDecade(decades[0] ?? "0");
  }, [decades, decade]);

  const subRules = useMemo(() => rulesForKey(liveStyle, decade), [liveStyle, decade]);


  useEffect(() => {
    const u = () => setOnline(navigator.onLine);
    u(); window.addEventListener("online", u); window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);

  useEffect(() => { setConfirmed([]); setSubmitted(false); }, [currentAthlete?.id]);

  // Notify the judge whenever the TA changes the match mode or the style live.
  const lastCfgRef = useRef<string>("");
  useEffect(() => {
    const sig = `${liveMode}|${liveStyle ?? "-"}`;
    if (lastCfgRef.current === "" ) { lastCfgRef.current = sig; return; }
    if (lastCfgRef.current === sig) return;
    lastCfgRef.current = sig;
    toast.info(
      `تحديث من المساعد التقني: ${liveMode === "compulsory" ? "إجبارية" : "اختيارية"} · ${styleLabelAr(liveStyle)} — الدرجة من ${modeCaps(liveMode).maxA.toFixed(2)}`,
    );
  }, [liveMode, liveStyle]);


  const addCode = useCallback((c: CodeEntry) => {
    if (locked) { toast.error("التقييم مقفل — انتظر فتح الحكم الرئيسي"); return; }
    haptic([28, 18, 28]);
    setConfirmed(prev => [...prev, c]);
  }, [locked]);

  const undoLast = useCallback(() => {
    haptic(20);
    setConfirmed(prev => prev.slice(0, -1));
  }, []);

  const removeAt = useCallback((idx: number) => {
    haptic(15);
    setConfirmed(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const totalDeduction = useMemo(() => confirmed.reduce((s, c) => s + c.value, 0), [confirmed]);
  const projectedScore = Math.max(0, maxA - totalDeduction);

  const canSend = !locked && ((!timerRunning && timerElapsed > 0) || timeUp);

  const handleSend = useCallback(async () => {
    if (locked) { toast.error("التقييم مقفل — لا يمكن الإرسال"); return; }
    if (!canSend) { toast.error("الإرسال غير متاح — انتظر إيقاف المؤقت"); return; }
    // Zero deductions is a valid perfect score (5.00 / 7.00) — never block it.
    haptic([60, 40, 60]);

    confirmed.forEach(c => addJudgeADeduction({ code: c.code, value: c.value, label: c.label }));

    const code = sessionCode ?? activeSession;
    if (!code) { toast.error("كود الجلسة غير متوفر — أعد الدخول بالرمز"); return; }
    if (code && judgeId) {
      const res = await submitJudgeScore({
        sessionCode: code, judgeSlot: judgeId, judgeRole: "A",
        athleteId: currentAthlete?.id ?? null,
        score: projectedScore,
        payload: {
          codes: confirmed.map(c => c.code),
          deductions: confirmed.map(c => ({ code: c.code, value: c.value, label: c.label, timeSec: timerElapsed })),
        },
      });
      if (!res.ok) { toast.error(`فشل الإرسال: ${res.error ?? "خطأ"}`); return; }
      toast.success("تم إرسال النتيجة للحكم الرئيسي");
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2200);
  }, [locked, canSend, confirmed, sessionCode, activeSession, judgeId, currentAthlete, projectedScore, timerElapsed, addJudgeADeduction]);


  const resetAll = useCallback(() => {
    haptic([20, 40, 20]);
    setConfirmed([]); resetJudgeADeductions();
  }, [resetJudgeADeductions]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col text-white" style={{ background: "#000" }}>
      {/* Slim Header */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-white/10 shrink-0 bg-black/80 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => setSelectedRole(null)} className="h-7 w-7 shrink-0 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <span className="shrink-0 text-[10px] font-black tracking-[0.25em] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300" dir="ltr">
            JUDGE A · QUALITY
          </span>
          <SessionBadge code={sessionCode} />

          <span
            className={`shrink-0 text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full border ${
              liveMode === "compulsory"
                ? "border-green-400/50 bg-green-400/10 text-green-300"
                : "border-orange-400/50 bg-orange-400/10 text-orange-300"
            }`}
            dir="ltr"
            title="النمط والأسلوب المبثوثان من المساعد التقني"
          >
            {liveMode === "compulsory" ? "COMP 7.00" : "OPT 5.00"} · {styleShort(liveStyle)}
          </span>

          <span className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${online ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {currentAthlete && (
            <span className="text-[11px] text-white/80 font-bold truncate max-w-[140px]">{currentAthlete.name}</span>
          )}
          {/* Authoritative match clock (mirrors TA / Chief / Judges B & C): elapsed, with remaining as a hint. */}
          <span className={`tabular-nums text-sm font-black ${timeUp ? "text-red-400 animate-pulse" : timerRunning ? "text-emerald-300" : "text-white/60"}`} dir="ltr">
            {fmtTime(timerElapsed)}
            <span className="ml-1 text-[10px] font-bold text-white/35">/ {fmtTime(remaining)}</span>
          </span>
          <button onClick={logout} className="text-[10px] text-white/40 hover:text-white">خروج</button>
        </div>
      </header>

      {locked && (
        <div className="px-3 pt-2 shrink-0">
          <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-center text-[12px] font-black text-amber-200" dir="rtl">
            🔒 التقييم مقفل — في انتظار فتح الحكم الرئيسي / Scoring Locked
          </div>
        </div>
      )}

      {/* HUD — total deduction + projected + sent */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl px-4 py-3 grid grid-cols-3 items-center gap-3"
             style={{ boxShadow: "inset 0 0 30px rgba(255,255,255,0.03)" }}>
          <div className="text-left min-w-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40" dir="ltr">Projected / {maxA.toFixed(2)}</p>
            <p className="text-3xl font-black tabular-nums leading-none mt-0.5" style={{ textShadow: "0 0 18px rgba(255,255,255,0.45)" }} dir="ltr">
              {projectedScore.toFixed(2)}
            </p>
          </div>

          <div className="text-center min-w-0">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/40" dir="ltr">Total Deduction</p>
            <p
              className="font-black tabular-nums leading-none select-none"
              style={{
                fontSize: "clamp(40px, 8vw, 78px)",
                color: totalDeduction > 0 ? "#f87171" : "rgba(255,255,255,0.2)",
                textShadow: totalDeduction > 0 ? "0 0 26px rgba(248,113,113,0.6)" : "none",
              }}
              dir="ltr"
            >
              −{totalDeduction.toFixed(2)}
            </p>
            <p className="text-[10px] text-white/40 font-bold tabular-nums" dir="ltr">{confirmed.length} codes</p>
          </div>

          <div className="text-right min-w-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40" dir="ltr">Sent A</p>
            <p className="text-2xl font-black tabular-nums text-white/70" dir="ltr">{judgeAScore.toFixed(2)}</p>
            {submitted && (
              <p className="text-[10px] text-emerald-300 font-bold flex items-center gap-1 justify-end mt-1">
                <CheckCircle2 className="h-3 w-3" /> SENT
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Deduction log */}
      <div className="px-3 pt-2 shrink-0">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 min-h-[46px] flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-white/40 px-1" dir="ltr">LOG</span>
          {confirmed.length === 0 ? (
            <span className="text-[11px] text-white/30 px-2" dir="rtl">لا توجد خصومات مسجلة — اختر الفئة ثم الكود</span>
          ) : confirmed.map((c, i) => (
            <button
              key={`${c.code}-${i}`}
              onClick={() => removeAt(i)}
              className="shrink-0 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-[11px] font-black tabular-nums hover:bg-red-500/30 transition"
              title="حذف"
              dir="ltr"
            >
              {c.code} · −{c.value.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* Group A keypad — restricted to 0–7 */}
      <div className="px-3 pt-2 shrink-0">
        <GroupAKeypad
          disabled={locked}
          availableDecades={decades}
          activeDecade={decade}
          onSelect={(d) => setDecade(d)}
        />
      </div>

      {/* Sub-code grid for the selected decade */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {subRules.map(r => (
            <button
              key={r.errorCode}
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addCode(toEntry(r)); }}
              disabled={locked}
              className="rounded-2xl border border-white/10 bg-black/60 p-3 text-right active:scale-[0.97] transition-all hover:border-emerald-500/50 disabled:opacity-30 disabled:pointer-events-none"
              style={{ backdropFilter: "blur(14px)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl font-black tabular-nums" dir="ltr">{r.errorCode}</span>
                <span className="text-lg font-black tabular-nums text-red-400" dir="ltr">−{r.deductionValue.toFixed(2)}</span>
              </div>
              <p className="text-[11px] font-bold text-emerald-300/80 truncate" dir="ltr">{r.pinyin}</p>
              <p className="mt-1 text-[12px] font-bold text-white/85 truncate" dir="rtl">{r.arabicDescription}</p>
              <p className="text-[11px] text-white/50 truncate" dir="ltr">{r.englishDescription}</p>
            </button>
          ))}
          {subRules.length === 0 && (
            <p className="text-[12px] text-white/40 col-span-full text-center py-6" dir="rtl">لا توجد أكواد في هذه الفئة لهذا الأسلوب</p>
          )}
        </div>
      </main>




      {/* Action row */}
      <div className="px-3 pb-3 shrink-0 grid grid-cols-[1fr_auto_auto] gap-2">
        <button
          onClick={undoLast}
          disabled={locked || confirmed.length === 0}
          className="h-14 rounded-xl font-black text-sm flex items-center justify-center gap-2 border border-amber-400/50 bg-amber-400/10 text-amber-200 active:scale-95 transition-all disabled:opacity-25"
        >
          <Undo2 className="h-5 w-5" /> تراجع عن آخر خصم
        </button>
        <button
          onClick={resetAll}
          className="h-14 px-4 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-white text-xs font-bold flex items-center gap-2"
          title="Reset all"
        >
          <RotateCcw className="h-4 w-4" /> RESET
        </button>
        <button
          onClick={handleSend}
          disabled={!canSend || submitted}
          className="h-14 px-6 rounded-xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-25"
          style={{
            background: canSend ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.04)",
            color: canSend ? "#fff" : "rgba(255,255,255,0.4)",
            border: canSend ? "1px solid rgba(16,185,129,0.6)" : "1px solid rgba(255,255,255,0.1)",
            boxShadow: canSend ? "0 0 30px rgba(16,185,129,0.55)" : "none",
          }}
          title={canSend ? "Send to Chief" : "Wait until timer stops"}
        >
          <Send className="h-4 w-4" /> SEND
        </button>
      </div>
      {!canSend && (
        <p className="text-[10px] text-amber-300/80 text-center pb-2 shrink-0" dir="rtl">
          الإرسال متاح فقط عند توقف المؤقت أو انتهاء الوقت
        </p>
      )}
    </div>
  );
}
