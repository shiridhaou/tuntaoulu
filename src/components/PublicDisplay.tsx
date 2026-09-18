import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trophy, FileText, Tv, Radio, Video, Rewind, QrCode, AlertTriangle, Download, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { FederationLogo } from "./FederationLogo";
import { exportReportToPdf } from "@/lib/pdfExport";
import { useCompetition } from "@/store/competition-store";
import { FullscreenToggle } from "./FullscreenToggle";
import { SessionBadge } from "@/components/SessionBadge";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import { LeaderboardModal } from "./LeaderboardModal";
import { PodiumOverlay } from "./PodiumOverlay";
import { countryFlag } from "@/lib/affiliation";


/**
 * PublicDisplay — full-screen public results screen at /public-display.
 *
 * Visual design mirrors the FinalScoreSheetModal popup so what the Chief
 * sees at PUBLISH time is exactly what the audience sees on the public TV.
 *
 * Data flow:
 *  1) Use the session code entered by the Display Join screen.
 *  2) Subscribe to current_match (athlete switches).
 *  3) Subscribe to match_results — when a row with `published = true` is
 *     written by the Chief's "VALIDATE & PUBLISH" action, reveal the
 *     full breakdown for that athlete.
 *  4) Subscribe to judge_scores so the Group A consensus codes / Group B
 *     individual scores / Group C attempts can be reconstructed even if
 *     the chief did not embed them in match_results.payload.
 */

const GOLD = "#F4C542";
const ORANGE = "#FF7A1A";
const NAVY = "#0A192F";
const GREEN = "#10B981";
const RED = "#EF4444";
const CYAN = "#22D3EE";

type AthleteRow = {
  id: string;
  full_name: string;
  bib_number: string | null;
  country: string | null;
  club: string | null;
  age_category: string | null;
  difficulty_codes: string[] | null;
  style: string | null;
  tournament_id: string | null;
};

type MatchResult = {
  id: string;
  session_code?: string;
  athlete_id: string;
  athlete_name: string | null;
  final_score: number;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  deductions: number | null;
  published: boolean;
  payload: any;
  style: string | null;
  updated_at: string;
};

type JudgeScore = {
  judge_slot: string;
  judge_role: string;
  score: number | null;
  payload: any;
};

// ── Current display session ─────────────────────────────────────────
function useActiveSession() {
  const { sessionCode } = useCompetition();
  return sessionCode;
}

// ── Live snapshot ─────────────────────────────────────────────────────
// STABILITY: the public TV screen must only re-render when the data actually
// changes. Every setter below is guarded by a value comparison, and the TA
// deduction "pulse" is computed from a ref instead of a nested setState
// (nested updaters re-ran on every render and made the screen tremble).
function sameJson(a: unknown, b: unknown): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
}

function useLiveDisplay(sessionCode: string | null) {
  const [athlete, setAthlete] = useState<AthleteRow | null>(null);
  const [judgeScores, setJudgeScores] = useState<JudgeScore[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [liveTaDeduction, setLiveTaDeduction] = useState<number>(0);
  const [liveTaPulse, setLiveTaPulse] = useState<number>(0);
  const taRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;
    let currentAthleteId: string | null = null;

    const applyTaTotal = (taTotal: number) => {
      if (cancelled || taRef.current === taTotal) return;
      taRef.current = taTotal;
      setLiveTaDeduction(taTotal);
      setLiveTaPulse((p) => p + 1);
    };

    const loadAthlete = async (athleteId: string | null) => {
      if (!athleteId) { setAthlete((prev) => (prev === null ? prev : null)); return; }
      const { data } = await supabase
        .from("athletes")
        .select("id,full_name,bib_number,country,club,age_category,difficulty_codes,style,tournament_id")
        .eq("id", athleteId)
        .maybeSingle();
      if (cancelled) return;
      const next = (data as AthleteRow) ?? null;
      setAthlete((prev) => (sameJson(prev, next) ? prev : next));
    };

    const loadJudgeScores = async (athleteId: string | null) => {
      if (!athleteId) { setJudgeScores((prev) => (prev.length === 0 ? prev : [])); return; }
      const { data } = await supabase
        .from("judge_scores")
        .select("judge_slot,judge_role,score,payload")
        .eq("session_code", sessionCode)
        .eq("athlete_id", athleteId);
      if (cancelled) return;
      const next = (data as JudgeScore[]) ?? [];
      setJudgeScores((prev) => (sameJson(prev, next) ? prev : next));
    };

    const applyResult = (next: MatchResult | null) => {
      if (cancelled) return;
      setResult((prev) => (sameJson(prev, next) ? prev : next));
    };

    const loadResult = async (athleteId: string | null) => {
      // No live athlete → nothing to reveal. Past results remain published as
      // session ranking history, so they must NOT be shown as the current one.
      if (!athleteId) {
        applyResult(null);
        return null;
      }
      const { data } = await supabase
        .from("match_results")
        .select("id,session_code,athlete_id,athlete_name,final_score,score_a,score_b,score_c,deductions,published,payload,style,updated_at")
        .eq("session_code", sessionCode)
        .eq("athlete_id", athleteId)
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      applyResult((data as MatchResult) ?? null);
      return athleteId;
    };

    // Coalesce bursts of realtime events into a single snapshot reload.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let reloading = false;

    const reloadSnapshot = async () => {
      if (reloading) return;
      reloading = true;
      try {
        const { data: cm } = await supabase
          .from("current_match")
          .select("athlete_id, ta_deductions")
          .eq("session_code", sessionCode)
          .maybeSingle();
        const currentId = cm?.athlete_id ?? null;
        const td = (cm as any)?.ta_deductions;
        applyTaTotal(td && typeof td === "object" ? Number(td.total ?? 0) : 0);
        const resultAthleteId = await loadResult(currentId);
        currentAthleteId = currentId ?? resultAthleteId;
        await Promise.all([
          loadAthlete(currentAthleteId),
          loadJudgeScores(currentAthleteId),
        ]);
      } finally {
        reloading = false;
      }
    };

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { void reloadSnapshot(); }, 250);
    };

    void reloadSnapshot();

    const ch = supabase
      .channel(`pdisplay-${sessionCode}-${Math.random().toString(36).slice(2, 6)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const row = payload.new as any;
          const td = row?.ta_deductions;
          applyTaTotal(td && typeof td === "object" ? Number(td.total ?? 0) : 0);
          scheduleReload();
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => { void loadJudgeScores(currentAthleteId); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_results", filter: `session_code=eq.${sessionCode}` },
        () => { scheduleReload(); })
      .subscribe();

    return () => {
      cancelled = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(ch);
    };
  }, [sessionCode]);

  return { athlete, judgeScores, result, liveTaDeduction, liveTaPulse };
}


// ── Live ranking among published athletes in same session ─────────────
type RankRow = { athlete_id: string; athlete_name: string | null; final_score: number };
function useLiveRanking(sessionCode: string | null) {
  const [rows, setRows] = useState<RankRow[]>([]);
  useEffect(() => {
    if (!sessionCode) { setRows([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("match_results")
        .select("athlete_id, athlete_name, final_score, updated_at")
        .eq("session_code", sessionCode)
        .eq("published", true)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      // Keep latest per athlete
      const latest = new Map<string, RankRow>();
      (data ?? []).forEach((r: any) => {
        if (!latest.has(r.athlete_id)) latest.set(r.athlete_id, {
          athlete_id: r.athlete_id, athlete_name: r.athlete_name, final_score: Number(r.final_score),
        });
      });
      const arr = Array.from(latest.values()).sort((a, b) => b.final_score - a.final_score);
      setRows(arr);
    };
    load();
    const ch = supabase
      .channel(`pd-rank-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_results", filter: `session_code=eq.${sessionCode}` },
        () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return rows;
}

