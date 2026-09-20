import { useState, useEffect, useMemo, useRef } from "react";
import { Trophy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCompetition, STYLE_CONFIGS } from "@/store/competition-store";
import { FederationLogo } from "./FederationLogo";
import { supabase } from "@/integrations/supabase/client";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";
import { FullscreenToggle } from "./FullscreenToggle";
import { useMatchSync, onSessionState } from "@/hooks/useMatchSync";

// Live data from TA's session (current_match + match_events)
function useLiveSession() {
  const { sessionCode } = useCompetition();
  const [activeSessionCode, setActiveSessionCode] = useState<string | null>(sessionCode);
  const [liveAthlete, setLiveAthlete] = useState<{ id: string; full_name: string; bib_number: string | null; country: string | null; club: string | null; age_category: string | null; style: string | null } | null>(null);
  const [taTimer, setTaTimer] = useState<{ running: boolean; baseSec: number; startedAt: number | null }>({ running: false, baseSec: 0, startedAt: null });
  const [callBanner, setCallBanner] = useState<{ name: string; bib: string | null } | null>(null);

  useEffect(() => {
    let activeCode = sessionCode;
    let cancelled = false;

    async function init() {
      // Strict isolation: scoreboard must use the code entered in Display Join.
      // Never auto-pick the latest active session, otherwise a new/empty session can leak old data.
      if (!activeCode || cancelled) {
        setActiveSessionCode(null);
        setLiveAthlete(null);
        setTaTimer({ running: false, baseSec: 0, startedAt: null });
        setCallBanner(null);
        return;
      }
      setActiveSessionCode(activeCode);

      // Initial current athlete
      const { data: cm } = await supabase.from("current_match").select("athlete_id").eq("session_code", activeCode).maybeSingle();
      if (cm?.athlete_id) {
        const { data: a } = await supabase.from("athletes").select("id,full_name,bib_number,country,club,age_category,style").eq("id", cm.athlete_id).maybeSingle();
        if (a && !cancelled) setLiveAthlete(a as any);
      }

      const ch = supabase.channel(`scoreboard-${activeCode}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${activeCode}` }, async (payload: any) => {
          const aid = payload.new?.athlete_id;
          if (!aid) { setLiveAthlete(null); return; }
          const { data: a } = await supabase.from("athletes").select("id,full_name,bib_number,country,club,age_category,style").eq("id", aid).maybeSingle();
          if (a) setLiveAthlete((prev) => (JSON.stringify(prev) === JSON.stringify(a) ? prev : (a as any)));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${activeCode}` }, (payload: any) => {
          const ev = payload.new;
          if (ev.event_type === "timer_start") setTaTimer({ running: true, baseSec: ev.payload?.at ?? 0, startedAt: Date.now() });
          else if (ev.event_type === "timer_stop") setTaTimer((t) => ({ running: false, baseSec: ev.payload?.at ?? t.baseSec, startedAt: null }));
          else if (ev.event_type === "timer_reset") setTaTimer({ running: false, baseSec: 0, startedAt: null });
          else if (ev.event_type === "call_next") {
            setCallBanner({ name: ev.payload?.name ?? "—", bib: ev.payload?.bib ?? null });
            setTimeout(() => setCallBanner(null), 8000);
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(ch); };
    }

    const cleanup = init();
    return () => { cancelled = true; void cleanup?.then?.((fn) => fn?.()); };
  }, [sessionCode]);

  // Tick the timer locally from the TA broadcast — ONCE PER SECOND and only when the
  // displayed second actually changes, so the screen never re-renders needlessly.
  const [tickSec, setTickSec] = useState(0);
  useEffect(() => {
    const compute = () =>
      taTimer.running && taTimer.startedAt
        ? taTimer.baseSec + Math.floor((Date.now() - taTimer.startedAt) / 1000)
        : taTimer.baseSec;
    setTickSec(compute());
    if (!taTimer.running) return;
    const id = setInterval(() => {
      const next = compute();
      setTickSec((prev) => (prev === next ? prev : next));
    }, 250);
    return () => clearInterval(id);
  }, [taTimer.running, taTimer.startedAt, taTimer.baseSec]);

  const liveTimerSec = tickSec;


  return { activeSessionCode, liveAthlete, liveTimerSec, callBanner };
}

// ── Live published ranking for CURRENT PLACING (v1.7) ────────────────
// Reads every published match_results row for the session, keeps the latest
// row per athlete, sorts descending (highest score = rank 1) and live-updates
// the moment the Chief publishes a new result.
type PlacingRow = { athlete_id: string; final_score: number };
function useLivePlacingRanking(sessionCode: string | null) {
  const [rows, setRows] = useState<PlacingRow[]>([]);
  useEffect(() => {
    if (!sessionCode) { setRows([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("match_results")
        .select("athlete_id, final_score, updated_at")
        .eq("session_code", sessionCode)
        .eq("published", true)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const latest = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        if (!latest.has(r.athlete_id)) latest.set(r.athlete_id, Number(r.final_score));
      });
      const arr = Array.from(latest.entries())
        .map(([athlete_id, final_score]) => ({ athlete_id, final_score }))
        .sort((a, b) => b.final_score - a.final_score);
      setRows(arr);
    };
    load();
    const ch = supabase
      .channel(`sb-placing-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_results", filter: `session_code=eq.${sessionCode}` },
        () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return rows;
}

const STYLE_LABELS: Record<string, string> = {
  changquan: "Changquan",
  nanquan: "Nanquan",
  taijiquan: "Taijiquan",
  traditional: "Traditional",
};

type PublishedScoreboardResult = {
  athlete_id: string;
  athlete_name: string | null;
  final_score: number;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  deductions: number | null;
  published: boolean;
  payload: {
    match_mode?: "compulsory" | "optional" | string;
    confirmed_codes?: { code: string; count?: number; slots?: string[] }[];
    flagged_codes?: { code: string; slot?: string }[];
    b_individual?: { slot: string; score: number | null; role?: "high" | "low" | "kept" | "single" }[];
    c_movements?: { code: string; successful?: boolean | null; success?: boolean | null }[];
    ta_oob_count?: number;
    ta_deduction?: number;
    chief_deduction?: number;
    choreo_deduction?: number;
    choreo_codes?: { code: string; value: number }[];
    total_external_deduction?: number;
  } | null;
  style: string | null;
  updated_at: string;
};

type PublishedAthlete = {
  id: string;
  full_name: string;
  bib_number: string | null;
  country: string | null;
  club: string | null;
  age_category: string | null;
  style: string | null;
};

function usePublishedResult(sessionCode: string | null) {
  const [result, setResult] = useState<PublishedScoreboardResult | null>(null);
  const [athlete, setAthlete] = useState<PublishedAthlete | null>(null);

  useEffect(() => {
    if (!sessionCode) { setResult(null); setAthlete(null); return; }
    let cancelled = false;

    const loadLatest = async () => {
      // Past results stay published (session ranking history), so the reveal is
      // scoped to the athlete currently called on the floor.
      const { data: cm } = await supabase
        .from("current_match")
        .select("athlete_id")
        .eq("session_code", sessionCode)
        .maybeSingle();
      const liveId = (cm as { athlete_id: string | null } | null)?.athlete_id ?? null;
      if (!liveId) { if (!cancelled) { setResult(null); setAthlete(null); } return; }
      let query = supabase
        .from("match_results")
        .select("athlete_id,athlete_name,final_score,score_a,score_b,score_c,deductions,published,payload,style,updated_at")
        .eq("published", true)
        .eq("athlete_id", liveId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (sessionCode) query = query.eq("session_code", sessionCode);
      const { data } = await query.maybeSingle();
      if (cancelled) return;
      const row = (data as PublishedScoreboardResult | null) ?? null;
      setResult(row);
      if (!row?.athlete_id) { setAthlete(null); return; }
      const { data: athleteRow } = await supabase
        .from("athletes")
        .select("id,full_name,bib_number,country,club,age_category,style")
        .eq("id", row.athlete_id)
        .maybeSingle();
      if (!cancelled) setAthlete((athleteRow as PublishedAthlete | null) ?? null);
    };

    void loadLatest();
    const ch = supabase
      .channel(`scoreboard-published-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_results" },
        () => { void loadLatest(); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        () => { void loadLatest(); })
      // TA "NEXT ATHLETE / GLOBAL RESET" — clear the revealed result immediately.
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload: any) => {
          const ev = payload.new?.event_type;
          if (ev !== "global_reset") return;
          if (cancelled) return;
          setResult(null);
          setAthlete(null);
        })
      .subscribe();

    // Instant path: the Chief broadcasts the published snapshot the moment the
    // PUBLISH button is pressed, so the screen never waits on replication.
    const offState = onSessionState(sessionCode, (raw) => {
      const pr = (raw as { payload?: { published_result?: Record<string, unknown> } })?.payload?.published_result;
      if (!pr || pr.status !== "PUBLISHED") return;
      if (cancelled) return;
      setResult((prev) => ({
        athlete_id: String(pr.athlete_id ?? prev?.athlete_id ?? ""),
        athlete_name: (pr.athlete_name as string) ?? prev?.athlete_name ?? null,
        final_score: Number(pr.final_score ?? prev?.final_score ?? 0),
        score_a: pr.score_a === null || pr.score_a === undefined ? (prev?.score_a ?? null) : Number(pr.score_a),
        score_b: pr.score_b === null || pr.score_b === undefined ? (prev?.score_b ?? null) : Number(pr.score_b),
        score_c: pr.score_c === null || pr.score_c === undefined ? null : Number(pr.score_c),
        deductions: pr.deductions === null || pr.deductions === undefined ? (prev?.deductions ?? null) : Number(pr.deductions),
        published: true,
        payload: {
          ...(prev?.payload ?? {}),
          ta_deduction: pr.ta_deduction === undefined ? prev?.payload?.ta_deduction : Number(pr.ta_deduction),
          chief_deduction: pr.chief_deduction === undefined ? prev?.payload?.chief_deduction : Number(pr.chief_deduction),
          choreo_deduction: pr.choreo_deduction === undefined ? prev?.payload?.choreo_deduction : Number(pr.choreo_deduction),
          choreo_codes: (pr.choreo_codes === undefined
            ? prev?.payload?.choreo_codes
            : pr.choreo_codes) as { code: string; value: number }[] | undefined,
        },
        style: prev?.style ?? null,
        updated_at: new Date().toISOString(),
      }));
      // Then refresh from the database to pull the full breakdown payload.
      void loadLatest();
    });

    return () => { cancelled = true; supabase.removeChannel(ch); offState(); };
  }, [sessionCode]);

  return { result, athlete };
}

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

export function PublicScoreboard() {
  const { sessionCode } = useCompetition();
  const { leaderboardMode } = useDisplaySettings(sessionCode);
  if (leaderboardMode) return <LeaderboardView />;
  return <LiveScoreboard />;
}

function LiveScoreboard() {
  const {
    competitionStyle, judgeAScore, judgeADeductions, judgeBScores, judgeBAverage,
    judgeCScore, judgeCAttempts, finalScore, timerElapsed,
    athletes, currentAthleteIndex, scoreRevealed, sessionCode,
  } = useCompetition();
  const { marquee: marqueeText, sponsors: sponsorLogos } = useDisplaySettings(sessionCode);

  const { activeSessionCode, liveAthlete, liveTimerSec, callBanner } = useLiveSession();
  const scoreboardSync = useMatchSync(sessionCode);
  const syncTimerSec = scoreboardSync.elapsedSec;
  const { result: publishedResult, athlete: publishedAthlete } = usePublishedResult(activeSessionCode ?? sessionCode);

  // ── Published-only reveal ────────────────────────────────
  // The Chief's PUBLISH button writes a full snapshot to match_results.payload;
  // this screen now reads that same snapshot instead of stale local state.
  const isPublished = !!publishedResult?.published;
  const displayFinal = Number(publishedResult?.final_score ?? finalScore);
  const showFinal = isPublished || scoreRevealed;

  // ── CURRENT PLACING — live rank of the published score against every
  // previously published athlete of this session (v1.7). Recomputed in
  // real time whenever any result is published: a higher score takes
  // rank 1 and previous leaders automatically drop one place.
  const placingRanking = useLivePlacingRanking(activeSessionCode ?? sessionCode);
  const currentPlacing = useMemo(() => {
    const aid = publishedResult?.athlete_id ?? liveAthlete?.id ?? null;
    if (!aid || !showFinal) return null;
    const mine = Number(publishedResult?.final_score ?? displayFinal);
    const others = placingRanking.filter((r) => r.athlete_id !== aid);
    const ahead = others.filter((r) => r.final_score > mine).length;
    // Initial state / single scored athlete: rank is always 1 OF 1.
    return { rank: ahead + 1, total: others.length + 1 };
  }, [publishedResult?.athlete_id, publishedResult?.final_score, liveAthlete?.id, showFinal, displayFinal, placingRanking]);

  // ── Staggered reveal: A → B → C with 1s delay each, after publish/reveal ──
  const [revealStage, setRevealStage] = useState(0); // 0=none, 1=A, 2=A+B, 3=A+B+C
  useEffect(() => {
    if (!showFinal) { setRevealStage(0); return; }
    setRevealStage(0);
    const t1 = setTimeout(() => setRevealStage(1), 200);
    const t2 = setTimeout(() => setRevealStage(2), 1200);
    const t3 = setTimeout(() => setRevealStage(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [showFinal, publishedResult?.updated_at]);
  const showA = revealStage >= 1;
  const showB = revealStage >= 2;
  const showC = revealStage >= 3;
  const publishedPayload = publishedResult?.payload ?? null;
  const displayStyle = publishedResult?.style ?? publishedAthlete?.style ?? liveAthlete?.style ?? competitionStyle;
  const config = displayStyle && STYLE_CONFIGS[displayStyle] ? STYLE_CONFIGS[displayStyle] : STYLE_CONFIGS.changquan;
  const athlete = athletes[currentAthleteIndex];
  const displayAthlete = publishedAthlete ?? liveAthlete;
  const athleteName = publishedResult?.athlete_name ?? displayAthlete?.full_name ?? athlete?.name ?? "—";
  const athleteCountry = displayAthlete?.country ?? athlete?.country ?? "TUN";
  const athleteNumber = displayAthlete?.bib_number ?? (athlete ? String(athlete.order).padStart(3, "0") : "—");
  const athleteCategory = displayAthlete?.age_category ?? athlete?.category ?? (displayStyle ? STYLE_LABELS[displayStyle] : "—");
  const totalDeduction = Number(publishedResult?.deductions ?? judgeADeductions.reduce((sum, d) => sum + d.value, 0));
  const chiefDeduction = Number(publishedPayload?.chief_deduction ?? 0);
  const choreoDeduction = Number(publishedPayload?.choreo_deduction ?? 0);
  const taDeduction = Number(
    publishedPayload?.ta_deduction ?? Math.max(0, totalDeduction - chiefDeduction - choreoDeduction),
  );
  const displayAScore = Number(publishedResult?.score_a ?? judgeAScore);
  const displayBScore = Number(publishedResult?.score_b ?? judgeBAverage);
  const displayCScore = Number(publishedResult?.score_c ?? judgeCScore);
  const displayConfirmedCodes = Array.isArray(publishedPayload?.confirmed_codes) ? publishedPayload.confirmed_codes : [];
  const displayFlaggedCodes = Array.isArray(publishedPayload?.flagged_codes) ? publishedPayload.flagged_codes : [];
  const displayBIndividual = Array.isArray(publishedPayload?.b_individual) && publishedPayload.b_individual.length > 0
    ? publishedPayload.b_individual
        .filter((b) => b && b.score !== null && b.score !== undefined)
        .map((b) => ({ slot: String(b.slot), score: Number(b.score), role: b.role ?? "single" }))
    : (() => {
        const scores = judgeBScores.map((score, i) => ({ slot: `B${i + 1}`, score: Number(score), role: "kept" as "high" | "low" | "kept" | "single" }));
        if (scores.length >= 3) {
          const min = Math.min(...scores.map((b) => b.score));
          const max = Math.max(...scores.map((b) => b.score));
          let lowDone = false, highDone = false;
          scores.forEach((b) => {
            if (!lowDone && b.score === min) { b.role = "low"; lowDone = true; }
            else if (!highDone && b.score === max) { b.role = "high"; highDone = true; }
          });
        }
        return scores;
      })();
  const displayCMovements = Array.isArray(publishedPayload?.c_movements) && publishedPayload.c_movements.length > 0
    ? publishedPayload.c_movements.map((m) => ({ code: String(m.code), success: typeof m.successful === "boolean" ? m.successful : typeof m.success === "boolean" ? m.success : null }))
    : judgeCAttempts.map((a) => ({ code: a.code, success: a.successful }));

  // Authoritative timer mirrored from the Technical Assistant.
  const displayTimerSec = syncTimerSec || liveTimerSec || timerElapsed;



  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Count-up for final score (only when published or revealed)
  const animatedScore = useCountUp(showFinal ? displayFinal : 0, 1800);

  // Sponsor carousel
  const [sponsorIdx, setSponsorIdx] = useState(0);
  useEffect(() => {
    if (sponsorLogos.length <= 1) return;
    const id = setInterval(() => setSponsorIdx(i => (i + 1) % sponsorLogos.length), 4000);
    return () => clearInterval(id);
  }, [sponsorLogos.length]);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  // Cyber Tunisia palette
  const CRIMSON = "#E30613";
  const NEON_ORANGE = "#FF7A1A";
  const SKY_BLUE = "#5EC6FF";
  const GREEN = "#16C172";
  const WHITE = "#FFFFFF";

  // QR → athlete report
  const reportAthleteId = publishedResult?.athlete_id ?? displayAthlete?.id ?? athlete?.id ?? null;
  const reportUrl =
    origin && reportAthleteId
      ? `${origin}/public-report/${reportAthleteId}`
      : "/scoreboard";

  return (
    <div className="h-screen w-screen flex flex-col bg-black relative overflow-hidden text-white" style={{
      backgroundImage: "radial-gradient(ellipse at top left, rgba(227,6,19,0.10), transparent 55%), radial-gradient(ellipse at bottom right, rgba(255,122,26,0.10), transparent 55%)",
    }}>
      {/* Top Advertising Bar — Crimson Red, taller, rolling text */}
      <div
        className="flex items-center overflow-hidden shrink-0 relative z-10 border-b-2"
        style={{
          height: 48,
          background: `linear-gradient(90deg, ${CRIMSON}, #b3050f, ${CRIMSON})`,
          borderColor: "rgba(0,0,0,0.6)",
          boxShadow: `0 2px 24px ${CRIMSON}55`,
        }}
      >
        <div className="ticker-wrap">
          <div className="ticker-content">
            <span className="font-heading font-black text-base px-10 tracking-widest" style={{ color: WHITE }}>★ {marqueeText} ★</span>
            <span className="font-heading font-black text-base px-10 tracking-widest" style={{ color: WHITE }}>★ {athleteName} — {athleteCountry} — {athleteCategory} ★</span>
            <span className="font-heading font-black text-base px-10 tracking-widest" style={{ color: WHITE }}>★ TUNISIAN WUSHU FEDERATION · LIVE ★</span>
            <span className="font-heading font-black text-base px-10 tracking-widest" style={{ color: WHITE }}>★ {marqueeText} ★</span>
          </div>
        </div>
      </div>

      {callBanner && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-2xl border-2 animate-pulse"
          style={{ background: "rgba(0,0,0,0.92)", borderColor: NEON_ORANGE, boxShadow: `0 0 40px ${NEON_ORANGE}` }}>
          <p className="text-xs uppercase tracking-widest font-bold text-center" style={{ color: NEON_ORANGE }}>Next Athlete · نداء</p>
          <p className="text-4xl font-heading font-black text-white text-center mt-1">
            {callBanner.bib && <span style={{ color: NEON_ORANGE }}>#{callBanner.bib} · </span>}{callBanner.name}
          </p>
        </div>
      )}

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-12 gap-5 p-5 min-h-0">
        {/* LEFT — Identity + QR */}
        <aside className="col-span-3 flex flex-col gap-4 min-h-0">
          <div
            className="rounded-3xl border p-5 flex flex-col items-center gap-3 backdrop-blur-md"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              borderColor: "rgba(255,255,255,0.10)",
              boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <FederationLogo size="lg" />
            {displayStyle && (
              <span
                className="text-sm font-heading font-black px-5 py-1.5 rounded-full border tracking-[0.25em] mt-1"
                dir="ltr"
                style={{
                  color: WHITE,
                  borderColor: `${CRIMSON}99`,
                  background: `${CRIMSON}22`,
                  textShadow: `0 0 10px ${CRIMSON}88`,
                }}
              >
                {STYLE_LABELS[displayStyle] || displayStyle}
              </span>
            )}
          </div>

          <div
            className="rounded-3xl border p-5 backdrop-blur-md"
            style={{
              background: "linear-gradient(160deg, rgba(227,6,19,0.18), rgba(0,0,0,0.5))",
              borderColor: `${CRIMSON}66`,
              boxShadow: `0 0 30px ${CRIMSON}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className="px-3 py-1 rounded-lg font-heading font-black tabular-nums text-lg"
                style={{ background: NEON_ORANGE, color: "#000", boxShadow: `0 0 16px ${NEON_ORANGE}88` }}
              >
                {athleteNumber}
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-heading font-black tracking-[0.3em]" style={{ color: WHITE }}>LIVE</span>
            </div>
            <h1 className="font-heading font-black text-2xl leading-tight" style={{ color: WHITE }}>{athleteName}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-heading font-black px-2 py-0.5 rounded" style={{ background: CRIMSON, color: WHITE }}>{athleteCountry}</span>
              <span className="text-[11px] font-body font-bold text-white/70" dir="ltr">{athleteCategory}</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* QR Code framed box */}
          <div
            className="rounded-3xl border-2 p-4 flex flex-col items-center gap-2"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(0,0,0,0.6))",
              borderColor: `${NEON_ORANGE}88`,
              boxShadow: `0 0 28px ${NEON_ORANGE}44, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <div className="rounded-2xl bg-white p-3">
              <QRCodeSVG value={reportUrl} size={140} level="M" bgColor="#ffffff" fgColor="#0a0a0a" includeMargin={false} />
            </div>
            <p className="text-center text-[12px] font-heading font-black mt-1" style={{ color: WHITE }}>
              Scan for your technical report 📱
            </p>
            <p className="text-center text-[10px] font-body text-white/60" dir="rtl">
              امسح للحصول على تقريرك الفني
            </p>
          </div>
        </aside>

        {/* CENTER — Hero numbers */}
        <section className="col-span-6 flex flex-col gap-5 min-h-0">
          <div
            className="rounded-3xl border-2 px-6 py-5 flex flex-col items-center justify-center backdrop-blur-md"
            style={{
              background: "linear-gradient(160deg, rgba(255,122,26,0.12), rgba(0,0,0,0.7))",
              borderColor: `${NEON_ORANGE}99`,
              boxShadow: `0 0 50px ${NEON_ORANGE}40, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.4em] font-heading font-black" style={{ color: WHITE, opacity: 0.7 }}>
              Performance Time
            </p>
            <p
              className={`font-heading font-black tabular-nums leading-none mt-1 ${displayTimerSec > config.performanceTime ? "animate-pulse" : ""}`}
              dir="ltr"
              style={{
                fontSize: "5.5rem",
                color: displayTimerSec > config.performanceTime ? "#ff3344" : NEON_ORANGE,
                textShadow: `0 0 30px ${NEON_ORANGE}, 0 0 60px ${NEON_ORANGE}88, 0 0 90px ${NEON_ORANGE}44`,
              }}
            >
              {fmtTime(displayTimerSec)}
            </p>
            <p className="text-xs text-white/50 font-body font-bold mt-1" dir="ltr">/ {fmtTime(config.performanceTime)}</p>
          </div>

          <div
            className="flex-1 rounded-3xl border-2 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md"
            style={{
              background: "radial-gradient(circle at center, rgba(227,6,19,0.18), rgba(0,0,0,0.92))",
              borderColor: showFinal ? CRIMSON : "rgba(255,255,255,0.10)",
              boxShadow: showFinal
                ? `0 0 100px ${CRIMSON}88, inset 0 0 80px ${CRIMSON}33`
                : "inset 0 1px 0 rgba(255,255,255,0.05)",
              transition: "all 1s ease",
            }}
          >
            <p className="text-sm uppercase tracking-[0.45em] font-heading font-black mb-1" style={{ color: WHITE, opacity: 0.85 }}>
              Final Score
            </p>
            <p
              className="font-heading font-black tabular-nums leading-none"
              style={{
                fontSize: "13rem",
                color: showFinal ? "#FACC15" : "rgba(255,255,255,0.20)",
                textShadow: "none",
                transition: "color 1s ease",
              }}
              dir="ltr"
            >
              {showFinal ? animatedScore.toFixed(3) : "—.———"}
            </p>
            <p className="text-base font-heading font-black mt-2 tracking-widest" style={{ color: WHITE }} dir="rtl">
              {showFinal ? "النتيجة النهائية" : "في انتظار اعتماد الحكم الرئيسي…"}
            {/* CURRENT PLACING — always rendered at the bottom-left of the
                FINAL SCORE panel (never conditionally hidden). */}
            <div className="w-full flex justify-start px-2 pt-4" dir="ltr">
              <div className="inline-flex min-w-[220px] items-center justify-between gap-4 rounded-xl border px-4 py-2"
                style={{ borderColor: `${NEON_ORANGE}99`, background: "rgba(255,122,26,0.12)" }}>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] font-heading font-black text-white/75">
                    Current Placing
                  </p>
                  <p className="text-[9px] tracking-[0.2em] text-white/45">
                    OF {currentPlacing?.total ?? Math.max(1, placingRanking.length)}
                  </p>
                </div>
                <span className="text-4xl md:text-5xl font-heading font-black tabular-nums leading-none"
                  style={{ color: "#FACC15", textShadow: "none" }}>
                  {currentPlacing?.rank ?? (showFinal ? 1 : "—")}
                </span>
              </div>
            </div>
            </p>
            {isPublished && (
              <span
                className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black tracking-widest border"
                style={{ background: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.6)", color: "#6ee7b7" }}
              >
                ● PUBLISHED
              </span>
            )}
            {sponsorLogos.length > 0 && (
              <div
                className="absolute bottom-3 left-3 right-3 h-12 rounded-xl border flex items-center justify-center overflow-hidden"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}
              >
                <img key={sponsorIdx} src={sponsorLogos[sponsorIdx]} alt="Sponsor" className="max-h-10 max-w-[80%] object-contain animate-fade-in" />
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — Three score cards (CRYSTAL BLACK theme · readable from 20m) */}
        <aside className="col-span-3 flex flex-col gap-4 min-h-0">
          {/* Shared crystal-black panel base style */}
          {(() => null)()}

          {/* ── Group A — Quality (deduction codes as circles) ── */}
          <div
            className="rounded-3xl p-4 flex flex-col flex-1 border-2 transition-all duration-700 backdrop-blur-xl"
            style={{
              background: "linear-gradient(160deg, rgba(20,20,24,0.95), rgba(0,0,0,0.98))",
              borderColor: showA ? `${CRIMSON}cc` : "rgba(255,255,255,0.10)",
              boxShadow: showA
                ? `0 10px 50px rgba(0,0,0,0.85), 0 0 40px ${CRIMSON}55, inset 0 1px 0 rgba(255,255,255,0.08)`
                : "0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              opacity: showA ? 1 : 0.5,
              transform: showA ? "scale(1)" : "scale(0.97)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-heading font-black px-2.5 py-0.5 rounded-full tracking-[0.25em]"
                    style={{ background: CRIMSON, color: WHITE, boxShadow: `0 0 12px ${CRIMSON}88` }}>
                A · QUALITY
              </span>
              <span className="text-[10px] font-heading font-black text-white/50 tracking-widest" dir="rtl">جودة</span>
            </div>
            <p className="font-heading font-black tabular-nums leading-none text-white text-center"
               style={{ fontSize: "3.6rem", textShadow: `0 0 24px ${CRIMSON}aa, 0 2px 6px rgba(0,0,0,0.9)` }} dir="ltr">
              {showA ? displayAScore.toFixed(3) : "—.———"}
            </p>
            {/* Deduction codes shown as colored CIRCLES */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 min-h-[36px]" dir="ltr">
              {showA && displayConfirmedCodes.slice(0, 10).map((d, i) => (
                <span key={i}
                      className="h-9 min-w-9 px-2 rounded-full inline-flex items-center justify-center text-[11px] font-heading font-black tabular-nums"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, #ff4757, ${CRIMSON})`,
                        color: WHITE,
                        boxShadow: `0 0 10px ${CRIMSON}99, inset 0 1px 0 rgba(255,255,255,0.3)`,
                      }}>
                  {d.code}{(d.count ?? 1) > 1 ? `·${d.count}` : ""}
                </span>
              ))}
              {showA && displayConfirmedCodes.length === 0 && (
                <span className="text-[11px] text-white/45 font-body self-center">No deductions</span>
              )}
              {showA && displayFlaggedCodes.slice(0, 3).map((d, i) => (
                <span key={`f-${i}`}
                      className="h-7 min-w-7 px-1.5 rounded-full inline-flex items-center justify-center text-[10px] font-heading font-black tabular-nums line-through opacity-60"
                      style={{ background: "rgba(255,255,255,0.06)", color: WHITE, border: "1px solid rgba(255,255,255,0.15)" }}>
                  {d.code}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
              <span className="text-[11px] font-heading font-bold text-white/55" dir="ltr">/ {config.maxA.toFixed(3)}</span>
              <span className="text-xs font-heading font-black px-2 py-0.5 rounded-md tabular-nums"
                    style={{ background: `${CRIMSON}33`, color: "#ff8a92", border: `1px solid ${CRIMSON}66` }} dir="ltr">
                TA: −{taDeduction.toFixed(3)}
              </span>
              {chiefDeduction > 0 && (
                <span className="text-[10px] font-heading font-black text-red-300 tabular-nums" dir="ltr">
                  HD: −{chiefDeduction.toFixed(3)}
                </span>
              )}
              {choreoDeduction > 0 && (
                <span className="text-[10px] font-heading font-black text-orange-300 tabular-nums" dir="ltr">
                  CD: −{choreoDeduction.toFixed(3)}
                </span>
              )}
            </div>
          </div>

          {/* ── Group B — Performance (5 judge scores, big readable) ── */}
          <div
            className="rounded-3xl p-4 flex flex-col flex-1 border-2 transition-all duration-700 backdrop-blur-xl"
            style={{
              background: "linear-gradient(160deg, rgba(20,20,24,0.95), rgba(0,0,0,0.98))",
              borderColor: showB ? `${SKY_BLUE}cc` : "rgba(255,255,255,0.10)",
              boxShadow: showB
                ? `0 10px 50px rgba(0,0,0,0.85), 0 0 40px ${SKY_BLUE}55, inset 0 1px 0 rgba(255,255,255,0.08)`
                : "0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              opacity: showB ? 1 : 0.5,
              transform: showB ? "scale(1)" : "scale(0.97)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-heading font-black px-2.5 py-0.5 rounded-full tracking-[0.25em]"
                    style={{ background: SKY_BLUE, color: "#000", boxShadow: `0 0 12px ${SKY_BLUE}88` }}>
                B · PERFORMANCE
              </span>
              <span className="text-[10px] font-heading font-black text-white/50 tracking-widest" dir="rtl">أداء</span>
            </div>
            <p className="font-heading font-black tabular-nums leading-none text-white text-center"
               style={{ fontSize: "3.6rem", textShadow: `0 0 24px ${SKY_BLUE}aa, 0 2px 6px rgba(0,0,0,0.9)` }} dir="ltr">
              {showB ? displayBScore.toFixed(3) : "—.———"}
            </p>
            {/* 5 individual judge scores — BIG, readable from 20m */}
            <div className="grid grid-cols-5 gap-1.5 mt-2" dir="ltr">
              {displayBIndividual.slice(0, 8).map((b, i) => {
                const isExtreme = showB && (b.role === "high" || b.role === "low");
                const accent = !showB ? "#444" : isExtreme ? CRIMSON : GREEN;
                return (
                  <div key={b.slot || i} className="rounded-lg flex flex-col items-center justify-center py-1.5"
                       style={{
                         background: "rgba(0,0,0,0.55)",
                         border: `2px solid ${accent}`,
                         boxShadow: showB ? `0 0 12px ${accent}aa, inset 0 0 10px ${accent}33` : "none",
                       }}>
                    <p className="text-[9px] font-heading font-black tabular-nums leading-none" style={{ color: accent }} dir="ltr">{b.slot}</p>
                    <p className="font-heading font-black tabular-nums leading-tight text-white" style={{ fontSize: "1.15rem", textShadow: `0 0 8px ${accent}aa` }}>
                      {showB ? b.score.toFixed(3) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
              <span className="text-[11px] font-heading font-bold text-white/55" dir="ltr">avg / {config.maxB.toFixed(3)}</span>
              <span className="text-[10px] font-heading font-bold tracking-widest" style={{ color: SKY_BLUE }} dir="ltr">drop high+low</span>
            </div>
          </div>

          {/* ── Group C — Difficulty (codes as circles: green=success, red=fail) ── */}
          <div
            className="rounded-3xl p-4 flex flex-col flex-1 border-2 transition-all duration-700 backdrop-blur-xl"
            style={{
              background: "linear-gradient(160deg, rgba(20,20,24,0.95), rgba(0,0,0,0.98))",
              borderColor: showC ? `${GREEN}cc` : "rgba(255,255,255,0.10)",
              boxShadow: showC
                ? `0 10px 50px rgba(0,0,0,0.85), 0 0 40px ${GREEN}55, inset 0 1px 0 rgba(255,255,255,0.08)`
                : "0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              opacity: showC ? 1 : 0.5,
              transform: showC ? "scale(1)" : "scale(0.97)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-heading font-black px-2.5 py-0.5 rounded-full tracking-[0.25em]"
                    style={{ background: GREEN, color: "#000", boxShadow: `0 0 12px ${GREEN}88` }}>
                C · DIFFICULTY
              </span>
              <span className="text-[10px] font-heading font-black text-white/50 tracking-widest" dir="rtl">صعوبة</span>
            </div>
            <p className="font-heading font-black tabular-nums leading-none text-white text-center"
               style={{ fontSize: "3.6rem", textShadow: `0 0 24px ${GREEN}aa, 0 2px 6px rgba(0,0,0,0.9)` }} dir="ltr">
              {showC ? displayCScore.toFixed(3) : "—.———"}
            </p>
            {/* Difficulty codes as CIRCLES — green for success, red for fail */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 min-h-[36px]" dir="ltr">
              {showC && displayCMovements.slice(0, 12).map((a, i) => {
                const ok = a.success === true;
                const fail = a.success === false;
                const color = ok ? GREEN : fail ? CRIMSON : "#555";
                return (
                  <span key={i}
                        className="h-9 min-w-9 px-2 rounded-full inline-flex items-center justify-center text-[11px] font-heading font-black tabular-nums"
                        style={{
                          background: `radial-gradient(circle at 30% 30%, ${color}ee, ${color}aa)`,
                          color: ok ? "#001a0c" : WHITE,
                          boxShadow: `0 0 10px ${color}99, inset 0 1px 0 rgba(255,255,255,0.3)`,
                        }}
                        title={a.code}>
                    {a.code}
                  </span>
                );
              })}
              {showC && displayCMovements.length === 0 && (
                <span className="text-[11px] text-white/45 font-body self-center">No attempts</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
              <span className="text-[11px] font-heading font-bold text-white/55" dir="ltr">/ {config.maxC.toFixed(3)}</span>
              <span className="text-[11px] font-heading font-black tabular-nums" dir="ltr">
                <span style={{ color: GREEN }}>{displayCMovements.filter(a => a.success === true).length}✓</span>
                <span className="text-white/30 mx-1">·</span>
                <span style={{ color: CRIMSON }}>{displayCMovements.filter(a => a.success === false).length}✗</span>
              </span>
            </div>
          </div>
        </aside>
      </div>
      <FullscreenToggle />
    </div>
  );
}

interface LbEntry {
  id: string;
  name: string;
  country: string | null;
  category: string | null;
  order: number;
  score: number;
  style: string | null;
}

function useRemoteLeaderboard(sessionCode: string | null): LbEntry[] {
  const [entries, setEntries] = useState<LbEntry[]>([]);

  useEffect(() => {
    if (!sessionCode) { setEntries([]); return; }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("match_results")
        .select("athlete_id, athlete_name, final_score, style, payload")
        .eq("session_code", sessionCode)
        .eq("published", true)
        .order("final_score", { ascending: false });
      if (cancelled || !data) return;
      // De-dup by athlete_id keeping the highest score
      const byId = new Map<string, LbEntry>();
      data.forEach((r, i) => {
        const id = (r as { athlete_id: string }).athlete_id;
        const score = Number((r as { final_score: number }).final_score) || 0;
        const prev = byId.get(id);
        if (!prev || score > prev.score) {
          const payload = (r as { payload?: Record<string, unknown> }).payload ?? {};
          byId.set(id, {
            id,
            name: (r as { athlete_name?: string }).athlete_name ?? "—",
            country: (payload.country as string) ?? null,
            category: (payload.age_category as string) ?? null,
            order: i + 1,
            score,
            style: (r as { style?: string }).style ?? null,
          });
        }
      });
      const list = Array.from(byId.values()).sort((a, b) => b.score - a.score);
      setEntries(list);
    };

    load();
    const ch = supabase.channel(`lb-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_results", filter: `session_code=eq.${sessionCode}` },
        () => { void load(); })
      .subscribe();

    return () => { cancelled = true; try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [sessionCode]);

  return entries;
}

function LeaderboardView() {
  const { competitionStyle, sessionCode } = useCompetition();
  const { marquee: marqueeText, sponsors: sponsorLogos } = useDisplaySettings(sessionCode);
  const entries = useRemoteLeaderboard(sessionCode);
  const orange = "#FF7A1A";
  const gold = "#F4C542";

  const medalStyles = [
    { bg: "linear-gradient(135deg, #FFD700, #B8860B)", color: "#000", glow: "rgba(255,215,0,0.6)", label: "1st" },
    { bg: "linear-gradient(135deg, #E5E4E2, #A8A8A8)", color: "#000", glow: "rgba(229,228,226,0.5)", label: "2nd" },
    { bg: "linear-gradient(135deg, #CD7F32, #8B4513)", color: "#fff", glow: "rgba(205,127,50,0.6)", label: "3rd" },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-black relative overflow-hidden text-white" style={{
      backgroundImage: "radial-gradient(ellipse at top, rgba(244,197,66,0.10), transparent 60%), radial-gradient(ellipse at bottom, rgba(255,122,26,0.06), transparent 60%)",
    }}>
      <div className="h-10 flex items-center overflow-hidden shrink-0 relative z-10 border-b" style={{ background: "linear-gradient(90deg, #1a0a00, #000, #1a0a00)", borderColor: "rgba(244,197,66,0.3)" }}>
        <div className="ticker-wrap">
          <div className="ticker-content">
            <span className="font-heading font-bold text-sm px-8" style={{ color: gold }}>★ {marqueeText} ★</span>
            <span className="font-heading font-bold text-sm px-8" style={{ color: orange }}>★ FINAL LEADERBOARD ★ جدول الترتيب النهائي ★</span>
          </div>
        </div>
      </div>

      <header className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "rgba(244,197,66,0.2)" }}>
        <FederationLogo size="md" />
        <div className="text-center flex-1">
          <p className="text-xs uppercase tracking-[0.4em] font-bold" style={{ color: orange }}>Final Standings</p>
          <h1 className="text-4xl font-heading font-black tracking-[0.15em]" style={{ color: gold, textShadow: `0 0 24px ${gold}66` }}>
            LEADERBOARD
          </h1>
          {competitionStyle && (
            <p className="text-xs font-body mt-1 text-white/60 tracking-widest" dir="ltr">{STYLE_LABELS[competitionStyle]}</p>
          )}
        </div>
        <div className="text-right min-w-[140px]">
          <p className="text-xs uppercase tracking-widest font-bold" style={{ color: orange }}>Athletes</p>
          <p className="text-4xl font-heading font-black tabular-nums" style={{ color: gold }} dir="ltr">{entries.length}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <Trophy className="h-24 w-24 opacity-30" style={{ color: gold }} />
            <p className="text-2xl font-heading font-bold text-white/50">في انتظار النتائج…</p>
            <p className="text-sm text-white/30 font-body" dir="ltr">No results committed yet</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-3">
            {entries.map((e, i) => {
              const medal = i < 3 ? medalStyles[i] : null;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-5 rounded-2xl border-2 p-5"
                  style={{
                    animation: `slideInRow 0.6s ease-out ${i * 0.08}s both`,
                    borderColor: medal ? medal.glow : "rgba(244,197,66,0.2)",
                    background: medal
                      ? `linear-gradient(90deg, ${medal.glow.replace("0.6", "0.18").replace("0.5", "0.18")}, rgba(0,0,0,0.6))`
                      : "rgba(20,15,0,0.5)",
                    boxShadow: medal ? `0 0 30px ${medal.glow}` : "none",
                  }}
                >
                  <div
                    className="h-16 w-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
                    style={{
                      background: medal ? medal.bg : "rgba(255,255,255,0.05)",
                      color: medal ? medal.color : gold,
                      boxShadow: medal ? `0 0 20px ${medal.glow}` : "none",
                    }}
                  >
                    <span className="text-2xl font-heading font-black tabular-nums leading-none">{i + 1}</span>
                    {medal && <span className="text-[9px] font-heading font-black tracking-widest mt-0.5">{medal.label}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2
                      className={`font-heading leading-tight truncate ${medal ? "text-3xl font-black" : "text-xl font-bold"}`}
                      style={{ color: medal ? "#fff" : "rgba(255,255,255,0.85)" }}
                    >
                      {e.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      {e.country && (
                        <span className="text-[11px] font-heading font-bold px-2 py-0.5 rounded" style={{ background: "#E30613", color: "#fff" }}>
                          {e.country}
                        </span>
                      )}
                      {e.category && <span className="text-xs font-body text-white/60" dir="ltr">{e.category}</span>}
                      <span className="text-xs font-body text-white/40" dir="ltr">#{String(e.order).padStart(3, "0")}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Score</p>
                    <p
                      className={`font-heading font-black tabular-nums leading-none ${medal ? "text-6xl" : "text-4xl"}`}
                      style={{
                        color: medal ? "#fff" : gold,
                        textShadow: medal
                          ? `0 0 24px ${medal.glow}, 0 0 40px ${medal.glow}`
                          : `0 0 12px ${gold}55`,
                      }}
                      dir="ltr"
                    >
                      {e.score.toFixed(3)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sponsorLogos.length > 0 && (
        <div className="shrink-0 border-t flex items-center justify-center gap-8 py-3 px-6" style={{ borderColor: "rgba(244,197,66,0.2)", background: "rgba(0,0,0,0.6)" }}>
          {sponsorLogos.slice(0, 6).map((url, i) => (
            <img key={i} src={url} alt={`Sponsor ${i + 1}`} className="h-10 max-w-[120px] object-contain opacity-80" />
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <FullscreenToggle />
    </div>
  );
}
