import { useCompetition, STYLE_CONFIGS, type DifficultyMovement } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";
import { FederationLogo } from "./FederationLogo";
import { ArrowRight, RotateCcw, Send, Check, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { submitJudgeScore } from "@/lib/scoreSubmit";
import { useMatchSync } from "@/hooks/useMatchSync";
import { toast } from "sonner";
import { QUICK_CODES, CONNECTION_BONUSES, MAX_C_MOVEMENT, MAX_C_CONNECTION, lookupCode, isConnectionCode, lookupConnection, type ConnectionBonus } from "@/lib/difficultyCodes";


const DEFAULT_SHEET: DifficultyMovement[] = [
  { code: "323A", label: "Tornado 360°", connection: "Independent", value: 0.2 },
  { code: "323B", label: "Tornado 540°", connection: "A+B", value: 0.3 },
  { code: "323C", label: "Tornado 720°", connection: "A+B+C", value: 0.4 },
  { code: "324A", label: "Double Aerial Kick", connection: "Independent", value: 0.2 },
  { code: "324B", label: "Triple Aerial Kick", connection: "A+B", value: 0.3 },
  { code: "333A", label: "Sweep + Spin", connection: "A+B", value: 0.2 },
  { code: "333B", label: "Sweep + Jump", connection: "A+B+C", value: 0.3 },
  { code: "312A", label: "Split Leap", connection: "Independent", value: 0.2 },
  { code: "353A", label: "Aerial 360°", connection: "Independent", value: 0.3 },
  { code: "353B", label: "Double Aerial Spin", connection: "A+B", value: 0.4 },
];

export function JudgeCPanel() {
  const {
    competitionStyle, setSelectedRole, logout,
    judgeCAttempts, judgeCScore, addJudgeCAttempt, toggleJudgeCAttempt, resetJudgeCAttempts,
    finalScore, athletes, currentAthleteIndex, timerElapsed, timerRunning,
    sessionCode, judgeId,
  } = useCompetition();
  const [sending, setSending] = useState(false);

  // Silent realtime subscription to current_match — recovers state on reconnect.
  const sync = useMatchSync(sessionCode);
  const matchMode = (sync.payload?.match_mode as "compulsory" | "optional" | undefined) ?? "optional";
  const liveStyle = (sync.style ?? competitionStyle) as keyof typeof STYLE_CONFIGS | null;

  const config = liveStyle ? STYLE_CONFIGS[liveStyle] : STYLE_CONFIGS.changquan;
  const athlete = athletes[currentAthleteIndex];
  const [extraMovements, setExtraMovements] = useState<DifficultyMovement[]>([]);
  const fullSheet: DifficultyMovement[] = useMemo(() => {
    const base = athlete?.difficultySheet?.length ? athlete.difficultySheet : DEFAULT_SHEET;
    const extra = extraMovements.filter(e => !base.some(b => b.code === e.code));
    return [...base, ...extra];
  }, [athlete, extraMovements]);

  // Combined codes coming from the Excel sheet (e.g. "323A+353B") are CONNECTIONS
  // and are judged separately from movement difficulty (0.60 ceiling).
  const sheet: DifficultyMovement[] = useMemo(
    () => fullSheet.filter(d => !isConnectionCode(d.code)),
    [fullSheet],
  );
  const sheetConnections: ConnectionBonus[] = useMemo(
    () => fullSheet.filter(d => isConnectionCode(d.code)).map(d => lookupConnection(d.code)),
    [fullSheet],
  );

  /** Connection buttons = athlete-sheet connections first, then the standard catalogue. */
  const connectionOptions: { bonus: ConnectionBonus; fromSheet: boolean }[] = useMemo(() => [
    ...sheetConnections.map(b => ({ bonus: b, fromSheet: true })),
    ...CONNECTION_BONUSES
      .filter(b => !sheetConnections.some(s2 => s2.code === b.code))
      .map(b => ({ bonus: b, fromSheet: false })),
  ], [sheetConnections]);



  // Notify Judge C when a NEW difficulty sheet arrives from the TA
  const lastSheetSigRef = useRef<string>("");
  useEffect(() => {
    if (!athlete?.difficultySheet?.length) return;
    const sig = `${athlete.id}:${athlete.difficultySheet.map(d => d.code).join(",")}`;
    if (sig === lastSheetSigRef.current) return;
    const isFirst = lastSheetSigRef.current === "";
    lastSheetSigRef.current = sig;
    toast.success(`📋 استمارة الصعوبة ${isFirst ? "محمّلة" : "وصلت"} — ${athlete.difficultySheet.length} حركة`, {
      description: `${athlete.name ?? ""} · ${athlete.difficultySheet.map(d => d.code).join(" · ")}`,
      duration: 6000,
    });
  }, [athlete?.id, athlete?.difficultySheet, athlete?.name]);

  const handleSubmit = async () => {
    if (!timerRunning && timerElapsed === 0) {
      toast.error("لا يمكن الإرسال قبل بدء المؤقت من الحكم الرئيسي");
      return;
    }
    if (!sessionCode || !judgeId) { toast.error("لا توجد جلسة"); return; }
    setSending(true);
    const res = await submitJudgeScore({
      sessionCode, judgeSlot: judgeId, judgeRole: "C",
      athleteId: athlete?.id ?? null, score: judgeCScore,
      payload: { attempts: judgeCAttempts },
    });
    setSending(false);
    if (!res.ok) toast.error(`فشل الإرسال: ${res.error ?? "خطأ"}`);
    else toast.success("تم إرسال نتيجة Group C");
  };


  const judgedCodes = useMemo(() => new Set(judgeCAttempts.map(a => a.code)), [judgeCAttempts]);
  const firstUnjudgedIndex = useMemo(
    () => sheet.findIndex(d => !judgedCodes.has(d.code)),
    [sheet, judgedCodes]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  useEffect(() => {
    setActiveIndex(firstUnjudgedIndex >= 0 ? firstUnjudgedIndex : sheet.length - 1);
  }, [firstUnjudgedIndex, sheet.length]);

  // Auto-center the active card horizontally inside the track WITHOUT touching
  // any vertical scroll. Using scrollIntoView() previously caused the whole page
  // to "jump" after the first Yes/No because the browser would scroll the nearest
  // vertical ancestor as well. We now scroll only the track's scrollLeft.
  const trackRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    const card = activeCardRef.current;
    if (!track || !card) return;
    const target = card.offsetLeft - (track.clientWidth / 2) + (card.clientWidth / 2);
    track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex]);

  const current = sheet[activeIndex];
  const allJudged = firstUnjudgedIndex < 0;

  const advance = () => {
    const next = sheet.findIndex((d, i) => i > activeIndex && !judgedCodes.has(d.code));
    if (next >= 0) setActiveIndex(next);
  };

  const handleYes = () => {
    if (!current || judgedCodes.has(current.code)) return;
    addJudgeCAttempt({ code: current.code, label: current.label, value: current.value, successful: true });
    advance();
  };
  const handleNo = () => {
    if (!current || judgedCodes.has(current.code)) return;
    addJudgeCAttempt({ code: current.code, label: current.label, value: current.value, successful: false });
    advance();
  };

  // ── Quick international code tags + connection bonuses (Group C = 1.40 + 0.60) ──
  const movementTotal = useMemo(
    () => judgeCAttempts.filter(a => a.successful && a.kind !== "connection").reduce((s, a) => s + a.value, 0),
    [judgeCAttempts],
  );
  const connectionTotal = useMemo(
    () => judgeCAttempts.filter(a => a.successful && a.kind === "connection").reduce((s, a) => s + a.value, 0),
    [judgeCAttempts],
  );

  const attemptIndex = (code: string) => judgeCAttempts.findIndex(a => a.code === code);

  const tapQuickCode = (code: string) => {
    const idx = attemptIndex(code);
    if (idx >= 0) { toggleJudgeCAttempt(idx); return; }
    const meta = lookupCode(code);
    addJudgeCAttempt({ code: meta.code, label: meta.label, value: meta.value, successful: true, kind: "movement" });
  };

  /** Confirm / Unconfirm a specific movement of the athlete's sheet. */
  const validateMovement = (d: DifficultyMovement, ok: boolean) => {
    const idx = attemptIndex(d.code);
    if (idx >= 0) {
      const cur = judgeCAttempts[idx];
      if (cur.successful !== ok) toggleJudgeCAttempt(idx);
      return;
    }
    addJudgeCAttempt({ code: d.code, label: d.label, value: d.value, successful: ok, kind: "movement" });
  };

  /** Manual entry: add an extra / changed difficulty code during performance. */
  const [manualCode, setManualCode] = useState("");
  const addManualCode = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    const meta = lookupCode(code);
    setExtraMovements(prev => prev.some(p => p.code === meta.code) ? prev : [...prev, meta]);
    setManualCode("");
    toast.success(`تمت إضافة الكود ${meta.code} · +${meta.value.toFixed(2)}`);
  };


  const tapConnection = (b: ConnectionBonus) => {
    const idx = attemptIndex(b.code);
    if (idx >= 0) { toggleJudgeCAttempt(idx); return; }
    if (connectionTotal + b.value > MAX_C_CONNECTION + 1e-6) {
      toast.error(`سقف وضعيات الربط ${MAX_C_CONNECTION.toFixed(2)}`);
      return;
    }
    addJudgeCAttempt({ code: b.code, label: b.label, value: b.value, successful: true, kind: "connection" });
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // NOTE: Group C panel is ALWAYS visible/enabled — even in compulsory mode.
  // Field-test feedback: hiding the panel based on match_mode caused sync errors
  // when the TA toggled mode mid-event. The Chief is responsible for whether
  // C scores count toward the final aggregate.

  // Compulsory routines (إجبارية) do NOT include Group C — panel is disabled and
  // the score is forced to 0 until the TA switches back to Optional.
  if (matchMode === "compulsory") {
    return (
      <div className="h-screen cyber-bg flex flex-col overflow-hidden text-white" dir="rtl">
        <header className="border-b border-cyber-orange/25 bg-black/60 backdrop-blur px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSelectedRole(null)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
                <ArrowRight className="h-4 w-4" />
              </button>
              <FederationLogo size="sm" />
            </div>
            <span className="text-xs text-green-300 font-heading font-bold px-2.5 py-1 rounded-full border border-green-400/40 bg-green-400/10" dir="ltr">
              COMPULSORY · A 7 + B 3
            </span>
            <button onClick={logout} className="text-xs text-white/50 hover:text-white">خروج</button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="h-24 w-24 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center">
            <X className="h-10 w-10 text-white/30" />
          </div>
          <h2 className="text-2xl font-heading font-black text-white">نمط إجباري</h2>
          <p className="text-sm text-white/60 max-w-md font-body leading-relaxed">
            مجموعة الصعوبة (C) معطّلة في الأساليب الإلزامية.<br/>
            في انتظار تحويل المساعد التقني إلى النمط الاختياري.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 mt-2">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40" dir="ltr">Group C</p>
            <p className="text-3xl font-heading font-black text-white/80 tabular-nums" dir="ltr">0.00</p>
          </div>
        </main>
      </div>
    );
  }

  // Traditional styles do NOT use Group C — auto-zero and disable UI.
  if (liveStyle === "traditional") {
    if (judgeCAttempts.length > 0) {
      setTimeout(() => resetJudgeCAttempts(), 0);
    }
    return (
      <div className="h-screen cyber-bg flex flex-col overflow-hidden text-white" dir="rtl">
        <header className="border-b border-cyber-orange/25 bg-black/60 backdrop-blur px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSelectedRole(null)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
                <ArrowRight className="h-4 w-4" />
              </button>
              <FederationLogo size="sm" />
            </div>
            <span className="text-xs text-cyber-orange font-heading font-bold px-2.5 py-1 rounded-full border border-cyber-orange/40 bg-cyber-orange/10" dir="ltr">
              Judge C
            </span>
            <button onClick={logout} className="text-xs text-white/50 hover:text-white">خروج</button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="h-24 w-24 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center">
            <X className="h-10 w-10 text-white/30" />
          </div>
          <h2 className="text-2xl font-heading font-black text-white">أسلوب تقليدي</h2>
          <p className="text-sm text-white/60 max-w-md font-body leading-relaxed">
            مجموعة الصعوبة (C) معطّلة للأنماط التقليدية.<br/>
            النتيجة النهائية تُحتسب على أساس مجموعتي A و B فقط.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 mt-2">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40" dir="ltr">Group C</p>
            <p className="text-3xl font-heading font-black text-white/80 tabular-nums" dir="ltr">0.00</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen cyber-bg flex flex-col overflow-hidden text-white">
      {/* Top status bar — now also hosts score summary + SUBMIT (always visible) */}
      <header className="border-b border-cyber-orange/25 bg-black/70 backdrop-blur px-4 py-2 shrink-0 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSelectedRole(null)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </button>
            <FederationLogo size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold text-white truncate">{athlete?.name ?? "—"}</p>
              <p className="text-[10px] text-white/60 font-body truncate" dir="ltr">
                {athlete?.country ?? "—"} • {competitionStyle ?? "—"}
              </p>
            </div>
          </div>

          {/* Big orange performance timer */}
          <div className="text-center px-3 py-1 rounded-xl border border-cyber-orange/40 bg-black/40">
            <p className="text-[9px] uppercase tracking-widest text-cyber-orange font-heading" dir="ltr">Performance</p>
            <p className="text-2xl font-heading font-black text-cyber-orange tabular-nums leading-none" dir="ltr"
               style={{ textShadow: "0 0 18px oklch(0.70 0.22 45 / 0.7)" }}>
              {fmtTime(timerElapsed)}
            </p>
            <p className="text-[9px] text-white/50 font-body" dir="ltr">/ {fmtTime(config.performanceTime)}</p>
          </div>

          {/* Score summary — sticky in header so it's always visible */}
          <div className="flex items-center gap-2">
            <div className="rounded-lg px-2.5 py-1 border border-white/10 bg-white/5 text-center">
              <p className="text-[8px] text-white/50 font-body leading-none" dir="ltr">Judged</p>
              <p className="text-sm font-heading font-black text-white leading-tight">{judgeCAttempts.length}/{sheet.length}</p>
            </div>
            <div className="rounded-lg px-2.5 py-1 border border-cyber-orange/40 bg-cyber-orange/10 text-center">
              <p className="text-[8px] text-white/60 font-body leading-none" dir="ltr">Group C / 2.00</p>
              <p className="text-sm font-heading font-black text-cyber-orange leading-tight">{judgeCScore.toFixed(2)}</p>

            </div>
            <div className="rounded-lg px-2.5 py-1 border border-cyber-orange/60 bg-cyber-orange/15 text-center glow-cyber">
              <p className="text-[8px] text-white/60 font-body leading-none">المجموع</p>
              <p className="text-sm font-heading font-black text-cyber-orange leading-tight">{finalScore.toFixed(2)}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); void handleSubmit(); }}
              disabled={!allJudged || sending}
              type="button"
              className="h-11 px-4 rounded-xl flex items-center gap-2 font-heading font-black text-xs tracking-wider border-2 border-green-400/60 bg-gradient-to-b from-green-500/30 to-green-600/20 text-green-100 hover:from-green-500/40 hover:to-green-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: allJudged && !sending ? "0 8px 24px oklch(0.65 0.20 145 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.2)" : undefined }}
              title={!allJudged ? "قيّم جميع الحركات أولاً" : "إرسال للرئيس"}
            >
              <Send className="h-4 w-4" />
              {sending ? "..." : "SUBMIT · إرسال"}
            </button>
            <button onClick={resetJudgeCAttempts} className="h-11 w-11 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center text-white/60 hover:text-white" title="إعادة">
              <RotateCcw className="h-4 w-4" />
            </button>
            <span className="text-xs text-cyber-orange font-heading font-bold px-2.5 py-1 rounded-full border border-cyber-orange/40 bg-cyber-orange/10 glow-cyber" dir="ltr">
              Judge C
            </span>
            <button onClick={logout} className="text-xs text-white/50 hover:text-white">خروج</button>
          </div>
        </div>
      </header>

      {/* Main action zone — locked, no vertical scroll */}
      <main className="flex-1 flex flex-col items-center justify-between p-4 min-h-0 gap-3 overflow-hidden">
        {/* Current movement label */}
        <div className="text-center mt-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyber-orange font-heading mb-1" dir="ltr">Now Judging</p>
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.code}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <span className="text-3xl md:text-4xl font-heading font-black text-white" dir="ltr"
                        style={{ textShadow: "0 0 24px oklch(0.70 0.22 45 / 0.5)" }}>
                    {current.code}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg border border-cyber-orange/50 bg-cyber-orange/15 text-cyber-orange" dir="ltr">
                    +{current.value.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 text-white/80" dir="ltr">
                    {current.connection}
                  </span>
                </div>
                <p className="text-base text-white/80 font-body mt-1" dir="ltr">{current.label}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Giant 3D YES / NO — stays centered regardless of track scroll */}
        <div className="flex items-center justify-center gap-6 md:gap-10 w-full max-w-2xl">
          <motion.button
            whileTap={{ scale: 0.92 }}
            disabled={!current || allJudged || judgedCodes.has(current?.code ?? "")}
            onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); handleYes(); }}
            type="button"
            className="btn-3d-green flex-1 h-36 md:h-44 rounded-3xl flex flex-col items-center justify-center font-heading font-black disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: "0 14px 40px oklch(0.65 0.20 145 / 0.55), inset 0 2px 0 oklch(1 0 0 / 0.4), inset 0 -6px 12px oklch(0 0 0 / 0.35)" }}
          >
            <Check className="h-14 w-14 md:h-20 md:w-20" strokeWidth={3} />
            <span className="text-2xl md:text-3xl mt-1">YES</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            disabled={!current || allJudged || judgedCodes.has(current?.code ?? "")}
            onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); handleNo(); }}
            type="button"
            className="btn-3d-red flex-1 h-36 md:h-44 rounded-3xl flex flex-col items-center justify-center font-heading font-black disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: "0 14px 40px oklch(0.55 0.22 25 / 0.55), inset 0 2px 0 oklch(1 0 0 / 0.3), inset 0 -6px 12px oklch(0 0 0 / 0.4)" }}
          >
            <X className="h-14 w-14 md:h-20 md:w-20" strokeWidth={3} />
            <span className="text-2xl md:text-3xl mt-1">NO</span>
          </motion.button>
        </div>

        {/* Arrow indicator */}
        <div className="w-full max-w-5xl flex justify-center -mb-1">
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="text-cyber-orange"
          >
            <ChevronDown className="h-5 w-5" style={{ filter: "drop-shadow(0 0 8px oklch(0.70 0.22 45 / 0.8))" }} />
          </motion.div>
        </div>

        {/* Quick codes + connection bonuses */}
        <div className="w-full max-w-5xl shrink-0 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-heading" dir="ltr">Quick Codes</p>
              <p className="text-[10px] font-heading font-black text-cyber-orange tabular-nums" dir="ltr">
                {movementTotal.toFixed(2)} / {MAX_C_MOVEMENT.toFixed(2)}
              </p>
            </div>
            {/* Manual code entry */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addManualCode(); }}
                placeholder="كود يدوي · e.g. 353C"
                dir="ltr"
                className="flex-1 h-8 rounded-lg bg-black/50 border-2 border-white/10 focus:border-cyber-orange/60 outline-none px-2 text-[12px] font-heading font-black text-white placeholder:text-white/30 placeholder:font-body"
              />
              <button
                type="button"
                onClick={(e) => { e.currentTarget.blur(); addManualCode(); }}
                className="h-8 px-3 rounded-lg border-2 border-cyber-orange/50 bg-cyber-orange/15 text-cyber-orange text-[11px] font-heading font-black hover:bg-cyber-orange/25"
              >
                + إضافة
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_CODES.map((code) => {
                const a = judgeCAttempts.find(x => x.code === code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={(e) => { e.currentTarget.blur(); tapQuickCode(code); }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-heading font-black border-2 transition-colors ${
                      a ? (a.successful ? "border-green-400/60 bg-green-400/15 text-green-200" : "border-red-400/60 bg-red-400/15 text-red-200")
                        : "border-white/10 bg-white/5 text-white/70 hover:border-cyber-orange/50"
                    }`}
                    dir="ltr"
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
            <div className="flex items-center justify-between mb-1 gap-3">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-heading" dir="ltr">Connections</p>
              <p className="text-[10px] font-heading font-black text-cyan-300 tabular-nums" dir="ltr">
                {connectionTotal.toFixed(2)} / {MAX_C_CONNECTION.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {connectionOptions.map(({ bonus: b, fromSheet }) => {
                const a = judgeCAttempts.find(x => x.code === b.code);
                return (
                  <button
                    key={b.code}
                    type="button"
                    title={fromSheet ? `${b.labelAr} · من استمارة اللاعب` : b.labelAr}
                    onClick={(e) => { e.currentTarget.blur(); tapConnection(b); }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-heading font-black border-2 transition-colors ${
                      a && a.successful ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
                        : fromSheet ? "border-cyan-400/40 bg-cyan-400/5 text-cyan-100 hover:border-cyan-400/70"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-cyan-400/50"
                    }`}
                    dir="ltr"
                  >
                    {fromSheet ? "★ " : ""}{b.code} · +{b.value.toFixed(2)}
                  </button>
                );
              })}

            </div>
          </div>
        </div>

        {/* Movements track — compact pills, name shows only on tap */}
        <div className="w-full max-w-5xl shrink-0">
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-heading" dir="ltr">
              Movements · {sheet.length}
            </p>
            {!athlete?.difficultySheet?.length && (
              <p className="text-[9px] text-amber-400/80 font-body" dir="rtl">
                ⚠ في انتظار استمارة الصعوبة من المساعد التقني
              </p>
            )}
            <p className="text-[9px] text-white/30 font-body" dir="rtl">انقر على الكود لرؤية الاسم</p>
          </div>
          <div
            ref={trackRef}
            className="cyber-scroll-x overflow-x-auto overflow-y-hidden pb-2 px-2 rounded-xl border border-cyber-orange/20 bg-black/30"
            style={{ height: "128px" }}
          >
            <div className="flex items-stretch gap-2 min-w-min h-full py-2">
              {sheet.map((d, i) => {
                const attempt = judgeCAttempts.find(a => a.code === d.code);
                const isActive = i === activeIndex;
                const showLabel = revealedCode === d.code;
                return (
                  <motion.div
                    key={d.code}
                    ref={isActive ? activeCardRef : undefined}
                    layout
                    onClick={() => {
                      setRevealedCode(prev => prev === d.code ? null : d.code);
                      if (!attempt) setActiveIndex(i);
                    }}
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className={`relative shrink-0 w-20 md:w-24 rounded-xl px-2 py-1.5 cursor-pointer select-none border-2 flex flex-col items-center justify-center ${
                      isActive
                        ? "border-cyber-orange bg-black/60 glow-cyber"
                        : attempt
                          ? attempt.successful
                            ? "border-green-400/50 bg-green-400/10"
                            : "border-red-400/50 bg-red-400/10"
                          : "border-white/10 bg-white/5"
                    }`}
                    style={isActive ? { boxShadow: "0 0 24px oklch(0.70 0.22 45 / 0.55)" } : undefined}
                    title={d.label}
                  >
                    <span className="text-base md:text-lg font-heading font-black text-white leading-none" dir="ltr">{d.code}</span>
                    <span className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded border border-cyber-orange/40 bg-cyber-orange/15 text-cyber-orange leading-none" dir="ltr">
                      +{d.value.toFixed(2)}
                    </span>
                    {/* Per-movement validation — Confirmed / Unconfirmed */}
                    <div className="flex gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="تأكيد / Confirmed"
                        onClick={(e) => { e.currentTarget.blur(); validateMovement(d, true); }}
                        className={`h-6 w-8 rounded-md border-2 flex items-center justify-center transition-colors ${
                          attempt?.successful ? "border-green-400 bg-green-400/30 text-green-100" : "border-green-400/40 bg-green-400/10 text-green-300 hover:bg-green-400/20"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        title="إلغاء / Unconfirmed"
                        onClick={(e) => { e.currentTarget.blur(); validateMovement(d, false); }}
                        className={`h-6 w-8 rounded-md border-2 flex items-center justify-center transition-colors ${
                          attempt && !attempt.successful ? "border-red-400 bg-red-400/30 text-red-100" : "border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                        }`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                    </div>

                    {attempt && (
                      <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center ${attempt.successful ? "bg-green-500 text-black" : "bg-red-500 text-white"}`}>
                        {attempt.successful ? "✓" : "✗"}
                      </span>
                    )}
                    <AnimatePresence>
                      {showLabel && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.9 }}
                          transition={{ duration: 0.15 }}
                          onAnimationComplete={() => {
                            setTimeout(() => setRevealedCode(prev => prev === d.code ? null : prev), 1800);
                          }}
                          className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-lg bg-black/95 border border-cyber-orange/50 shadow-xl whitespace-nowrap pointer-events-none"
                        >
                          <p className="text-[11px] font-bold text-white" dir="ltr">{d.label}</p>
                          <p className="text-[9px] text-white/60" dir="ltr">{d.connection}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