// ── B trim ────────────────────────────────────────────────────────────
function bTrimRoles(scores: { slot: string; score: number }[]): Record<string, "high" | "low" | "kept" | "single"> {
  if (scores.length === 0) return {};
  // Trim high+low only with 5 or more B judges (matches the Chief dashboard);
  // with 1–4 judges every score is kept and simply averaged.
  if (scores.length < 5) {
    const out: Record<string, "single"> = {};
    scores.forEach(s => (out[s.slot] = "single"));
    return out;
  }

  const out: Record<string, "high" | "low" | "kept"> = {};
  let maxV = -Infinity, minV = Infinity;
  scores.forEach(s => { if (s.score > maxV) maxV = s.score; if (s.score < minV) minV = s.score; });
  let highTaken = false, lowTaken = false;
  scores.forEach(s => {
    if (!highTaken && s.score === maxV) { out[s.slot] = "high"; highTaken = true; return; }
    if (!lowTaken && s.score === minV) { out[s.slot] = "low"; lowTaken = true; return; }
    out[s.slot] = "kept";
  });
  return out;
}

// ── Count up ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = value;
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
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

// ── VAR broadcast flag (v1.1.4) ───────────────────────────────────────
// Mirror Chief's "Broadcast VAR to Audience" toggle by listening to
// var_broadcast_on / var_broadcast_off events on the active session.
function useVarBroadcastFlag(sessionCode: string | null) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!sessionCode) { setOn(false); return; }
    let cancelled = false;
    // Recover current state from the most recent event (in case we joined late)
    (async () => {
      const { data } = await supabase
        .from("match_events")
        .select("event_type")
        .eq("session_code", sessionCode)
        .in("event_type", ["var_broadcast_on", "var_broadcast_off"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setOn(data.event_type === "var_broadcast_on");
    })();
    const ch = supabase
      .channel(`pd-var-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const ev = (payload.new as { event_type?: string }).event_type;
          if (ev === "var_broadcast_on") setOn(true);
          else if (ev === "var_broadcast_off") setOn(false);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return on;
}

// ── Post-group completion flag (v1.6) ─────────────────────────────────
// Chief/TA marks the group COMPLETED -> public TV switches to the TOP 4
// podium view. Purely presentational: reads `match_events` only, never
// writes and never touches scoring state.
function useGroupCompleted(sessionCode: string | null) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!sessionCode) { setDone(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("match_events")
        .select("event_type")
        .eq("session_code", sessionCode)
        .in("event_type", ["group_completed", "group_reopened"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setDone(data.event_type === "group_completed");
    })();
    const ch = supabase
      .channel(`pd-group-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const ev = (payload.new as { event_type?: string }).event_type;
          if (ev === "group_completed") setDone(true);
          else if (ev === "group_reopened") setDone(false);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return done;
}

// ── Auto TOP 4 podium on session completion (read-only) ───────────────
// Detects when the LAST athlete of the group roster has a published score
// (every roster athlete of the active style is marked "done"), waits 5s so
// the audience can read the final score + CURRENT PLACING, then fades into
// the TOP 4 podium view. Stays up until a new athlete is loaded, the group
// is reopened, or the session changes. Purely presentational — no writes.
function useAutoPodium(
  sessionCode: string | null,
  athlete: AthleteRow | null,
  result: MatchResult | null,
  isPublished: boolean,
) {
  const [autoPodium, setAutoPodium] = useState(false);
  const lastAthleteRef = useRef<string | null>(null);

  // Reset when the session changes.
  useEffect(() => { setAutoPodium(false); lastAthleteRef.current = null; }, [sessionCode]);

  // Reset when a NEW athlete becomes active (TA loaded the next roster).
  useEffect(() => {
    const id = athlete?.id ?? null;
    if (id && lastAthleteRef.current && id !== lastAthleteRef.current) {
      setAutoPodium(false);
    }
    if (id) lastAthleteRef.current = id;
  }, [athlete?.id]);

  // Reset when the group is explicitly reopened.
  useEffect(() => {
    if (!sessionCode) return;
    const ch = supabase
      .channel(`pd-autopodium-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const ev = (payload.new as { event_type?: string }).event_type;
          if (ev === "group_reopened") setAutoPodium(false);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  // Session-end detector: last athlete published → 5s delay → podium.
  useEffect(() => {
    const tournamentId = athlete?.tournament_id ?? null;
    const athleteId = athlete?.id ?? null;
    if (!sessionCode || !isPublished || !athleteId || !tournamentId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const style = result?.style ?? athlete?.style ?? null;
      let q = supabase
        .from("athletes")
        .select("id,status")
        .eq("tournament_id", tournamentId);
      if (style) q = q.eq("style", style);
      const { data } = await q;
      if (cancelled || !data || data.length === 0) return;
      const roster = data as Array<{ id: string; status: string | null }>;
      const doneCount = roster.filter((a) => a.status === "done").length;
      // The just-published athlete may not be flagged "done" yet by the TA;
      // count them as done for the purpose of the completion check.
      const effectiveDone = roster.filter(
        (a) => a.status === "done" || a.id === athleteId,
      ).length;
      if (effectiveDone >= roster.length && doneCount + 1 >= roster.length) {
        timer = setTimeout(() => { if (!cancelled) setAutoPodium(true); }, 5000);
      }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [sessionCode, isPublished, athlete?.id, athlete?.tournament_id, athlete?.style, result?.style, result?.updated_at]);

  return autoPodium;
}

// ── Active VAR camera (v1.4.8) ────────────────────────────────────────
// Mirrors the AHJ "Multi-Camera Switcher". When VAR is broadcasting we show
// which physical camera is currently feeding the rolling buffer.
function useActiveVarCamera(sessionCode: string | null) {
  const [cam, setCam] = useState<{ index: number; label: string; total: number } | null>(null);
  useEffect(() => {
    if (!sessionCode) { setCam(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("match_events")
        .select("payload")
        .eq("session_code", sessionCode)
        .eq("event_type", "var_camera_switch")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.payload) {
        const p = data.payload as { index?: number; label?: string; total?: number };
        setCam({ index: p.index ?? 0, label: p.label ?? `CAM ${(p.index ?? 0) + 1}`, total: p.total ?? 1 });
      }
    })();
    const ch = supabase
      .channel(`pd-cam-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const row = payload.new as { event_type?: string; payload?: { index?: number; label?: string; total?: number } };
          if (row.event_type !== "var_camera_switch" || !row.payload) return;
          const p = row.payload;
          setCam({ index: p.index ?? 0, label: p.label ?? `CAM ${(p.index ?? 0) + 1}`, total: p.total ?? 1 });
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return cam;
}

// ── Optional video feed URL from current_match.payload.video_url ──────
function useLiveVideoUrl(sessionCode: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionCode) { setUrl(null); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("current_match").select("payload")
        .eq("session_code", sessionCode).maybeSingle();
      if (cancelled) return;
      const v = (data?.payload as { video_url?: unknown } | null)?.video_url;
      setUrl(typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
    };
    load();
    const ch = supabase
      .channel(`pd-cm-vid-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const v = (payload.new as { payload?: { video_url?: unknown } })?.payload?.video_url;
          setUrl(typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);
  return url;
}

// ── AHJ verified clips for VAR broadcast (v1.2.1) ─────────────────────
// Pulls all `ahj_clip_verified` events for the active session/athlete and
// returns them as a chronological playlist of mistake clips for public airing.
export type AhjPublicClip = {
  id: string;
  url: string;
  label: string;
  code: string;
  value: number;
  createdAt: number;
};
function useVerifiedClips(sessionCode: string | null, athleteId: string | null) {
  const [clips, setClips] = useState<AhjPublicClip[]>([]);
  useEffect(() => {
    setClips([]);
    if (!sessionCode) return;
    let cancelled = false;
    const ingest = (rows: Array<{ id: string; payload: Record<string, unknown> | null; created_at: string }>) => {
      const next: AhjPublicClip[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        const p = r.payload ?? {};
        const url = typeof p.clipUrl === "string" ? p.clipUrl : null;
        if (!url) continue;
        if (athleteId && p.athleteId && p.athleteId !== athleteId) continue;
        const id = String(p.clipId ?? r.id);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push({
          id,
          url,
          label: String(p.deductionLabel ?? p.deductionCode ?? "خطأ"),
          code: String(p.deductionCode ?? ""),
          value: Number(p.value ?? 0),
          createdAt: new Date(r.created_at).getTime(),
        });
      }
      next.sort((a, b) => a.createdAt - b.createdAt);
      if (!cancelled) setClips(next);
    };
    (async () => {
      const { data } = await supabase
        .from("match_events")
        .select("id, payload, created_at")
        .eq("session_code", sessionCode)
        .eq("event_type", "ahj_clip_verified")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) ingest(data as never);
    })();
    const ch = supabase
      .channel(`pd-clips-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const row = payload.new as { event_type: string; id: string; payload: Record<string, unknown> | null; created_at: string };
          if (row.event_type !== "ahj_clip_verified") return;
          const p = row.payload ?? {};
          const url = typeof p.clipUrl === "string" ? p.clipUrl : null;
          if (!url) return;
          if (athleteId && p.athleteId && p.athleteId !== athleteId) return;
          const id = String(p.clipId ?? row.id);
          setClips((prev) => prev.some((c) => c.id === id) ? prev : [...prev, {
            id, url,
            label: String(p.deductionLabel ?? p.deductionCode ?? "خطأ"),
            code: String(p.deductionCode ?? ""),
            value: Number(p.value ?? 0),
            createdAt: new Date(row.created_at).getTime(),
          }].sort((a, b) => a.createdAt - b.createdAt));
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode, athleteId]);
  return clips;
}

// ── VAR Broadcast View (v1.2.1) ───────────────────────────────────────
// Full-screen public airing of AHJ verified clips (with live stream fallback).
function VarBroadcastView({
  sessionCode,
  athleteName,
  liveVideoUrl,
  clips,
}: {
  sessionCode: string;
  athleteName: string | null;
  liveVideoUrl: string | null;
  clips: AhjPublicClip[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeCam = useActiveVarCamera(sessionCode);

  // Auto-jump to newly-arrived clip (only if user is not actively browsing)
  useEffect(() => {
    if (clips.length > 0 && activeIdx >= clips.length) setActiveIdx(clips.length - 1);
  }, [clips.length, activeIdx]);

  const activeClip = clips[activeIdx] ?? null;
  const sourceUrl = liveVideoUrl ?? activeClip?.url ?? null;
  const showingLive = !!liveVideoUrl;

  return (
    <div className="h-screen w-screen text-white relative overflow-hidden flex flex-col"
      style={{ background: `radial-gradient(circle at 30% 20%, ${ORANGE}22, transparent 60%), ${NAVY}` }}>
      <header className="px-8 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
        <FederationLogo size="md" />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40">
            <Radio className="h-3.5 w-3.5 text-orange-300 animate-pulse" />
            <span className="text-[10px] font-heading font-black tracking-[0.3em] text-orange-200">VAR LIVE</span>
          </span>
          {activeCam && activeCam.total > 1 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/90 text-black border border-orange-300 shadow-[0_0_10px_rgba(255,140,0,0.6)]">
              <Video className="h-3 w-3" />
              <span className="text-[10px] font-heading font-black tracking-[0.25em]" dir="ltr">
                CAM {activeCam.index + 1} / {activeCam.total}
              </span>
            </span>
          )}
          {!showingLive && clips.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-heading font-black tracking-[0.2em]">
              CLIP {activeIdx + 1} / {clips.length}
            </span>
          )}
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Session</p>
            <p className="text-lg font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">{sessionCode}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-2 p-2 min-h-0">
        {/* Main video stage */}
        <div className="relative bg-black/90 rounded-2xl flex flex-col items-center justify-center overflow-hidden border border-white/10">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-heading font-black text-white tracking-[0.25em]">
              {showingLive ? "LIVE · VAR" : "REPLAY · VAR"}
            </span>
          </div>
          {!showingLive && activeClip && (
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
              <span className="px-3 py-1 rounded-full bg-orange-500/90 text-black text-[11px] font-heading font-black tracking-wider">
                {activeClip.code || "خطأ"} · −{activeClip.value.toFixed(3)}
              </span>
              <span className="px-3 py-1 rounded bg-black/70 text-white text-[11px] font-body">
                {activeClip.label}
              </span>
            </div>
          )}
          {sourceUrl ? (
            <video
              ref={videoRef}
              key={sourceUrl}
              src={sourceUrl}
              autoPlay
              muted
              playsInline
              controls
              onEnded={() => {
                if (!showingLive && activeIdx < clips.length - 1) setActiveIdx(activeIdx + 1);
              }}
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6">
              <Video className="h-16 w-16 mb-4 text-white/30" />
              <p className="text-base font-heading font-black tracking-[0.2em] text-white/80">في انتظار لقطات VAR</p>
              <p className="mt-2 text-sm text-white/50 max-w-md">
                لم يتم تأكيد أي لقطة من المساعد بعد. سيتم بثها هنا فور تأكيدها.
              </p>
            </div>
          )}
        </div>

        {/* Clip list / playlist */}
        {!showingLive && (
          <aside className="bg-black/40 rounded-2xl border border-white/10 p-3 flex flex-col min-h-0">
            <h2 className="text-[11px] font-heading font-black tracking-[0.25em] text-white/70 mb-2 px-1">
              لقطات الأخطاء ({clips.length})
            </h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {clips.length === 0 && (
                <p className="text-xs text-white/40 px-1 py-4 text-center">لا توجد لقطات بعد</p>
              )}
              {clips.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full text-right p-2 rounded-lg border transition-all ${
                    i === activeIdx
                      ? "bg-orange-500/30 border-orange-400/60"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-heading font-black text-orange-300" dir="ltr">
                      #{i + 1} · −{c.value.toFixed(3)}
                    </span>
                    <span className="text-[10px] font-heading font-black text-white/80" dir="ltr">{c.code}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/70 font-body line-clamp-2">{c.label}</p>
                </button>
              ))}
            </div>
          </aside>
        )}
      </main>

      <footer className="px-8 py-2 border-t border-white/10 text-center shrink-0">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">
          Video Assistant Referee — مراجعة الفيديو
        </p>
        {athleteName && <p className="mt-0.5 text-sm text-white/70 font-heading font-bold">{athleteName}</p>}
      </footer>
      <FullscreenToggle />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────
export function PublicDisplay() {
  const sessionCode = useActiveSession();
  const [standingsOpen, setStandingsOpen] = useState(false);
  useRoomPresence(sessionCode, { role: "display" });

  const { athlete, judgeScores, result, liveTaDeduction, liveTaPulse } = useLiveDisplay(sessionCode);
  const varLive = useVarBroadcastFlag(sessionCode);
  const liveVideoUrl = useLiveVideoUrl(sessionCode);
  const ahjClips = useVerifiedClips(sessionCode, athlete?.id ?? null);
  const ranking = useLiveRanking(sessionCode);
  const groupCompleted = useGroupCompleted(sessionCode);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isPublished = !!result?.published;
  const autoPodium = useAutoPodium(sessionCode, athlete, result, isPublished);
  const matchMode: "compulsory" | "optional" = (result?.payload?.match_mode as any) ?? "optional";
  const finalScore = Number(result?.final_score ?? 0);
  const animated = useCountUp(isPublished ? finalScore : 0);
  const reportUrl = athlete ? `${origin || ""}/public-report/${athlete.id}` : "";

  // Live rank for current athlete
  const currentRank = useMemo(() => {
    if (!athlete?.id || ranking.length === 0) return null;
    const idx = ranking.findIndex(r => r.athlete_id === athlete.id);
    return idx >= 0 ? { rank: idx + 1, total: ranking.length } : null;
  }, [athlete?.id, ranking]);

  // CURRENT PLACING — live rank of the published score against strictly
  // finished (published) athletes of this group. Display only.
  const currentPlacing = useMemo(() => {
    const activeAthleteId = result?.athlete_id ?? athlete?.id;
    if (!activeAthleteId || !isPublished) return null;
    // Rank against EVERY scored athlete of this session (full history), not
    // just the currently published row.
    const others = ranking.filter(r => r.athlete_id !== activeAthleteId);
    const ahead = others.filter(r => r.final_score > finalScore).length;
    return { rank: ahead + 1, total: others.length + 1 };
  }, [result?.athlete_id, athlete?.id, isPublished, ranking, finalScore]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      await exportReportToPdf(reportRef.current, athlete?.full_name ?? "athlete");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!athlete?.id) return;
    const url = reportUrl || `/public-report/${athlete.id}`;
    const text = `🥋 ${athlete?.full_name ?? ""} — Score: ${finalScore.toFixed(3)}\n${url}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "Wushu Report", text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* user cancelled */ }
  };

  // Group A: confirmed codes — threshold adapts to active A-judge count.
  // With <3 active A-judges, ≥1 judge confirms a code (so it always shows).
  // With ≥3 active A-judges, the IWUF rule (≥2 judges) applies.
  const { confirmedCodes, flaggedCodes } = useMemo(() => {
    const aJudges = judgeScores.filter(j => j.judge_role === "A" || j.judge_slot.startsWith("A"));
    const activeAJudgeCount = new Set(aJudges.map(j => j.judge_slot)).size;
    const threshold = activeAJudgeCount >= 3 ? 2 : 1;
    const counter = new Map<string, Set<string>>();
    aJudges.forEach(j => {
      const codes: string[] = Array.isArray(j.payload?.codes) ? j.payload.codes : [];
      codes.forEach(c => {
        if (!counter.has(c)) counter.set(c, new Set());
        counter.get(c)!.add(j.judge_slot);
      });
    });
    const confirmed: { code: string; count: number; slots: string[] }[] = [];
    const flagged: { code: string; slot: string }[] = [];
    counter.forEach((slots, code) => {
      const arr = Array.from(slots);
      if (arr.length >= threshold) confirmed.push({ code, count: arr.length, slots: arr });
      else flagged.push({ code, slot: arr[0] });
    });
    confirmed.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    flagged.sort((a, b) => a.code.localeCompare(b.code));
    return { confirmedCodes: confirmed, flaggedCodes: flagged };
  }, [judgeScores]);

  // Group B individual scores + roles
  const bIndividual = useMemo(() => {
    const bs = judgeScores
      .filter(j => (j.judge_role === "B" || j.judge_slot.startsWith("B")) && j.score !== null)
      .map(j => ({ slot: j.judge_slot, score: Number(j.score) }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
    const roles = bTrimRoles(bs);
    return bs.map(b => ({ slot: b.slot, score: b.score, role: roles[b.slot] }));
  }, [judgeScores]);

  // Group C movements (attempt majority)
  const cMovements = useMemo(() => {
    const codes = athlete?.difficulty_codes ?? [];
    const success = new Map<string, number>();
    const total = new Map<string, number>();
    judgeScores
      .filter(j => j.judge_role === "C" || j.judge_slot.startsWith("C"))
      .forEach(j => {
        const attempts = j.payload?.attempts ?? [];
        if (Array.isArray(attempts)) {
          attempts.forEach((a: any) => {
            const k = a.code ?? "";
            if (!k) return;
            total.set(k, (total.get(k) ?? 0) + 1);
            if (a.successful) success.set(k, (success.get(k) ?? 0) + 1);
          });
        }
      });
    return codes.map(code => {
      const t = total.get(code) ?? 0;
      const s = success.get(code) ?? 0;
      const ok = t > 0 ? s >= Math.ceil(t / 2) : null;
      return { code, success: ok };
    });
  }, [athlete, judgeScores]);

  const groupAScore = result?.score_a ?? 0;
  const groupBAvg = result?.score_b ?? 0;
  const groupCScore = result?.score_c ?? 0;
  const chiefDeduction = Number(result?.payload?.chief_deduction ?? 0);
  const choreoDeduction = Number(result?.payload?.choreo_deduction ?? 0);
  const choreoCodes = (Array.isArray(result?.payload?.choreo_codes)
    ? result?.payload?.choreo_codes
    : []) as { code: string; value: number }[];
  // Prefer the live TA deduction broadcast (current_match.ta_deductions) so the
  // public TV reflects every +/- the TA presses without waiting for publish.
  const publishedTaDeduction = Number(result?.payload?.ta_deduction ?? result?.deductions ?? 0);
  const taDed = liveTaDeduction > 0 ? liveTaDeduction : publishedTaDeduction;
  void liveTaPulse; // referenced to silence lint; pulse used in JSX via key
  const taOob = result?.payload?.ta_oob_count ?? 0;
  const payloadBIndividual = Array.isArray(result?.payload?.b_individual) ? result.payload.b_individual : [];
  const displayBIndividual: { slot: string; score: number; role: "high" | "low" | "kept" | "single" }[] = bIndividual.length > 0
    ? bIndividual
    : payloadBIndividual
        .filter((b: any) => typeof b?.slot === "string" && b?.score !== null && b?.score !== undefined)
        .map((b: any) => ({
          slot: String(b.slot),
          score: Number(b.score),
          role: (b.role === "high" || b.role === "low" || b.role === "kept" || b.role === "single") ? b.role : "single",
        }));
  const payloadConfirmedCodes = Array.isArray(result?.payload?.confirmed_codes) ? result.payload.confirmed_codes : [];
  const displayConfirmedCodes: { code: string; count: number; slots: string[] }[] = confirmedCodes.length > 0
    ? confirmedCodes
    : payloadConfirmedCodes
        .filter((c: any) => typeof c?.code === "string")
        .map((c: any) => ({ code: String(c.code), count: Number(c.count ?? 1), slots: Array.isArray(c.slots) ? c.slots.map(String) : [] }));
  const payloadFlaggedCodes = Array.isArray(result?.payload?.flagged_codes) ? result.payload.flagged_codes : [];
  const displayFlaggedCodes: { code: string; slot: string }[] = flaggedCodes.length > 0
    ? flaggedCodes
    : payloadFlaggedCodes
        .filter((f: any) => typeof f?.code === "string")
        .map((f: any) => ({ code: String(f.code), slot: String(f.slot ?? "") }));
  const payloadCMovements = Array.isArray(result?.payload?.c_movements) ? result.payload.c_movements : [];
  const displayCMovements: { code: string; success: boolean | null }[] = cMovements.length > 0
    ? cMovements
    : payloadCMovements
        .filter((m: any) => typeof m?.code === "string")
        .map((m: any) => ({ code: String(m.code), success: typeof m.successful === "boolean" ? m.successful : typeof m.success === "boolean" ? m.success : null }));

  // ── No session ─────────────────────────────────────────
  if (!sessionCode) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center text-white" style={{ background: NAVY }}>
        <FederationLogo size="lg" />
        <p className="mt-6 text-lg font-heading font-bold tracking-widest">NO ACTIVE SESSION</p>
        <p className="mt-1 text-sm text-white/50">في انتظار بدء جلسة من الحكم الرئيسي</p>
        <FullscreenToggle />
      </div>
    );
  }

  // ── POST-GROUP TOP 4 PODIUM (read-only overlay) ─────────
  // Stays on screen until the group is reopened or a new session starts.
  if (groupCompleted || autoPodium) {
    return (
      <div className="h-screen w-screen relative overflow-hidden" style={{ background: NAVY }}>
        <PodiumOverlay
          sessionCode={sessionCode}
          open
          styleFilter={result?.style ?? athlete?.style ?? null}
        />
        <FullscreenToggle />
      </div>
    );
  }

  // ── VAR LIVE BROADCAST (v1.2.1) ─────────────────────────
  // When the Chief flips "Broadcast VAR to Audience", the public TV airs the
  // AHJ-verified mistake clips as a playlist (so the audience and a protesting
  // coach can review the exact moments judges flagged). If a live HLS/MP4
  // stream URL is configured on current_match.payload.video_url, that takes
  // priority; otherwise the playlist plays clip-by-clip.
  if (varLive) {
    return <VarBroadcastView
      sessionCode={sessionCode}
      athleteName={athlete?.full_name ?? null}
      liveVideoUrl={liveVideoUrl}
      clips={ahjClips}
    />;
  }

  // ── Waiting for athlete ────────────────────────────────
  if (!athlete) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center text-white relative overflow-hidden"
        style={{ background: `radial-gradient(circle at 20% 20%, ${ORANGE}1A, transparent 60%), radial-gradient(circle at 80% 80%, ${GOLD}10, transparent 55%), ${NAVY}` }}>
        <FederationLogo size="lg" />
        <Loader2 className="h-8 w-8 mt-6 animate-spin" style={{ color: GOLD }} />
        <p className="mt-3 text-2xl font-heading font-black tracking-[0.3em] text-white/80">WAITING FOR ATHLETE</p>
        <p className="mt-2 text-sm text-white/50">الجلسة: <span className="font-mono tabular-nums" dir="ltr">{sessionCode}</span></p>
        <FullscreenToggle />
      </div>
    );
  }

  // ── Athlete called, not yet published — LIVE judging view ──
  if (!isPublished) {
    // Live aggregations (best-effort, mirror Chief)
    const liveBs = bIndividual; // already computed above
    const liveBAvg = (() => {
      const kept = liveBs.filter(b => b.role === "kept" || b.role === "single").map(b => b.score);
      if (kept.length === 0) return 0;
      return kept.reduce((s, v) => s + v, 0) / kept.length;
    })();
    const liveAs = judgeScores
      .filter(j => (j.judge_role === "A" || j.judge_slot.startsWith("A")) && j.score !== null)
      .map(j => ({ slot: j.judge_slot, score: Number(j.score) }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
    const liveAAvg = liveAs.length === 0 ? 0 : liveAs.reduce((s, v) => s + v.score, 0) / liveAs.length;
    const liveCs = judgeScores
      .filter(j => (j.judge_role === "C" || j.judge_slot.startsWith("C")) && j.score !== null)
      .map(j => ({ slot: j.judge_slot, score: Number(j.score) }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
    const liveCAvg = liveCs.length === 0 ? 0 : liveCs.reduce((s, v) => s + v.score, 0) / liveCs.length;
    const liveTotal = liveAAvg + liveBAvg + liveCAvg;

    return (
      <div className="h-screen w-screen text-white relative overflow-hidden"
        style={{ background: `radial-gradient(circle at 20% 20%, ${ORANGE}1A, transparent 60%), ${NAVY}` }}>
        <header className="px-8 py-4 flex items-center justify-between border-b border-white/10">
          <FederationLogo size="md" />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40">
              <Loader2 className="h-3 w-3 text-orange-300 animate-spin" />
              <span className="text-[10px] font-heading font-black tracking-[0.3em] text-orange-200">LIVE</span>
            </span>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 font-body">Session</p>
              <p className="text-xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">{sessionCode}</p>
            </div>
          </div>
        </header>
        <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-5">
          {/* Athlete + running total */}
          <section className="rounded-3xl border p-6 backdrop-blur-md"
            style={{ borderColor: `${GOLD}55`, background: `${GOLD}06` }}>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.4em] text-white/50 mb-2">Now Performing</p>
                <h1 className="text-3xl md:text-5xl font-heading font-black text-white tracking-wide">{athlete.full_name}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-body" dir="ltr">
                  {athlete.bib_number && <span className="px-2 py-1 rounded border border-white/20 bg-white/5">BIB #{athlete.bib_number}</span>}
                  {athlete.country && <span className="px-2 py-1 rounded border" style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }}>{athlete.country}</span>}
                  {athlete.club && <span className="px-2 py-1 rounded border border-white/10 bg-white/5">{athlete.club}</span>}
                  {athlete.age_category && <span className="px-2 py-1 rounded border border-white/10 bg-white/5">{athlete.age_category}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs md:text-sm uppercase tracking-[0.4em] text-white/60 font-body font-bold">Live Total</p>
                <p
                  key={`live-total-${liveTaPulse}`}
                  className="text-7xl md:text-8xl lg:text-9xl font-heading font-black tabular-nums leading-none mt-2"
                  style={{ color: "#FACC15", textShadow: "none" }} dir="ltr">
                  {Math.max(0, liveTotal).toFixed(3)}
                </p>
                {taDed > 0 && (
                  <p className="text-base md:text-lg font-heading font-black tabular-nums mt-1 ta-pulse"
                     style={{ color: RED, textShadow: `0 0 18px ${RED}99` }} dir="ltr"
                     key={`live-ta-${liveTaPulse}`}>
                    − TA {taDed.toFixed(3)}
                  </p>
                )}
                <p className="text-[10px] text-white/40 mt-1">In progress · Awaiting Chief publish</p>
              </div>
            </div>
          </section>

          {/* Live A panel */}
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-heading font-black tracking-[0.4em] text-emerald-400">GROUP A · QUALITY (LIVE)</p>
              <p className="text-2xl font-heading font-black tabular-nums" style={{ color: "#22c55e" }} dir="ltr">
                {liveAAvg.toFixed(3)} <span className="text-sm text-white/40">/ 5.000</span>
              </p>
            </div>
            {liveAs.length === 0 ? (
              <p className="text-[12px] text-white/40 italic">— في انتظار قضاة A —</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {liveAs.map(a => (
                  <div key={a.slot} className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
                    <p className="text-[11px] font-heading font-black text-white/85" dir="ltr">{a.slot}</p>
                    <p className="text-lg font-heading font-black tabular-nums text-emerald-300" dir="ltr">{a.score.toFixed(3)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Live B panel */}
          <section className="rounded-2xl border p-5" style={{ borderColor: `${GOLD}40`, background: `${GOLD}08` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-heading font-black tracking-[0.4em]" style={{ color: GOLD }}>GROUP B · PERFORMANCE (LIVE)</p>
              <p className="text-2xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
                {liveBAvg.toFixed(3)} <span className="text-sm text-white/40">/ 3.000</span>
              </p>
            </div>
            {liveBs.length === 0 ? (
              <p className="text-[12px] text-white/40 italic">— في انتظار قضاة B —</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {liveBs.map(b => {
                  const dropped = b.role === "high" || b.role === "low";
                  const color = dropped ? RED : b.role === "kept" ? GREEN : "#9ca3af";
                  return (
                    <div key={b.slot} className="rounded-xl border px-3 py-2 flex items-center justify-between"
                      style={{ borderColor: `${color}66`, background: `${color}12` }}>
                      <div>
                        <p className="text-[11px] font-heading font-black text-white/85" dir="ltr">{b.slot}</p>
                        <p className="text-[9px] uppercase tracking-wider" style={{ color }}>
                          {dropped ? `Drop (${b.role})` : b.role === "kept" ? "Counted" : "Single"}
                        </p>
                      </div>
                      <p className="text-lg font-heading font-black tabular-nums" style={{ color }} dir="ltr">{b.score.toFixed(3)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Live C panel */}
          {matchMode === "optional" && (
            <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.04] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-heading font-black tracking-[0.4em]" style={{ color: CYAN }}>GROUP C · DIFFICULTY (LIVE)</p>
                <p className="text-2xl font-heading font-black tabular-nums" style={{ color: CYAN }} dir="ltr">
                  {liveCAvg.toFixed(3)} <span className="text-sm text-white/40">/ 2.000</span>
                </p>
              </div>
              {liveCs.length === 0 ? (
                <p className="text-[12px] text-white/40 italic">— في انتظار قضاة C —</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {liveCs.map(c => (
                    <div key={c.slot} className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 flex items-center justify-between">
                      <p className="text-[11px] font-heading font-black text-white/85" dir="ltr">{c.slot}</p>
                      <p className="text-lg font-heading font-black tabular-nums text-cyan-300" dir="ltr">{c.score.toFixed(3)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <p className="text-center text-[10px] text-white/40 tracking-[0.3em]">
            JUDGING IN PROGRESS — في انتظار اعتماد النتيجة من الحكم الرئيسي
          </p>
        </main>
        <FullscreenToggle />
      </div>
    );
  }

  // ── Published — full sheet view ────────────────────────
  return (
    <div className="h-screen w-screen text-white relative overflow-hidden"
      style={{ background: `radial-gradient(circle at 20% 10%, ${ORANGE}22, transparent 60%), radial-gradient(circle at 80% 90%, ${GOLD}10, transparent 55%), ${NAVY}` }}>
      {/* Header bar */}
      <header className="px-8 py-3 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <FederationLogo size="md" />
          <div className="hidden md:block">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Tunisian Wushu</p>
            <p className="text-sm font-heading font-black text-white tracking-wider">CHAMPIONSHIPS 2024</p>
          </div>
          <SessionBadge code={sessionCode} />
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded text-[10px] font-heading font-black tracking-wider border"
            style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }}>
            {matchMode.toUpperCase()}
          </span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            <Tv className="h-3 w-3" />
            <span className="text-[10px] font-heading font-black tracking-[0.25em]">PUBLISHED · LIVE</span>
          </div>
        </div>
      </header>

      <main ref={reportRef} className="px-4 md:px-6 py-5 max-w-7xl mx-auto grid gap-4 md:grid-cols-[1fr_360px]">
        {/* ── LEFT: Athlete hero · Final score · TA · QR ── */}
        <div className="space-y-4 min-w-0">
          {/* Athlete + Final score hero */}
          <section className="rounded-3xl border p-6 backdrop-blur-md"
            style={{ borderColor: `${GOLD}66`, background: `${GOLD}08`, boxShadow: `0 0 60px ${ORANGE}33` }}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {athlete.bib_number && (
                <span className="px-2 py-1 rounded text-[10px] font-heading font-black tabular-nums border border-white/20 bg-white/5 text-white/70" dir="ltr">
                  BIB #{athlete.bib_number}
                </span>
              )}
              {athlete.country && (
                <span className="px-2 py-1 rounded text-[10px] font-heading font-black border" style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }} dir="ltr">
                  {countryFlag(athlete.country) ? `${countryFlag(athlete.country)} ` : ""}{athlete.country}
                </span>
              )}

              {currentRank && (
                <span className="px-2 py-1 rounded text-[10px] font-heading font-black border inline-flex items-center gap-1" style={{ borderColor: `${GOLD}88`, color: GOLD, background: `${GOLD}15` }} dir="ltr">
                  <Trophy className="h-3 w-3" /> RANK #{currentRank.rank} / {currentRank.total}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-black text-white tracking-wide truncate">
              {athlete.full_name}
            </h1>
            <p className="mt-1 text-[12px] text-white/60 font-body truncate" dir="ltr">
              {[athlete.club, athlete.age_category, result?.style ?? athlete.style].filter(Boolean).join("  ·  ") || "—"}
            </p>
            <div className="mt-5 flex items-end justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/50 font-body">Final Score</p>
              <p className="text-7xl md:text-8xl font-heading font-black tabular-nums leading-none text-yellow-400"
                style={{ color: "#FACC15", textShadow: "none" }} dir="ltr">
                {animated.toFixed(3)}
              </p>
            </div>
            {/* Official IWUF-style placing block: always visible for a published result. */}
            <div className="mt-5 flex justify-start" dir="ltr">
              <div className="inline-flex min-w-[220px] items-center justify-between gap-5 rounded-xl border px-4 py-3"
                style={{ borderColor: `${GOLD}88`, background: `${GOLD}12` }}>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] font-heading font-black text-white/75">
                    Current Placing
                  </p>
                  <p className="mt-1 text-[9px] tracking-[0.2em] text-white/40">
                    OF {currentPlacing?.total ?? Math.max(1, ranking.length)}
                  </p>
                </div>
                <span className="text-5xl font-heading font-black tabular-nums leading-none"
                  style={{ color: GOLD }}>
                  {currentPlacing?.rank ?? 1}
                </span>
              </div>
            </div>
          </section>

          {/* TA + Final calculation */}
          <section className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-4">
              <p className="text-[11px] font-heading font-black tracking-[0.4em] text-red-400 mb-2">TA · DEDUCTIONS</p>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-[11px] uppercase tracking-wider text-white/50 font-body">Out of Bounds</span>
                <span className="text-base font-heading font-black tabular-nums text-white" dir="ltr">{taOob}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] uppercase tracking-wider text-white/50 font-body">Total deduction</span>
                <span className="text-base font-heading font-black tabular-nums" style={{ color: RED }} dir="ltr">− {taDed.toFixed(3)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-[11px] font-heading font-black tracking-[0.4em] text-white/70 mb-2">FINAL CALCULATION</p>
              <Row label="Group A" value={groupAScore.toFixed(3)} color="#22c55e" />
              <Row label="Group B (avg)" value={groupBAvg.toFixed(3)} color={GOLD} />
              {matchMode === "optional" && <Row label="Group C" value={groupCScore.toFixed(3)} color={CYAN} />}
              <Row label="TA deduction" value={`− ${taDed.toFixed(3)}`} color={RED} />
              <Row label="Chief Judge deduction · HD" value={`− ${chiefDeduction.toFixed(3)}`} color={RED} />
              {choreoDeduction > 0 && (
                <Row
                  label={`Choreography · CD${choreoCodes.length ? ` (${choreoCodes.map((d) => d.code).join(", ")})` : ""}`}
                  value={`− ${choreoDeduction.toFixed(3)}`}
                  color={RED}
                />
              )}
              <div className="mt-2 pt-2 border-t border-white/15 flex items-center justify-between">
                <span className="text-xs font-heading font-black tracking-wider text-white">FINAL</span>
                <span className="text-3xl font-heading font-black tabular-nums" style={{ color: ORANGE, textShadow: `0 0 16px ${ORANGE}80` }} dir="ltr">
                  {finalScore.toFixed(3)}
                </span>
              </div>
            </div>
          </section>

          {/* QR + Download/Share — links to public AI report for this athlete */}
          {athlete && (
            <section className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="h-4 w-4" style={{ color: GOLD }} />
                  <p className="text-[11px] font-heading font-black tracking-[0.3em]" style={{ color: GOLD }}>SMART REPORT · AI INSIGHTS</p>
                </div>
                <p className="text-[12px] text-white/60 font-body">
                  امسح الرمز لعرض تقرير الذكاء الاصطناعي الكامل لهذا الرياضي على هاتفك.
                </p>
                <p className="text-[10px] text-white/40 mt-1 font-body" dir="ltr">
                  Scan to open the full AI performance report on your phone.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={handleDownloadPdf} disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-heading font-black tracking-[0.2em] hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: `${GOLD}66`, color: GOLD }}>
                    {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                  <button onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-heading font-black tracking-[0.2em] hover:bg-white/5"
                    style={{ borderColor: `${ORANGE}66`, color: ORANGE }}>
                    <Share2 className="h-3 w-3" /> SHARE
                  </button>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl shrink-0" title="Athlete AI Report">
                <QRCodeSVG
                  value={reportUrl || `/public-report/${athlete.id}`}
                  size={120}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </section>
          )}

          {/* Live Ranking Strip */}
          {ranking.length > 0 && (
            <section className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4" style={{ color: GOLD }} />
                <p className="text-[11px] font-heading font-black tracking-[0.3em]" style={{ color: GOLD }}>LIVE RANKING · الترتيب المباشر</p>
              </div>
              <div className="space-y-1">
                {ranking.slice(0, 5).map((r, i) => {
                  const isCurrent = r.athlete_id === athlete?.id;
                  return (
                    <div key={r.athlete_id}
                      className={`flex items-center justify-between rounded-lg px-3 py-1.5 border ${isCurrent ? "" : "border-white/10 bg-white/[0.02]"}`}
                      style={isCurrent ? { borderColor: `${ORANGE}88`, background: `${ORANGE}15` } : undefined}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-heading font-black tabular-nums w-6"
                          style={{ color: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#d97706" : "rgba(255,255,255,0.6)" }} dir="ltr">
                          #{i + 1}
                        </span>
                        <span className="text-xs font-heading font-bold text-white truncate">{r.athlete_name ?? "—"}</span>
                      </div>
                      <span className="text-sm font-heading font-black tabular-nums" style={{ color: isCurrent ? ORANGE : "#fff" }} dir="ltr">
                        {r.final_score.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>

        {/* ── RIGHT: Three judge mini-screens (IWUF-style) ── */}
        <aside className="space-y-3">
          {/* GROUP A · QUALITY — circles for confirmed deduction codes */}
          <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-transparent p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-heading font-black tracking-[0.3em] text-emerald-300">GROUP A · QM</p>
              <p className="text-2xl font-heading font-black tabular-nums leading-none" style={{ color: "#22c55e", textShadow: "0 0 12px rgba(34,197,94,0.6)" }} dir="ltr">
                {groupAScore.toFixed(3)}
              </p>
            </div>
            {displayConfirmedCodes.length === 0 ? (
              <p className="text-[10px] text-white/40 italic">— لا أخطاء —</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayConfirmedCodes.flatMap(c =>
                  Array.from({ length: c.count }, (_, i) => (
                    <span
                      key={`${c.code}-${i}`}
                      title={`${c.code} · ${c.slots.join(", ")}`}
                      className="inline-flex items-center justify-center h-7 min-w-[2rem] px-1.5 rounded-full text-[10px] font-heading font-black tabular-nums border-2"
                      style={{
                        borderColor: "#ef4444",
                        background: "rgba(239,68,68,0.12)",
                        color: "#fca5a5",
                      }}
                      dir="ltr"
                    >
                      {c.code}
                    </span>
                  ))
                )}
              </div>
            )}
            {displayFlaggedCodes.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <p className="text-[8px] uppercase tracking-wider text-white/40 mb-1">Flagged</p>
                <div className="flex flex-wrap gap-1">
                  {displayFlaggedCodes.map((f, i) => (
                    <span key={`${f.code}-${i}`}
                      className="px-1.5 py-0 rounded text-[9px] font-bold tabular-nums border line-through opacity-60"
                      style={{ borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }} dir="ltr">
                      {f.code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* GROUP B · PERFORMANCE — average on top, individual scores below */}
          <section className="rounded-2xl border p-3.5"
            style={{ borderColor: `${GOLD}55`, background: `linear-gradient(135deg, ${GOLD}1A, transparent)` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-heading font-black tracking-[0.3em]" style={{ color: GOLD }}>GROUP B · OB</p>
              <p className="text-2xl font-heading font-black tabular-nums leading-none" style={{ color: GOLD, textShadow: `0 0 12px ${GOLD}99` }} dir="ltr">
                {groupBAvg.toFixed(3)}
              </p>
            </div>
            {displayBIndividual.length === 0 ? (
              <p className="text-[10px] text-white/40 italic">— لا إرسالات —</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {displayBIndividual.map(b => {
                  const dropped = b.role === "high" || b.role === "low";
                  const color = dropped ? RED : b.role === "kept" ? GREEN : "#9ca3af";
                  return (
                    <div key={b.slot}
                      title={`${b.slot} · ${dropped ? `Dropped ${b.role}` : b.role}`}
                      className="rounded-md px-2 py-1 text-center min-w-[3rem]"
                      style={{ background: `${color}1A`, border: `1px solid ${color}66` }}>
                      <p className="text-[8px] uppercase tracking-wider opacity-70 leading-none" style={{ color }} dir="ltr">{b.slot}</p>
                      <p className="text-base font-heading font-black tabular-nums leading-tight mt-0.5" style={{ color }} dir="ltr">
                        {b.score.toFixed(3)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[8px] text-white/35 mt-1.5 text-center" dir="ltr">drop high+low · avg kept</p>
          </section>

          {/* GROUP C · DIFFICULTY — numbered movement attempts */}
          {matchMode === "optional" && (
            <section className="rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 to-transparent p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-heading font-black tracking-[0.3em]" style={{ color: CYAN }}>GROUP C · DD</p>
                <p className="text-2xl font-heading font-black tabular-nums leading-none" style={{ color: CYAN, textShadow: `0 0 12px ${CYAN}99` }} dir="ltr">
                  {groupCScore.toFixed(3)}
                </p>
              </div>
              {displayCMovements.length === 0 ? (
                <p className="text-[10px] text-white/40 italic">— لا حركات —</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {displayCMovements.map((m, i) => {
                    const ok = m.success === true;
                    const fail = m.success === false;
                    const color = ok ? GREEN : fail ? RED : "#9ca3af";
                    return (
                      <span key={`${m.code}-${i}`}
                        title={ok ? "Success" : fail ? "Failed" : "Pending"}
                        className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-1.5 rounded-full text-[10px] font-heading font-black tabular-nums border"
                        style={{
                          borderColor: `${color}99`,
                          background: `${color}1A`,
                          color,
                        }}
                        dir="ltr">
                        <span className={fail ? "line-through" : ""}>{i + 1}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </aside>
      </main>
      {/* STANDINGS — read-only ranked leaderboard overlay */}
      <button
        onClick={() => setStandingsOpen(true)}
        title="الترتيب العام · Standings"
        className="fixed bottom-4 left-4 z-[110] h-10 px-4 rounded-full border flex items-center gap-2 font-heading font-black text-[11px] tracking-[0.2em]"
        style={{ background: `${GOLD}18`, borderColor: `${GOLD}88`, color: GOLD, backdropFilter: "blur(8px)" }}
      >
        <Trophy className="h-4 w-4" /> STANDINGS
      </button>
      <LeaderboardModal
        sessionCode={sessionCode}
        open={standingsOpen}
        onClose={() => setStandingsOpen(false)}
      />
      <FullscreenToggle />

    </div>
  );
}

function Row({ label, value, color = "#fff" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5">
      <span className="text-[11px] uppercase tracking-wider text-white/50 font-body">{label}</span>
      <span className="text-sm font-heading font-black tabular-nums" style={{ color }} dir="ltr">{value}</span>
    </div>
  );
}

// Imports referenced for tree-shaking safety
void Trophy; void FileText;
