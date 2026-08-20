import { useState, useEffect, useMemo } from "react";
import { useCompetition, STYLE_CONFIGS } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";
import { FederationLogo } from "./FederationLogo";
import { Slider } from "@/components/ui/slider";
import { submitJudgeScore } from "@/lib/scoreSubmit";
import { useMatchSync } from "@/hooks/useMatchSync";
import { useScoringGate } from "@/hooks/useScoringGate";
import { useJudgeStatus } from "@/hooks/useJudgeStatus";
import { effectiveMaxB, type MatchMode } from "@/lib/matchMode";
import { toast } from "sonner";
import { ArrowRight, Minus, Plus, Send, AlertTriangle, RotateCcw, CheckCircle2, Delete } from "lucide-react";
import { SessionBadge } from "@/components/SessionBadge";
import { useActiveSessionCode } from "@/hooks/useActiveSession";
import { useRoomPresence } from "@/hooks/useRoomPresence";


/** Official Group B performance tiers (out of 3.00). */
function tierFor(score: number) {
  if (score >= 2.51) return { ar: "ممتاز", en: "Superior", cls: "text-green-400", ring: "border-green-400/50", glow: "shadow-[0_0_45px_hsl(140_80%_50%/0.45)]", bar: "bg-green-400" };
  if (score >= 1.91) return { ar: "متوسط", en: "Average", cls: "text-gold", ring: "border-gold/50", glow: "shadow-[0_0_45px_hsl(45_90%_55%/0.45)]", bar: "bg-gold" };
  if (score >= 1.01) return { ar: "أدنى", en: "Inferior", cls: "text-orange-400", ring: "border-orange-400/50", glow: "shadow-[0_0_45px_hsl(25_90%_55%/0.45)]", bar: "bg-orange-400" };
  return { ar: "غير مقبول", en: "Below Range", cls: "text-fed-red", ring: "border-fed-red/50", glow: "shadow-[0_0_45px_hsl(0_85%_55%/0.45)]", bar: "bg-fed-red" };
}

const TIERS = [
  { ar: "ممتاز", en: "Superior", range: "2.51 – 3.00", cls: "text-green-400", border: "border-green-400/50 bg-green-400/10", min: 2.51 },
  { ar: "متوسط", en: "Average", range: "1.91 – 2.50", cls: "text-gold", border: "border-gold/50 bg-gold/10", min: 1.91 },
  { ar: "أدنى", en: "Inferior", range: "1.01 – 1.90", cls: "text-orange-400", border: "border-orange-400/50 bg-orange-400/10", min: 1.01 },
];

export function JudgeBPanel() {
  const {
    competitionStyle,
    judgeBScores,
    setJudgeBScore,
    resetJudgeBScores,
    setSelectedRole,
    judgeAScore,
    judgeCScore,
    finalScore,
    athletes,
    currentAthleteIndex,
    sessionCode,
    judgeId,
  } = useCompetition();
  const logout = useLogout();


  const config = competitionStyle ? STYLE_CONFIGS[competitionStyle] : STYLE_CONFIGS.changquan;
  const myIndex = 0;
  const score = judgeBScores[myIndex] ?? 0;

  const activeSession = useActiveSessionCode(sessionCode);
  useRoomPresence(activeSession, { role: "B", slot: judgeId });
  const sync = useMatchSync(sessionCode);
  // Timer + hard lock mirrored from the Technical Assistant.
  const { locked, timerSec: timerElapsed, timerRunning } = useScoringGate(sync);
  const liveMode: MatchMode = ((sync.payload as Record<string, unknown> | null)?.match_mode as MatchMode | undefined) ?? "optional";
  const isCompulsory = liveMode === "compulsory";
  // Official cap: Group B is ALWAYS 3.00 in both modes.
  const max = effectiveMaxB(liveMode, config.maxB);

  const [submitted, setSubmitted] = useState(false);
  const [entry, setEntry] = useState<string | null>(null); // numpad buffer

  const currentAthlete = athletes[currentAthleteIndex];
  useJudgeStatus(sessionCode, judgeId, submitted ? "sent" : "judging", currentAthlete?.id ?? null);
  const tier = useMemo(() => tierFor(score), [score]);

  useEffect(() => {
    if (submitted) setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const adjust = (delta: number) => {
    if (locked) { toast.error("التقييم مقفل — انتظر فتح الحكم الرئيسي"); return; }
    setEntry(null);
    const next = Math.max(0, Math.min(max, +(score + delta).toFixed(2)));
    setJudgeBScore(myIndex, next);
  };

  // ---- Numpad -------------------------------------------------------------
  const pressKey = (k: string) => {
    if (locked) { toast.error("التقييم مقفل"); return; }
    setEntry((prev) => {
      const cur = prev ?? "";
      if (k === "." && cur.includes(".")) return cur;
      if (k === "." && cur === "") return "0.";
      const next = cur + k;
      // limit: X.XX
      if (/^\d\.\d{0,2}$|^\d$/.test(next)) return next;
      return cur;
    });
  };

  const backspace = () => setEntry((p) => (p && p.length > 1 ? p.slice(0, -1) : null));

  const applyEntry = () => {
    if (locked) { toast.error("التقييم مقفل"); return; }
    if (!entry) return;
    const v = parseFloat(entry);
    if (Number.isNaN(v)) { setEntry(null); return; }
    if (v > max) { toast.error(`الحد الأقصى للمجموعة B هو ${max.toFixed(2)}`); return; }
    setJudgeBScore(myIndex, +v.toFixed(2));
    setEntry(null);
  };

  const handleReset = () => {
    setEntry(null);
    resetJudgeBScores();
  };

  const handleSubmit = async () => {
    if (locked) { toast.error("التقييم مقفل — لا يمكن الإرسال"); return; }
    if (entry) { applyEntry(); return; }
    if (!timerRunning && timerElapsed === 0) {
      toast.error("لا يمكن الإرسال قبل بدء المؤقت من الحكم الرئيسي");
      return;
    }
    const code = sessionCode ?? activeSession;
    if (!code) { toast.error("كود الجلسة غير متوفر — أعد الدخول بالرمز"); return; }
    if (code && judgeId) {
      const res = await submitJudgeScore({
        sessionCode: code, judgeSlot: judgeId, judgeRole: "B",
        athleteId: currentAthlete?.id ?? null, score,
        payload: { mode: liveMode },
      });
      if (!res.ok) { toast.error(`فشل الإرسال: ${res.error ?? "خطأ"}`); return; }
      toast.success("تم إرسال نتيجة Group B للحكم الرئيسي");
    }
    setSubmitted(true);
  };

  const mins = Math.floor(timerElapsed / 60).toString().padStart(2, "0");
  const secs = Math.floor(timerElapsed % 60).toString().padStart(2, "0");
  const display = entry !== null ? entry : score.toFixed(2);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedRole(null)} className="h-8 w-8 rounded-lg bg-navy-light flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="h-4 w-4" />
            </button>
            <FederationLogo size="sm" />
            <span className="text-sm font-heading font-bold px-3 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold" dir="ltr">
              JUDGE B · Overall Performance · {max.toFixed(2)}
            </span>
            <SessionBadge code={sessionCode} />
          </div>

          <div className="flex items-center gap-3">
            {currentAthlete && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground font-body leading-none">الرياضي</p>
                <p className="text-sm font-heading font-bold text-foreground leading-tight">{currentAthlete.name}</p>
              </div>
            )}
            <div className="text-center px-3 py-1 rounded-lg border border-fed-blue/30 bg-fed-blue/5">
              <p className="text-[10px] text-muted-foreground font-body leading-none">الوقت</p>
              <p className="text-base font-heading font-black tabular-nums text-fed-blue leading-tight" dir="ltr">{mins}:{secs}</p>
            </div>
            <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground font-body">خروج</button>
          </div>
        </div>
      </header>

      {locked && (
        <div className="px-3 pt-2 shrink-0">
          <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-center text-xs font-heading font-black text-amber-300" dir="rtl">
            🔒 التقييم مقفل — في انتظار فتح الحكم الرئيسي / Scoring Locked
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 p-3 min-h-0 overflow-auto">
        {/* MAIN COLUMN */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Mode badge (read-only, set by TA) */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <span className="px-4 py-1.5 rounded-lg font-heading font-bold text-xs border border-border bg-card text-muted-foreground">
              {isCompulsory ? "Compulsory · إلزامي (A 7.00 · B 3.00)" : "Optional · اختياري (A 5.00 · B 3.00 · C 2.00)"}
            </span>
          </div>

          {/* GIANT SCORE DISPLAY */}
          <div className={`rounded-2xl border-2 bg-gradient-to-b from-white/[0.03] to-transparent p-4 text-center transition-all ${tier.ring} ${tier.glow}`}>
            <p className="text-[11px] text-muted-foreground font-body uppercase tracking-[0.3em]" dir="ltr">
              {entry !== null ? "ENTERING…" : "CURRENT B SCORE"} · / {max.toFixed(2)}
            </p>
            <p className={`text-[7rem] leading-[1] font-heading font-black tabular-nums my-1 ${entry !== null ? "text-foreground" : tier.cls}`}>
              {display}
            </p>
            <p className={`text-lg font-heading font-black tracking-wide ${tier.cls}`} dir="ltr">
              {tier.en} · <span dir="rtl">{tier.ar}</span>
            </p>
            {/* progress bar */}
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${tier.bar}`} style={{ width: `${Math.min(100, (score / max) * 100)}%` }} />
            </div>
          </div>

          {/* Slider + quick adjust */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button disabled={locked} onClick={() => adjust(-0.05)} className="disabled:opacity-30 disabled:pointer-events-none h-14 w-14 rounded-xl bg-fed-red/15 border border-fed-red/40 text-fed-red hover:bg-fed-red/25 active:scale-95 transition-all flex items-center justify-center" aria-label="decrease 0.05">
                <Minus className="h-6 w-6" />
              </button>

              <div className="flex-1 px-2">
                <Slider
                  value={[score]}
                  min={0}
                  max={max}
                  step={0.05}
                  disabled={locked}
                  onValueChange={(v) => { if (locked) return; setEntry(null); setJudgeBScore(myIndex, +v[0].toFixed(2)); }}
                  className="[&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-2 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-gold [&_[role=slider]]:shadow-[0_0_15px_hsl(45_90%_55%/0.7)] [&>span:first-child>span]:bg-gold"
                />
                <div className="flex justify-between text-[10px] font-body mt-2" dir="ltr">
                  <span className="text-fed-red">0.00</span>
                  <span className="text-orange-400">1.01</span>
                  <span className="text-gold">1.91</span>
                  <span className="text-green-400">2.51</span>
                  <span className="text-green-400">{max.toFixed(2)}</span>
                </div>
              </div>

              <button disabled={locked} onClick={() => adjust(0.05)} className="disabled:opacity-30 disabled:pointer-events-none h-14 w-14 rounded-xl bg-green-500/15 border border-green-500/40 text-green-400 hover:bg-green-500/25 active:scale-95 transition-all flex items-center justify-center" aria-label="increase 0.05">
                <Plus className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[-0.1, -0.05, 0.05, 0.1].map((d) => (
                <button
                  key={d}
                  onClick={() => adjust(d)}
                  disabled={locked}
                  className={`disabled:opacity-30 disabled:pointer-events-none h-12 rounded-xl border font-heading font-black text-base active:scale-95 transition-all ${
                    d < 0
                      ? "border-fed-red/40 bg-fed-red/10 text-fed-red hover:bg-fed-red/20"
                      : "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  }`}
                  dir="ltr"
                >
                  {d > 0 ? "+" : "−"}{Math.abs(d).toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Footer summary + actions */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className={`flex-1 grid ${isCompulsory ? "grid-cols-3" : "grid-cols-4"} gap-2 text-center min-w-[260px]`}>
              <div className="rounded-lg p-2 border border-fed-red/30 bg-fed-red/5">
                <p className="text-[9px] text-muted-foreground font-body">Group A</p>
                <p className="text-sm font-heading font-black text-fed-red">{judgeAScore.toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-2 border border-gold/40 bg-gold/10">
                <p className="text-[9px] text-muted-foreground font-body">Group B</p>
                <p className="text-sm font-heading font-black text-gold">{score.toFixed(2)}</p>
              </div>
              {!isCompulsory && (
                <div className="rounded-lg p-2 border border-fed-blue/30 bg-fed-blue/5">
                  <p className="text-[9px] text-muted-foreground font-body">Group C</p>
                  <p className="text-sm font-heading font-black text-fed-blue">{judgeCScore.toFixed(2)}</p>
                </div>
              )}
              <div className="rounded-lg p-2 border border-gold/40 bg-gold/10">
                <p className="text-[9px] text-muted-foreground font-body">Total</p>
                <p className="text-sm font-heading font-black text-gold">{finalScore.toFixed(2)}</p>
              </div>
            </div>

            <button onClick={handleReset} className="h-12 px-4 rounded-xl border border-border bg-card flex items-center gap-2 text-sm font-heading font-bold text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" /> إعادة ضبط
            </button>

            <button
              onClick={handleSubmit}
              disabled={locked || submitted}
              className={`h-12 px-6 rounded-xl flex items-center gap-2 font-heading font-black text-sm transition-all ${
                submitted
                  ? "bg-green-500/20 text-green-400 border border-green-500/40"
                  : "bg-gradient-to-r from-gold to-amber-400 text-navy border border-gold/60 shadow-[0_0_25px_hsl(45_90%_55%/0.45)] hover:brightness-110 active:scale-95"
              }`}
            >
              {submitted ? <><CheckCircle2 className="h-4 w-4" /> تم الإرسال</> : <><Send className="h-4 w-4" /> تأكيد وإرسال النتيجة</>}
            </button>
          </div>
        </div>

        {/* SIDEBAR — NUMPAD + tiers */}
        <aside className="flex flex-col gap-3 min-h-0">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider mb-2 text-center" dir="ltr">Direct Entry · إدخال مباشر</p>
            <div className="rounded-lg border border-gold/30 bg-gold/5 py-2 mb-2 text-center">
              <span className="text-3xl font-heading font-black tabular-nums text-gold" dir="ltr">{entry ?? "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9",".","0"].map((k) => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  disabled={locked}
                  className="disabled:opacity-30 disabled:pointer-events-none h-14 rounded-xl border border-border bg-navy-light text-2xl font-heading font-black text-foreground hover:border-gold/50 hover:text-gold active:scale-95 transition-all"
                >
                  {k}
                </button>
              ))}
              <button onClick={backspace} className="h-14 rounded-xl border border-fed-red/40 bg-fed-red/10 text-fed-red flex items-center justify-center active:scale-95" aria-label="backspace">
                <Delete className="h-6 w-6" />
              </button>
            </div>
            <button
              onClick={applyEntry}
              disabled={locked || !entry}
              className="mt-2 w-full h-12 rounded-xl font-heading font-black text-sm bg-gold/20 border border-gold/50 text-gold disabled:opacity-40 active:scale-95 transition-all"
            >
              تثبيت الدرجة · SET
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider mb-2" dir="ltr">Performance Levels</p>
            <ul className="space-y-2">
              {TIERS.map((t) => {
                const active = tier.en === t.en;
                return (
                  <li key={t.en} className={`rounded-lg border px-3 py-2 flex items-center justify-between transition-all ${active ? t.border : "border-border bg-transparent opacity-60"}`}>
                    <span className={`font-heading font-bold text-sm ${t.cls}`} dir="ltr">{t.en} · <span dir="rtl">{t.ar}</span></span>
                    <span className={`text-xs font-heading font-black tabular-nums ${t.cls}`} dir="ltr">{t.range}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {!submitted && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-body justify-center">
              <AlertTriangle className="h-3 w-3" />
              <span>تحقّق قبل الإرسال · Double-check before submit</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
