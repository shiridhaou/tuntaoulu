import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { sendResultWebhook } from "@/lib/resultsWebhook";
import { Link } from "@tanstack/react-router";
import { useCompetition, STYLE_CONFIGS, type CompetitionStyle } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";

import { FederationLogo } from "./FederationLogo";
import { RoomReadyWidget } from "@/components/RoomReadyWidget";
import { AiAssistantSidebar } from "./AiAssistantSidebar";
// QrCommitModal replaced by FinalScoreSheetModal
import { WaitingSidebar } from "./WaitingSidebar";
import { VideoEvidenceIndicator } from "./VideoEvidenceIndicator";
import { ConsensusCodesPanel } from "./ConsensusCodesPanel";
import { FinalScoreSheetModal } from "./FinalScoreSheetModal";
import { LeaderboardModal } from "./LeaderboardModal";
import { countryFlag } from "@/lib/affiliation";

import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useMatchSync, broadcastSessionState } from "@/hooks/useMatchSync";
import { joinSessionMembership } from "@/lib/sessionMembership";
import { toast } from "sonner";
import { styleLabelAr, styleLabelEn, normalizeStyle } from "@/lib/styleNames";
import { TIME_WINDOWS, fmtWindow, type TimeWindow } from "@/lib/timeRules";
import { modeCaps } from "@/lib/matchMode";
import { computeGroupAConsensus } from "@/lib/groupAConsensus";
import { useGroupAConsensus } from "@/hooks/useGroupAConsensus";
import { roundScore } from "@/lib/numFormat";
import { CHOREO_CODES, lookupChoreoCode } from "@/lib/choreographyCodes";

import { pushDisplaySettings, uploadSponsorLogo } from "@/hooks/useDisplaySettings";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  ArrowRight, Bot, Play, Pause, RotateCcw, Wifi, Copy, CheckCircle, Trophy,
  Tv, Sparkles, X, AlertTriangle, Activity, Pencil, Menu, Users, Settings, UserCog,
  FileText, ListChecks, Radio, RefreshCw, Loader2,
} from "lucide-react";

const STYLES: { id: CompetitionStyle; label: string }[] = [
  { id: "changquan", label: "Changquan" },
  { id: "nanquan", label: "Nanquan" },
  { id: "taijiquan", label: "Taijiquan" },
  { id: "traditional", label: "Traditional" },
];

type BTrimRole = "high" | "low" | "kept";
type GroupKey = "A" | "B" | "C";

type JudgeSlot = {
  key: string;
  label: string;
  group: GroupKey;
  online: boolean;
  score: number | null;
  bRole?: BTrimRole;
  submitted?: boolean;
};

const ORANGE = "#FF7A1A";
const GOLD = "#F4C542";

export function ChiefRefereeDashboard() {
  // Wrap in a local ErrorBoundary so a crash in any sub-panel cannot bubble up
  // to the router's global "Something went wrong" screen and lock out the Chief.
  // The Chief is the session owner — they should never be kicked out.
  return (
    <ErrorBoundary label="ChiefRefereeDashboard">
      <ChiefRefereeDashboardInner />
    </ErrorBoundary>
  );
}

function ChiefRefereeDashboardInner() {
  const {
    competitionStyle, setCompetitionStyle, athletes, setSelectedRole,
    judgeAScore, judgeBScores, judgeCScore, finalScore,
    scoreRevealed, setScoreRevealed,
    sessionCode, generateSessionCode, currentAthleteIndex, setCurrentAthleteIndex,
    joinRequests, approvedJudges,
    team,
    judgeOverrides, setJudgeOverride,
    submittedSlots,
    marqueeText, setMarqueeText, sponsorLogos, addSponsorLogo, removeSponsorLogo,
    leaderboardMode, setLeaderboardMode, commitCurrentResult, getLeaderboard, clearResults,
    isVarLiveOnPublic, setIsVarLiveOnPublic,
    resetJudgeADeductions, resetJudgeBScores, resetJudgeCAttempts,
    resetMovementSequence, clearSuggestedDeductions,
  } = useCompetition();
  const logout = useLogout();


  // EMERGENCY SESSION GENERATION: Chief is the session owner — if for any reason
  // we land on the dashboard with no sessionCode, generate one immediately so the
  // header always has a code to display/share. Never block the UI on this.
  useEffect(() => {
    if (!sessionCode) {
      try { generateSessionCode(); } catch (e) { console.warn("[CHIEF] auto-generate session failed", e); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer is MIRRORED from TA via useMatchSync — Chief no longer drives it.
  const timerSync = useMatchSync(sessionCode);
  const timerElapsed = timerSync.elapsedSec;
  const timerRunning = timerSync.timerState === "running";

  const [aiOpen, setAiOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingJudge, setEditingJudge] = useState<JudgeSlot | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupKey | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [contentSheetOpen, setContentSheetOpen] = useState(false);
  const [standingsOpen, setStandingsOpen] = useState(false);
  // Post-group podium flag: display-only signal for the public screen.
  const [groupCompleted, setGroupCompleted] = useState(false);
  const toggleGroupCompleted = async () => {
    if (!sessionCode) return;
    const next = !groupCompleted;
    setGroupCompleted(next);
    await supabase.from("match_events").insert({
      session_code: sessionCode,
      event_type: next ? "group_completed" : "group_reopened",
      payload: { at: Date.now() } as never,
    });
  };

  const [matchMode, setMatchMode] = useState<"compulsory" | "optional">("optional");
  const [taDeduction, setTaDeduction] = useState<number>(0);
  const [taOobCount, setTaOobCount] = useState<number>(0);
  const [taPulse, setTaPulse] = useState<number>(0); // increments on every TA deduction change for visual pulse
  const [chiefDeduction, setChiefDeduction] = useState<number>(0);
  const [chiefDeductionDraft, setChiefDeductionDraft] = useState("0.000");
  // Choreography / content deductions (codes 80–86) applied by the Chief Judge.
  const [choreoApplied, setChoreoApplied] = useState<{ code: string; value: number; label: string }[]>([]);
  const [choreoDraft, setChoreoDraft] = useState("");
  // Chief manual override — unlocks COMPUTE FINAL / PUBLISH when a group cannot submit.
  const [forceUnlock, setForceUnlock] = useState(false);
  // Dynamic style: the TA's broadcast style (timerSync.style) is authoritative —
  // the local competitionStyle is only a fallback. This drives BOTH the score
  // caps and the performance-time window so Taiji athletes are never compared
  // against the hardcoded 1:20 Changquan target.
  const activeStyle = normalizeStyle(timerSync.style ?? competitionStyle ?? "changquan");
  const config = STYLE_CONFIGS[activeStyle] ?? STYLE_CONFIGS.changquan;
  const timeWindow: TimeWindow = TIME_WINDOWS[activeStyle] ?? TIME_WINDOWS.changquan;
  // Official caps: Compulsory A 7.00 + B 3.00 = 10.00 · Optional A 5.00 + B 3.00 + C 2.00 = 10.00
  const caps = modeCaps(matchMode);
  const effMaxA = caps.maxA;
  const effMaxB = caps.maxB;
  const effMaxC = caps.maxC;
  const selectedAthlete = athletes[currentAthleteIndex];
  // Metadata pushed by the TA in the MATCH_STATE_CHANGE payload — used as an
  // instant fallback so the name bar flips off "waiting" even before the local
  // athlete list has mirrored the row.
  const syncAthleteMeta = (timerSync.payload as Record<string, any> | null)?.activeAthlete
    ?? (timerSync.payload as Record<string, any> | null)?.athlete ?? null;
  const currentAthlete = timerSync.athleteId
    ? athletes.find((athlete) => athlete.id === timerSync.athleteId)
      ?? (syncAthleteMeta
        ? {
            id: timerSync.athleteId,
            name: String(syncAthleteMeta.name ?? "—"),
            country: String(syncAthleteMeta.country ?? "—"),
            category: String(syncAthleteMeta.category ?? ""),
            order: currentAthleteIndex + 1,
          }
        : selectedAthlete)
    : null;
  const hasActiveAthlete = Boolean(timerSync.athleteId);

  // Group A consensus (IWUF): only codes recorded by ≥2 Group A judges count.
  const groupAConsensus = useGroupAConsensus(sessionCode, currentAthlete?.id ?? null, effMaxA);


  const waitingCount = joinRequests.filter(r => r.status === "waiting").length;

  // [CHIEF SYNC] Log every payload received from current_match — also logs the
  // key in-component state so we can pinpoint which variable is undefined if a
  // future render crashes.
  useEffect(() => {
    console.log("[CHIEF SYNC] mount/update", {
      sessionCode,
      athleteId: timerSync.athleteId,
      timerState: timerSync.timerState,
      elapsedSec: timerSync.elapsedSec,
      style: timerSync.style,
      competitionStyle,
      athletesCount: athletes?.length ?? 0,
      currentAthleteIndex,
      hasCurrentAthlete: Boolean(currentAthlete),
      teamConfig: team,
    });
  }, [sessionCode, timerSync.athleteId, timerSync.timerState, timerSync.elapsedSec, timerSync.style, competitionStyle, athletes, currentAthleteIndex, currentAthlete, team]);

  // Manual sync — force fresh pull from current_match + judge_scores
  const [manualSyncing, setManualSyncing] = useState(false);
  const handleManualSync = async () => {
    if (!sessionCode) return;
    setManualSyncing(true);
    try {
      const [cm, js] = await Promise.all([
        supabase.from("current_match").select("*").eq("session_code", sessionCode).maybeSingle(),
        supabase.from("judge_scores").select("*").eq("session_code", sessionCode),
      ]);
      console.log("[CHIEF MANUAL SYNC] current_match:", cm.data, "judge_scores:", js.data);
    } catch (e) {
      console.error("[CHIEF MANUAL SYNC] failed", e);
    } finally {
      setTimeout(() => setManualSyncing(false), 500);
    }
  };

  // Auto-generate a session code on first mount if missing — the Chief Dashboard
  // is the SOURCE of the session code; without it no other panel can join.
  useEffect(() => {
    if (!sessionCode) {
      console.log("[CHIEF SYNC] No session_code — auto-generating");
      generateSessionCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle fallback flag: TA has not called any athlete
  const isIdleNoAthlete = !hasActiveAthlete;

  // Timer ticks come from useMatchSync (TA is master). Chief is read-only.

  // Subscribe to current_match: extract Match Mode AND ta_deductions live so
  // OOB / time deductions from the Technical Assistant flow into the Chief's
  // Final Total the instant they are applied (no need for "Sync" press).
  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;
    const applyRow = (row: any) => {
      const mode = row?.payload?.match_mode;
      if (mode === "compulsory" || mode === "optional") setMatchMode(mode);
      const td = row?.ta_deductions;
      if (td && typeof td === "object") {
        const newTotal = Number(td.total ?? 0);
        const newOob = Number(td?.oob?.count ?? 0);
        setTaDeduction((prev) => {
          if (prev !== newTotal) setTaPulse((p) => p + 1);
          return newTotal;
        });
        setTaOobCount(newOob);
      }
    };
    const load = async () => {
      const { data } = await supabase
        .from("current_match")
        .select("payload, ta_deductions")
        .eq("session_code", sessionCode)
        .maybeSingle();
      if (cancelled) return;
      applyRow(data);
    };
    load();
    const ch = supabase
      .channel(`chief-cm-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        (payload) => applyRow(payload.new))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);

  // Legacy: also keep listening to ta_sync events as a backup (older clients)
  useEffect(() => {
    if (!sessionCode) return;
    const ch = supabase
      .channel(`chief-ev-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const ev = payload.new as any;
          if (ev?.event_type === "ta_sync") {
            const oobDed = Number(ev.payload?.oob_deduction ?? 0);
            const timeDed = Number(ev.payload?.time_deduction ?? 0);
            const total = Math.round((oobDed + timeDed) * 10) / 10;
            setTaDeduction((prev) => { if (prev !== total) setTaPulse((p) => p + 1); return total; });
            setTaOobCount(Number(ev.payload?.oob_count ?? 0));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  // Reset TA deductions when athlete changes
  useEffect(() => {
    setTaDeduction(0);
    setTaOobCount(0);
    setChiefDeduction(0);
    setChiefDeductionDraft("0.000");
    setChoreoApplied([]);
    setChoreoDraft("");
  }, [currentAthlete?.id]);

  const applyChiefDeduction = (value: number) => {
    const next = roundScore(Math.max(0, Number.isFinite(value) ? value : 0));
    setChiefDeduction(next);
    setChiefDeductionDraft(next.toFixed(3));
  };

  /** Apply a choreography code (80–86). Duplicates are rejected. */
  const applyChoreoCode = (raw: string) => {
    const entry = lookupChoreoCode(raw);
    if (!entry) {
      toast.error(`رمز غير معروف: ${raw} — الرموز المتاحة 80 إلى 86`);
      return;
    }
    let duplicate = false;
    setChoreoApplied((prev) => {
      if (prev.some((d) => d.code === entry.code)) { duplicate = true; return prev; }
      return [...prev, { code: entry.code, value: entry.value, label: entry.labelAr }];
    });
    setChoreoDraft("");
    if (duplicate) toast.info(`الرمز ${entry.code} مطبّق مسبقًا`);
    else toast.success(`${entry.code} · −${entry.value.toFixed(3)} — ${entry.labelAr}`);
  };

  const removeChoreoCode = (code: string) => {
    setChoreoApplied((prev) => prev.filter((d) => d.code !== code));
  };

  // Setup gate handled by parent ChiefRefereeDashboard wrapper.

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const handleCopySession = () => {
    if (!sessionCode) return;
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const openCastWindow = () => {
    // Green CAST button → opens the SAME smart AI report that the QR on the
    // Public Display points to, so the Chief can review/print exactly what the
    // athlete sees on their phone.
    const aid = currentAthlete?.id;
    const url = aid ? `/public-report/${aid}` : "/public-display";
    window.open(url, "wushu_smart_report", "width=480,height=900,noopener");
  };

  /* HARD RESET — NEXT ATHLETE must leave nothing behind: Chief-local deductions,
     every group's local state, and the per-session caches in localStorage.
     Prevents Group C (or A/B) from pre-filling with a previous athlete's draft. */
  const hardResetForNextAthlete = () => {
    setScoreRevealed(false);
    setTaDeduction(0);
    setTaOobCount(0);
    setChiefDeduction(0);
    setChiefDeductionDraft("0.000");
    setChoreoApplied([]);
    setChoreoDraft("");
    setForceUnlock(false);
    resetJudgeADeductions();
    resetJudgeBScores();
    resetJudgeCAttempts();
    resetMovementSequence();
    clearSuggestedDeductions();
    if (typeof window !== "undefined") {
      try {
        const kill = ["judge", "score", "difficulty", "attempt", "deduction", "movement"];
        Object.keys(window.localStorage)
          .filter(k => kill.some(t => k.toLowerCase().includes(t)))
          .forEach(k => window.localStorage.removeItem(k));
      } catch (e) { console.warn("[CHIEF] local cache wipe failed", e); }
    }
  };

  // ── Publish current scores to the Public Display in real time ─────────────
  // Used by the green CAST button (header) and the "SEND TO PUBLIC" button (footer).
  // Inserts/updates a `match_results` row with `published=true` so PublicDisplay
  // (which subscribes to match_results) reveals the final score immediately.
  const [publishingLive, setPublishingLive] = useState(false);
  const publishToPublic = async (opts: { openWindow?: boolean } = {}) => {
    if (!sessionCode || !currentAthlete?.id) {
      if (opts.openWindow) openCastWindow();
      return;
    }
    setPublishingLive(true);
    try {
      const { data: scoreRows } = await supabase
        .from("judge_scores")
        .select("judge_slot,judge_role,score,payload")
        .eq("session_code", sessionCode)
        .eq("athlete_id", currentAthlete.id);
      const rows = (scoreRows ?? []) as { judge_slot: string; judge_role: string; score: number | null; payload: any }[];
      const consensus = computeGroupAConsensus(rows as never, effMaxA, { athleteId: currentAthlete.id });
      const confirmed_codes = consensus.confirmed.map(c => ({ code: c.code, count: c.count, slots: c.slots }));
      const flagged_codes = consensus.flagged.map(f => ({ code: f.code, slot: f.slot }));

      const liveBRows = rows.filter(r => (r.judge_role === "B" || r.judge_slot.startsWith("B")) && r.score !== null);
      const b_individual = liveBRows.length > 0
        ? liveBRows.sort((a, b) => a.judge_slot.localeCompare(b.judge_slot)).map(r => ({
          slot: r.judge_slot,
          score: Number(r.score),
          role: (bRoles[r.judge_slot] ?? "single") as "high" | "low" | "kept" | "single",
        }))
        : bIndividualScores;
      const cSuccess = new Map<string, number>();
      const cTotal = new Map<string, number>();
      rows.filter(r => r.judge_role === "C" || r.judge_slot.startsWith("C")).forEach(r => {
        const attempts = Array.isArray(r.payload?.attempts) ? r.payload.attempts : [];
        attempts.forEach((a: any) => {
          if (!a?.code) return;
          cTotal.set(a.code, (cTotal.get(a.code) ?? 0) + 1);
          if (a.successful) cSuccess.set(a.code, (cSuccess.get(a.code) ?? 0) + 1);
        });
      });
      const sheet = currentAthlete.difficultySheet ?? [];
      const cCodes = sheet.length > 0 ? sheet.map(m => m.code) : Array.from(cTotal.keys());
      const c_movements = cCodes.map(code => {
        const meta = sheet.find(m => m.code === code);
        const total = cTotal.get(code) ?? 0;
        const success = cSuccess.get(code) ?? 0;
        return {
          code,
          label: meta?.label ?? code,
          connection: meta?.connection ?? "—",
          value: meta?.value ?? 0,
          successful: total > 0 ? success >= Math.ceil(total / 2) : null,
        };
      });
      // Guarantee this device is registered as the chief seat before writing —
      // results-write permission is derived from the stored session role.
      await joinSessionMembership(sessionCode, "chief");
      await supabase
        .from("match_results")
        .delete()
        .eq("session_code", sessionCode)
        .eq("athlete_id", currentAthlete.id);
      const { error: publishError } = await supabase.from("match_results").insert({
        session_code: sessionCode,
        athlete_id: currentAthlete.id,
        athlete_name: currentAthlete.name,
        style: competitionStyle,
        score_a: groupATotal,
        score_b: groupBNet,
        score_c: matchMode === "optional" ? groupCTotal : null,
        deductions: roundScore(taDeduction + chiefDeduction + choreoTotal),
        final_score: aggregateFinal,
        published: true,
        payload: {
          match_mode: matchMode,
          confirmed_codes,
          flagged_codes,
          b_individual,
          c_movements,
          ta_oob_count: taOobCount,
          ta_deduction: roundScore(taDeduction),
          chief_deduction: chiefDeduction,
          choreo_deduction: choreoTotal,
          choreo_codes: choreoApplied,
          total_external_deduction: roundScore(taDeduction + chiefDeduction + choreoTotal),
          committed_at: Date.now(),
        } as never,
      });
      if (publishError) throw publishError;

      // Instant push to every connected screen (public display included) so the
      // final score appears without waiting on postgres replication.
      void broadcastSessionState(sessionCode, {
        athlete_id: currentAthlete.id,
        style: competitionStyle,
        payload: {
          published_result: {
            athlete_id: currentAthlete.id,
            athlete_name: currentAthlete.name,
            score_a: groupATotal,
            score_b: groupBNet,
            score_c: matchMode === "optional" ? groupCTotal : null,
            deductions: roundScore(taDeduction + chiefDeduction + choreoTotal),
            ta_deduction: roundScore(taDeduction),
            chief_deduction: chiefDeduction,
            choreo_deduction: choreoTotal,
            choreo_codes: choreoApplied,
            final_score: aggregateFinal,
            status: "PUBLISHED",
            published_at: Date.now(),
          },
        },
      });
      await supabase.from("match_events").insert({
        session_code: sessionCode,
        event_type: "score_published",
        payload: {
          athlete_id: currentAthlete.id,
          final_score: aggregateFinal,
          chief_deduction: chiefDeduction,
          choreo_deduction: choreoTotal,
          choreo_codes: choreoApplied,
        } as never,
      });
      setScoreRevealed(true);
      commitCurrentResult();

      // External results export (federation site / broadcast overlay).
      void sendResultWebhook(sessionCode, {
        tournamentId: sessionCode,
        athleteName: currentAthlete.name,
        team: currentAthlete.country ?? null,
        style: competitionStyle,
        difficultyScore: matchMode === "optional" ? groupCTotal : null,
        deductionScore: roundScore(taDeduction + chiefDeduction + choreoTotal),
        finalScore: aggregateFinal,
        timestamp: new Date().toISOString(),
      });
      toast.success("تم نشر النتيجة على شاشة العرض");
    } catch (e) {
      console.error("[CHIEF PUBLISH] failed", e);
      toast.error(`فشل نشر النتيجة: ${(e as { message?: string })?.message ?? "خطأ غير معروف"}`);
    } finally {
      setPublishingLive(false);
      if (opts.openWindow) openCastWindow();
    }
  };

  // IWUF 2024 · Art. 26 — single-bound styles (CQ/NQ: ≥ 1:20) flag "Time Up"
  // once the required minimum is reached; windowed styles (Taiji 3:00–4:00,
  // Traditional 1:00–1:30) only flag when the MAXIMUM is exceeded. An athlete
  // inside the legal window is never flagged.
  const singleBound = timeWindow.min === timeWindow.max;
  const timeUp = singleBound
    ? timerElapsed >= timeWindow.min
    : timerElapsed > timeWindow.max;

  const scoreFor = (key: string, baseScore: number | null): number | null => {
    const o = judgeOverrides[key];
    return o !== undefined && o !== null ? o : baseScore;
  };

  // A B slot counts as active when it is assigned OR it has actually produced a
  // score (formal submission / live push / chief override). Requiring only the
  // assignment made B_avg collapse to 0.000 whenever a judge scored from an
  // unassigned seat.
  const isBActive = (key: string) => {
    const o = judgeOverrides[key];
    return approvedJudges.includes(key) || submittedSlots.includes(key) || typeof o === "number";
  };

  // B trim roles — over the first numB B-judges that are active
  const bRoles: Record<string, BTrimRole> = useMemo(() => {
    const bs: { key: string; v: number }[] = [];
    for (let i = 0; i < team.numB; i++) {
      const k = `B${i + 1}`;
      if (!isBActive(k)) continue;
      const v = scoreFor(k, judgeBScores[i] ?? null);
      if (v !== null) bs.push({ key: k, v });
    }
    const out: Record<string, BTrimRole> = {};
    if (bs.length < 5) { bs.forEach(b => (out[b.key] = "kept")); return out; }
    let maxV = -Infinity, minV = Infinity;
    bs.forEach(b => { if (b.v > maxV) maxV = b.v; if (b.v < minV) minV = b.v; });
    let highTaken = false, lowTaken = false;
    bs.forEach(b => {
      if (!highTaken && b.v === maxV) { out[b.key] = "high"; highTaken = true; return; }
      if (!lowTaken && b.v === minV) { out[b.key] = "low"; lowTaken = true; return; }
      out[b.key] = "kept";
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgeBScores, judgeOverrides, approvedJudges, submittedSlots, team.numB]);


  // Per-slot live scores: A & C judges submit their own final score per slot.
  // The provider stores each submission in `judgeOverrides[slotKey]` from
  // judge_scores realtime — so for A/C we read directly from there per-slot
  // (NOT from the chief-local `judgeAScore`/`judgeCScore` which are derived
  // from chief's local deductions/attempts and would otherwise stay stuck
  // at the configured maxA / 0).
  // Extra slots that actually produced a submission but fall outside the
  // configured team size (e.g. a C4 judge while numC = 3). Without this the top
  // group card stayed at 0.00 while the raw submissions list showed the score.
  const extraSlotsFor = (prefix: "A" | "C", count: number) => {
    const seen = new Set<string>([...Object.keys(judgeOverrides), ...submittedSlots]);
    return Array.from(seen)
      .filter((k) => {
        const m = /^([ABC])(\d+)$/.exec(k);
        if (!m || m[1] !== prefix) return false;
        return Number(m[2]) > count;
      })
      .sort((a, b) => a.localeCompare(b));
  };

  const judges: JudgeSlot[] = [
    ...[
      ...Array.from({ length: team.numA }, (_, i) => `A${i + 1}`),
      ...extraSlotsFor("A", team.numA),
    ].map((k) => {
      const live = judgeOverrides[k];
      return { key: k, label: k, group: "A" as GroupKey, online: approvedJudges.includes(k), score: (live === undefined ? null : live), submitted: submittedSlots.includes(k) };
    }),
    ...Array.from({ length: team.numB }, (_, i) => {
      const k = `B${i + 1}`;
      return { key: k, label: k, group: "B" as GroupKey, online: approvedJudges.includes(k), score: scoreFor(k, judgeBScores[i] ?? null), bRole: bRoles[k], submitted: submittedSlots.includes(k) };
    }),
    ...[
      ...Array.from({ length: team.numC }, (_, i) => `C${i + 1}`),
      ...extraSlotsFor("C", team.numC),
    ].map((k) => {
      const live = judgeOverrides[k];
      return { key: k, label: k, group: "C" as GroupKey, online: approvedJudges.includes(k), score: (live === undefined ? null : live), submitted: submittedSlots.includes(k) };
    }),
  ];

  const groupA = judges.filter(j => j.group === "A");
  const groupB = judges.filter(j => j.group === "B");
  const groupC = judges.filter(j => j.group === "C");

  // Group summaries — Group A applies the consensus rule (a code counts only
  // when ≥2 A judges recorded it); the per-slot average is the fallback when no
  // code payloads are available.
  const aSubmitted = groupA.filter(j => typeof j.score === "number").map(j => j.score as number);
  const aAverage = aSubmitted.length
    ? roundScore(aSubmitted.reduce((s, v) => s + v, 0) / aSubmitted.length)
    : 0;
  const groupATotal = groupAConsensus.score ?? aAverage;

  const bKept = groupB.filter(j => j.bRole === "kept" && j.score !== null).map(j => j.score as number);
  const groupBNet = bKept.length ? roundScore(bKept.reduce((s, v) => s + v, 0) / bKept.length) : 0;
  const cSubmitted = groupC.filter(j => typeof j.score === "number").map(j => j.score as number);
  const groupCTotal = cSubmitted.length
    ? roundScore(cSubmitted.reduce((s, v) => s + v, 0) / cSubmitted.length)
    : 0;

  // Group A already arrives net of its own deductions. The only deduction
  // applied after A+B+C here is the explicit Chief Judge deduction.
  // Difficulty counts whenever the C judges actually evaluated the routine,
  // even if the mode flag from the TA has not flipped to "optional" yet.
  const cContrib = matchMode === "optional" || cSubmitted.length > 0 ? groupCTotal : 0;
  const choreoTotal = roundScore(choreoApplied.reduce((s, d) => s + d.value, 0));
  const aggregateFinal = roundScore(
    Math.max(0, groupATotal + groupBNet + cContrib - chiefDeduction - choreoTotal),
  );
  // Show real aggregates whenever ANY judge has submitted — even if TA hasn't
  // formally "called" the athlete via current_match.athlete_id yet. This fixes
  // the case where group totals + final stay at 0.00 despite scores arriving.
  const hasAnySubmission = aSubmitted.length > 0 || bKept.length > 0 || cSubmitted.length > 0;
  const showLive = hasActiveAthlete || hasAnySubmission;
  const displayGroupATotal = showLive ? groupATotal : 0;
  const displayGroupBNet = showLive ? groupBNet : 0;
  const displayGroupCTotal = showLive ? groupCTotal : 0;
  const displayTaDeduction = showLive ? taDeduction : 0;
  const displayAggregateFinal = showLive ? aggregateFinal : 0;
  const scoreVisible = scoreRevealed || !showLive;

  // Per-judge B breakdown for the score sheet (slot/score/role)
  const bIndividualScores = groupB.map(j => ({
    slot: j.label,
    score: j.score,
    role: (j.bRole ?? (j.online ? "single" : "single")) as "high" | "low" | "kept" | "single",
  }));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col text-white relative" style={{ background: "#050505" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl" style={{ background: `${ORANGE}1A` }} />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl" style={{ background: `${ORANGE}10` }} />
      </div>

      <RoomReadyWidget sessionCode={sessionCode} me={{ role: "chief" }} />

      {/* HEADER */}
      <header className="relative z-10 h-14 backdrop-blur-xl bg-white/[0.02] border-b border-white/10 px-4 flex items-center shrink-0">
        <div className="w-full grid grid-cols-3 items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedRole(null)}
              className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <ArrowRight className="h-4 w-4" />
            </button>
            <FederationLogo size="sm" />
            <div className="leading-tight hidden sm:block">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-body">Tunisian Wushu</p>
              <p className="text-xs font-heading font-black text-white">CHAMPIONSHIPS 2024</p>
            </div>
            <div className="hidden md:flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full border" style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}66` }}>
              <Trophy className="h-3 w-3" style={{ color: ORANGE }} />
              <span className="text-[9px] font-heading font-bold tracking-wider" style={{ color: ORANGE }}>CHIEF</span>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] font-heading font-black tabular-nums text-white/60" dir="ltr">
                #{String(currentAthleteIndex + 1).padStart(4, "0")}
              </span>
              <span className="px-1.5 py-0 rounded text-[9px] font-heading font-bold border" style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}40`, color: ORANGE }} dir="ltr">
                {countryFlag(currentAthlete?.country) ? `${countryFlag(currentAthlete?.country)} ` : ""}
                {currentAthlete?.country || "---"}
              </span>
              {currentAthlete?.club && (
                <span className="px-1.5 py-0 rounded text-[9px] font-heading font-bold border border-white/15 bg-white/5 text-white/70 truncate max-w-[160px]">
                  {currentAthlete.club}
                </span>
              )}

              <h1 className="text-base md:text-lg font-heading font-black leading-none truncate" style={{ color: GOLD }}>
                {currentAthlete?.name || "بانتظار مناداة اللاعب"}
              </h1>
              {currentAthlete && (
                <button
                  onClick={() => setContentSheetOpen(true)}
                  title="عرض ورقة المحتوى · View Content Sheet"
                  className="flex items-center gap-1 h-6 px-2 rounded-full border bg-white/5 hover:bg-white/10 transition-all"
                  style={{ borderColor: `${GOLD}66`, color: GOLD }}
                >
                  <FileText className="h-3 w-3" />
                  <span className="text-[9px] font-heading font-bold tracking-wider">SHEET</span>
                </button>
              )}
            </div>
              <p className="text-[10px] text-white/50 font-heading font-bold tracking-[0.2em] mt-0.5" dir="ltr">
               {timerSync.style || competitionStyle
                 ? `${styleLabelEn(timerSync.style ?? competitionStyle)} · ${styleLabelAr(timerSync.style ?? competitionStyle)}`
                 : currentAthlete?.category || "Waiting for Athlete"}
            </p>
          </div>

          {/* RIGHT — only live-critical actions. Session code, CAST, VAR broadcast
              and system status now live in the slide-over control panel. */}
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setStandingsOpen(true)}
              title="الترتيب العام · Standings"
              className="h-8 px-3 rounded-full border flex items-center gap-1.5 font-heading font-black text-[10px] tracking-[0.2em] transition-all"
              style={{ background: `${GOLD}15`, borderColor: `${GOLD}88`, color: GOLD }}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>STANDINGS</span>
            </button>
            <button onClick={() => setTeamPanelOpen(true)} title="إدارة الفريق · Team Management"
              className="relative h-8 w-8 rounded-full border flex items-center justify-center transition-all"
              style={{ background: `${GOLD}1A`, borderColor: `${GOLD}66`, color: GOLD }}>
              <UserCog className="h-4 w-4" />
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-heading font-black flex items-center justify-center animate-pulse">
                  {waitingCount}
                </span>
              )}
            </button>
            <button onClick={() => setDrawerOpen(true)} title="لوحة التحكم · Control panel"
              className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={logout} className="text-[10px] text-white/40 hover:text-white/80 font-body transition-colors px-1">
              خروج
            </button>
          </div>
        </div>
      </header>

      {/* TIMER STRIP — slim (v1.1.5) */}
      <div className="relative z-10 px-4 pt-2 shrink-0">
        <div className="flex items-center justify-between gap-4 px-4 py-1.5 rounded-xl bg-white/[0.03] border" style={{ borderColor: `${ORANGE}44`, boxShadow: `0 0 18px ${ORANGE}15` }}>
          <div className="flex items-center gap-2">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-body">Performance</p>
            <p className="text-[10px] text-white/40 font-body" dir="ltr">/ {fmtWindow(timeWindow)}</p>
          </div>
          <p className={`text-2xl font-heading font-black tabular-nums leading-none ${timeUp ? "animate-pulse" : ""}`}
            style={{ color: timeUp ? "#ff3b3b" : ORANGE }} dir="ltr">
            {fmtTime(timerElapsed)}
          </p>
          <div className="text-[9px] uppercase tracking-[0.3em] font-body text-white/40">
            {scoreRevealed ? "Locked" : timeUp ? "Time Up" : timerRunning ? "Live" : "Ready"}
          </div>
        </div>
      </div>

      {/* IDLE STATUS PILL — small, non-intrusive. Dashboard layout (judge dots, controls) stays fully visible. */}
      {isIdleNoAthlete && (
        <div className="relative z-10 px-4 pt-2 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px]"
            style={{ background: `${GOLD}10`, borderColor: `${GOLD}40`, color: GOLD }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-heading font-bold tracking-wider">WAITING FOR TA · NO ATHLETE CALLED</span>
            <span className="text-white/40 font-body" dir="ltr">· Session {sessionCode}</span>
            <button onClick={handleManualSync} disabled={manualSyncing} className="ml-1 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${manualSyncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* MAIN — Command Center grid + giant FINAL TOTAL */}
      <section className="relative z-10 flex-1 px-4 py-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
        <div className={`grid ${matchMode === "compulsory" ? "grid-cols-2" : "grid-cols-3"} gap-3 shrink-0`} style={{ minHeight: "240px" }}>
          <GroupColumn
            name="GROUP A"
            subtitle="Quality"
            color="#22c55e"
            summary={displayGroupATotal}
            summaryLabel={`/ ${effMaxA.toFixed(2)}`}
            revealed={showLive}
            judges={groupA}
            timerRunning={timerRunning}
            onOpen={() => setGroupDetail("A")}
          />
          <GroupColumn
            name="GROUP B"
            subtitle="Performance · (B1+B2+B3)/3"
            color={GOLD}
            summary={displayGroupBNet}
            summaryLabel={`/ ${effMaxB.toFixed(2)}`}
            revealed={showLive}
            judges={groupB}
            timerRunning={timerRunning}
            onOpen={() => setGroupDetail("B")}
          />
          {(matchMode === "optional" || cSubmitted.length > 0) && (
            <GroupColumn
              name="GROUP C"
              subtitle="Difficulty"
              color="#22d3ee"
              summary={displayGroupCTotal}
              summaryLabel={`/ ${effMaxC.toFixed(2)}`}
              revealed={showLive}
              judges={groupC}
              timerRunning={timerRunning}
              onOpen={() => setGroupDetail("C")}
            />
          )}
        </div>

        {/* Consensus codes (Group A — codes confirmed by ≥2 judges) */}
        <ConsensusCodesPanel sessionCode={sessionCode} athleteId={currentAthlete?.id ?? null} maxA={effMaxA} />

        {/* RAW judge submissions — full transparency for chief */}
        <RawJudgesBreakdown
          sessionCode={sessionCode}
          athleteId={currentAthlete?.id ?? null}
          bRoles={bRoles}
        />

        {/* AGGREGATOR — calculation table */}
        {(() => {
          const cContrib = matchMode === "optional" ? displayGroupCTotal : 0;
          const subtotal = displayGroupATotal + displayGroupBNet + cContrib;
          const aggregateFinal = roundScore(Math.max(0, subtotal - chiefDeduction - choreoTotal));
          const maxTotal = effMaxA + effMaxB + (matchMode === "optional" ? effMaxC : 0);
          const formula = matchMode === "optional"
            ? "A + B(avg) + C − HD − CD"
            : "A + B(avg) − HD − CD";
          return (
            <div className="rounded-3xl border backdrop-blur-xl px-6 py-3 shrink-0"
              style={{
                borderColor: scoreVisible ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
                background: scoreVisible ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                boxShadow: scoreVisible ? "0 0 60px rgba(255,255,255,0.25), inset 0 0 40px rgba(244,197,66,0.08)" : "none",
              }}>
              {/* 3-column grid prevents overlap between breakdown / final score / max */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/50 font-body">Final Total</p>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-heading font-black tracking-wider border"
                      style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }}>
                      {matchMode.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 font-body" dir="ltr">{formula}</p>

                  {/* breakdown grid */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-heading tabular-nums" dir="ltr">
                    <span className="text-emerald-400">A {displayGroupATotal.toFixed(2)}</span>
                    <span className="text-white/30">+</span>
                    <span style={{ color: GOLD }}>B {displayGroupBNet.toFixed(2)}</span>
                    {(matchMode === "optional" || cSubmitted.length > 0) && (
                      <>
                        <span className="text-white/30">+</span>
                        <span className="text-cyan-300">C {displayGroupCTotal.toFixed(2)}</span>
                      </>
                    )}
                    <span className="text-white/30">·</span>
                    <span
                      key={`ta-${taPulse}`}
                      className="text-red-400/70 ta-pulse px-1 rounded"
                      title={`OOB ×${taOobCount} — مطبّق ضمن نقاط المجموعة أ`}
                    >
                      TA {displayTaDeduction.toFixed(3)} (info)
                    </span>
                    <span className="text-white/30">−</span>
                    <span className="font-black text-red-300">HD {chiefDeduction.toFixed(3)}</span>
                    <span className="text-white/30">−</span>
                    <span className="font-black text-orange-300">CD {choreoTotal.toFixed(3)}</span>
                  </div>


                  <div className="mt-2 flex flex-wrap items-center gap-1.5" dir="ltr">
                    <span className="mr-1 text-[9px] font-heading font-black tracking-wider text-white/50" dir="rtl">
                      خصم رئيس الحكام
                    </span>
                    {[0.1, 0.2, 0.5, 1].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => applyChiefDeduction(value)}
                        className="h-7 min-w-12 rounded-md border border-red-400/30 bg-red-500/10 px-2 text-[10px] font-heading font-black tabular-nums text-red-200 transition-colors hover:bg-red-500/20"
                      >
                        {value.toFixed(3)}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      aria-label="خصم رئيس الحكام"
                      value={chiefDeductionDraft}
                      onChange={(event) => setChiefDeductionDraft(event.target.value)}
                      onBlur={() => applyChiefDeduction(Number(chiefDeductionDraft))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyChiefDeduction(Number(chiefDeductionDraft));
                      }}
                      className="h-7 w-20 rounded-md border border-white/20 bg-black/40 px-2 text-center text-[10px] font-heading font-black tabular-nums text-white outline-none focus:border-red-300"
                    />
                    <button
                      type="button"
                      onClick={() => applyChiefDeduction(0)}
                      className="h-7 rounded-md border border-white/15 bg-white/5 px-2 text-[9px] font-bold text-white/60 hover:text-white"
                    >
                      CLEAR
                    </button>
                  </div>

                  {/* CHOREOGRAPHY DEDUCTIONS — codes 80–86 (Chief Judge only) */}
                  <div className="mt-2 rounded-xl border border-orange-400/25 bg-orange-500/[0.06] px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                      <span className="mr-1 text-[9px] font-heading font-black tracking-wider text-orange-200/80" dir="rtl">
                        خصومات التصميم الحركي (80–86)
                      </span>
                      {CHOREO_CODES.map((entry) => {
                        const active = choreoApplied.some((d) => d.code === entry.code);
                        return (
                          <button
                            key={entry.code}
                            type="button"
                            disabled={active}
                            title={`${entry.code} — ${entry.labelAr} (−${entry.value.toFixed(3)})`}
                            onClick={() => applyChoreoCode(entry.code)}
                            className={`h-7 min-w-9 rounded-md border px-2 text-[10px] font-heading font-black tabular-nums transition-colors ${
                              active
                                ? "border-orange-300/60 bg-orange-400/25 text-orange-100 cursor-not-allowed opacity-70"
                                : "border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
                            }`}
                          >
                            {entry.code}
                          </button>
                        );
                      })}
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="CODE"
                        aria-label="رمز خصم التصميم الحركي"
                        value={choreoDraft}
                        onChange={(event) => setChoreoDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && choreoDraft.trim()) applyChoreoCode(choreoDraft);
                        }}
                        className="h-7 w-16 rounded-md border border-white/20 bg-black/40 px-2 text-center text-[10px] font-heading font-black tabular-nums text-white outline-none placeholder:text-white/25 focus:border-orange-300"
                      />
                      <button
                        type="button"
                        onClick={() => choreoDraft.trim() && applyChoreoCode(choreoDraft)}
                        className="h-7 rounded-md border border-orange-400/30 bg-orange-500/10 px-2 text-[9px] font-bold text-orange-200 hover:bg-orange-500/20"
                      >
                        ADD
                      </button>
                    </div>

                    {choreoApplied.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" dir="ltr">
                        {choreoApplied.map((d) => (
                          <button
                            key={d.code}
                            type="button"
                            onClick={() => removeChoreoCode(d.code)}
                            title={`${d.label} — إزالة`}
                            className="group flex h-6 items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 text-[10px] font-heading font-black tabular-nums text-red-200 hover:bg-red-500/30"
                          >
                            <span>{d.code}: −{d.value.toFixed(3)}</span>
                            <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                          </button>
                        ))}
                        <span className="text-[10px] font-heading font-black tabular-nums text-orange-300">
                          CD TOTAL −{choreoTotal.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5">
                    <VideoEvidenceIndicator sessionCode={sessionCode} athleteId={currentAthlete?.id ?? null} />
                  </div>
                </div>

                <p
                  className={`text-4xl md:text-5xl lg:text-6xl font-heading font-black tabular-nums leading-none whitespace-nowrap ${scoreVisible ? "score-reveal" : ""}`}
                  style={{
                    color: scoreVisible ? "#ffffff" : "rgba(255,255,255,0.2)",
                    textShadow: scoreVisible ? `0 0 30px rgba(255,255,255,0.7), 0 0 60px ${GOLD}88` : "none",
                  }}
                  dir="ltr"
                >
                  {scoreVisible ? aggregateFinal.toFixed(3) : "—.———"}
                </p>

                <div className="text-right whitespace-nowrap">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-body text-white/40">Max</p>
                  <p className="text-lg font-heading font-black tabular-nums text-white/50" dir="ltr">
                    {maxTotal.toFixed(3)}
                  </p>
                  {displayTaDeduction > 0 && (
                    <p className="mt-1 text-[9px] text-red-400 font-body" dir="ltr">
                      OOB ×{taOobCount}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* CONTROL BAR */}
      <footer className="relative z-10 h-12 backdrop-blur-xl bg-white/[0.02] border-t border-white/10 px-4 flex items-center justify-center gap-2 shrink-0">
        {/* LIVE TIMER MONITOR — read-only mirror of TA's master clock */}
        <div className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/5 border border-white/10">
          <Radio className={`h-3.5 w-3.5 ${timerRunning ? "text-emerald-400 animate-pulse" : "text-white/40"}`} />
          <span className="text-[9px] uppercase tracking-[0.25em] font-heading font-bold text-white/50">TA Clock</span>
          <span className="text-sm font-heading font-black tabular-nums text-white" dir="ltr">
            {fmtTime(timerElapsed)}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            timerRunning ? "bg-emerald-500/20 text-emerald-300"
            : timeUp ? "bg-red-500/20 text-red-300"
            : "bg-white/10 text-white/50"
          }`} dir="ltr">
            {timerRunning ? "LIVE" : timeUp ? "TIME UP" : "READY"}
          </span>
        </div>
        {/* (VAR review button removed — accessible from header BROADCAST VAR) */}
        {/* ── PUBLISH PIPELINE (v1.2.4) ─────────────────────────────────────
            Soft-gate: at least ONE submitted judge per required group is enough.
            Chief always has manual override. Sequence:
            1. COMPUTE FINAL  → freezes & reveals on Chief screen (commit)
            2. PUBLISH        → pushes to /public-display (audience screen)
            3. تقرير AI       → opens detailed AI report
        */}
        {(() => {
          // A group counts as ready when ANY of its judges has submitted a score,
          // or when the Chief has an override in place for one of its slots.
          const hasAny = (arr: JudgeSlot[]) =>
            arr.some(j => j.submitted || typeof j.score === "number" || typeof judgeOverrides[j.key] === "number");
          const aReady = hasAny(groupA);
          const bReady = hasAny(groupB);
          const cReady = matchMode === "compulsory" ? true : hasAny(groupC);
          const minReady = (aReady && bReady && cReady) || forceUnlock;
          const missing: string[] = [];
          if (!aReady) missing.push("A");
          if (!bReady) missing.push("B");
          if (!cReady) missing.push("C");

          // Strict ready (all online judges submitted) — pulses gold to celebrate
          const allSubmittedFor = (arr: JudgeSlot[]) => {
            const online = arr.filter(j => j.online);
            return online.length > 0 && online.every(j => j.submitted);
          };
          const fullyReady =
            allSubmittedFor(groupA) &&
            allSubmittedFor(groupB) &&
            (matchMode === "compulsory" ? true : allSubmittedFor(groupC));

          return (
            <>
              {/* Step 1 — COMPUTE & REVEAL final score on Chief screen */}
              {!scoreRevealed && (
                <button
                  onClick={() => { setScoreRevealed(true); commitCurrentResult(); }}
                  disabled={!minReady}
                  title={minReady ? "Calcul final · révèle le score" : `في الانتظار: ${missing.join(" · ")}`}
                  className="h-9 px-4 rounded-xl font-heading font-black text-[11px] tracking-[0.2em] flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: minReady
                      ? "linear-gradient(135deg, #10B981, #059669)"
                      : "rgba(255,255,255,0.05)",
                    color: minReady ? "#fff" : "rgba(255,255,255,0.5)",
                    border: minReady ? "none" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: minReady ? "0 0 20px rgba(16,185,129,0.55)" : "none",
                    animation: minReady && timeUp ? "pulse 2s ease-in-out infinite" : "none",
                  }}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {minReady ? `COMPUTE FINAL · ${aggregateFinal.toFixed(3)}` : `WAITING ${missing.join("·")}`}
                </button>
              )}

              {/* Step 2 — PUBLISH to public display (always usable once a score exists) */}
              <button
                onClick={() => publishToPublic({ openWindow: false })}
                disabled={!minReady || publishingLive}
                title={minReady ? "Publish to public display" : `في انتظار: ${missing.join(" · ")}`}
                className="h-9 px-5 rounded-xl font-heading font-black text-[11px] tracking-[0.25em] flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: minReady
                    ? `linear-gradient(135deg, #ffffff, ${GOLD})`
                    : "rgba(255,255,255,0.05)",
                  color: minReady ? "#000" : "rgba(255,255,255,0.5)",
                  border: minReady ? "none" : "1px solid rgba(255,255,255,0.1)",
                  boxShadow: fullyReady ? `0 0 24px ${GOLD}AA, 0 0 48px rgba(255,255,255,0.4)` : "none",
                  animation: fullyReady && scoreRevealed ? "pulse 2s ease-in-out infinite" : "none",
                }}
              >
                <Tv className="h-3.5 w-3.5" />
                {publishingLive ? "..." : minReady ? "PUBLISH" : `WAITING ${missing.join("·")}`}
              </button>

              {/* Step 3 — AI report (deep-link, also QR'd on public display) */}
              {scoreRevealed && currentAthlete && (
                <Link
                  to="/public-report/$id"
                  params={{ id: currentAthlete.id }}
                  target="_blank"
                  className="h-9 px-4 rounded-xl font-heading font-black text-[11px] tracking-[0.2em] flex items-center gap-2 transition-all hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000",
                           boxShadow: `0 0 20px ${ORANGE}55` }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  تقرير AI
                </Link>
              )}

              {/* Manual override — Chief unlocks calculation when a group cannot submit */}
              <button
                onClick={() => setForceUnlock(v => !v)}
                title="تجاوز يدوي · unlock calculation without all groups"
                className="h-9 px-3 rounded-xl border font-heading font-black text-[10px] tracking-[0.2em] transition-all"
                style={forceUnlock
                  ? { background: `${ORANGE}25`, borderColor: ORANGE, color: ORANGE }
                  : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
              >
                {forceUnlock ? "OVERRIDE ON" : "OVERRIDE"}
              </button>
            </>
          );
        })()}
        {/* ATOMIC RESET — archives, clears current_match, judge_scores, returns to waiting */}
        <NextAthleteButton
          sessionCode={sessionCode}
          onReset={hardResetForNextAthlete}
        />
      </footer>

      {/* DRAWER */}
      {drawerOpen && (
        <ChiefDrawer
          onClose={() => setDrawerOpen(false)}
          sessionCode={sessionCode}
          copied={copied}
          onCopy={handleCopySession}
          competitionStyle={competitionStyle}
          setCompetitionStyle={setCompetitionStyle}
          athletes={athletes}
          currentAthleteIndex={currentAthleteIndex}
          setCurrentAthleteIndex={setCurrentAthleteIndex}
          marqueeText={marqueeText}
          setMarqueeText={setMarqueeText}
          sponsorLogos={sponsorLogos}
          addSponsorLogo={addSponsorLogo}
          removeSponsorLogo={removeSponsorLogo}
          leaderboardMode={leaderboardMode}
          setLeaderboardMode={setLeaderboardMode}
          leaderboardCount={getLeaderboard().length}
          clearResults={clearResults}
          publishingLive={publishingLive}
          onCast={() => publishToPublic({ openWindow: true })}
          isVarLiveOnPublic={isVarLiveOnPublic}
          setIsVarLiveOnPublic={setIsVarLiveOnPublic}
          onManualSync={handleManualSync}
          manualSyncing={manualSyncing}
          groupCompleted={groupCompleted}
          onToggleGroupCompleted={() => void toggleGroupCompleted()}
          onOpenInsights={() => { setInsightsOpen(true); setDrawerOpen(false); }}
          timerRunning={timerRunning}
        />
      )}

      {/* EVENT STANDINGS — strictly read-only overlay */}
      <LeaderboardModal
        sessionCode={sessionCode}
        open={standingsOpen}
        onClose={() => setStandingsOpen(false)}
        styleFilter={(timerSync.style ?? competitionStyle) ?? null}
      />

      {/* FINAL SCORE SHEET — shown after COMMIT */}

      {qrModalOpen && currentAthlete && scoreRevealed && (
        <FinalScoreSheetModal
          onClose={() => setQrModalOpen(false)}
          matchMode={matchMode}
          taOobCount={taOobCount}
          taDeduction={taDeduction}
          chiefDeduction={chiefDeduction}
          groupAScore={groupATotal}
          groupAMax={effMaxA}
          bIndividualScores={bIndividualScores}
          groupBAverage={groupBNet}
          groupBMax={effMaxB}
          groupCScore={groupCTotal}
          groupCMax={effMaxC}
          finalScore={aggregateFinal}
        />
      )}

      {/* CONTENT SHEET MODAL — pre-registered difficulty movements */}
      {contentSheetOpen && currentAthlete && (
        <ContentSheetModal
          athlete={currentAthlete}
          onClose={() => setContentSheetOpen(false)}
        />
      )}

      {/* TEAM MANAGEMENT SIDEBAR (waiting list + revoke + team config) */}
      <WaitingSidebar open={teamPanelOpen} onClose={() => setTeamPanelOpen(false)} />

      {/* GROUP DETAIL MODAL */}
      {groupDetail && (
        <GroupDetailModal
          group={groupDetail}
          slots={judges.filter(j => j.group === groupDetail)}
          revealed={hasActiveAthlete}
          onEdit={(s) => { setEditingJudge(s); }}
          onClose={() => setGroupDetail(null)}
        />
      )}

      {/* EDIT MODAL */}
      {editingJudge && (
        <EditScoreModal
          slot={editingJudge}
          currentOverride={judgeOverrides[editingJudge.key] ?? null}
          baseScore={editingJudge.score}
          onSave={(v) => { setJudgeOverride(editingJudge.key, v); setEditingJudge(null); }}
          onClear={() => { setJudgeOverride(editingJudge.key, null); setEditingJudge(null); }}
          onClose={() => setEditingJudge(null)}
        />
      )}

      {/* AI INSIGHTS */}
      {insightsOpen && (
        <AiInsightsSidebar
          onClose={() => setInsightsOpen(false)}
          onOpenChat={() => { setInsightsOpen(false); setAiOpen(true); }}
          judgeBScores={judgeBScores}
          judgeBAverage={groupBNet}
          judgeAScore={groupATotal}
          judgeCScore={groupCTotal}
          finalScore={aggregateFinal}
          approvedCount={approvedJudges.length}
        />
      )}

      <AiAssistantSidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

/* ===========================================================
   GROUP COLUMN — Command Center vertical tile per group
   =========================================================== */
function GroupColumn({
  name, subtitle, color, summary, summaryLabel, revealed, judges, timerRunning, onOpen,
}: {
  name: string; subtitle: string;
  color: string;
  summary: number; summaryLabel: string;
  revealed: boolean;
  judges: JudgeSlot[];
  timerRunning: boolean;
  onOpen: () => void;
}) {
  const onlineJudges = judges.filter(j => j.online);
  const submittedCount = onlineJudges.filter(j => j.score !== null).length;
  let orbState: "waiting" | "active" | "submitted" = "waiting";
  if (onlineJudges.length > 0 && submittedCount === onlineJudges.length) orbState = "submitted";
  else if (timerRunning || submittedCount > 0) orbState = "active";

  return (
    <button
      onClick={onOpen}
      className="rounded-2xl border backdrop-blur-md p-3 flex flex-col text-left hover:brightness-110 transition-all min-h-0"
      style={{
        borderColor: revealed ? `${color}88` : `${color}44`,
        background: `linear-gradient(180deg, ${color}10, ${color}03)`,
        boxShadow: revealed ? `0 0 40px ${color}33, inset 0 0 30px ${color}10` : `inset 0 0 20px ${color}05`,
      }}
      title="عرض تفاصيل الحكام"
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[11px] font-heading font-black tracking-[0.3em]" style={{ color }}>
            {name}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-white/40 font-body">{subtitle}</p>
        </div>
        <StatusOrb state={orbState} color={color} />
      </div>

      <p
        className="text-3xl md:text-4xl font-heading font-black tabular-nums mt-1 whitespace-nowrap overflow-visible"
        style={{
          color: revealed ? color : "rgba(255,255,255,0.2)",
          textShadow: revealed ? `0 0 18px ${color}AA, 0 0 36px ${color}44` : "none",
          lineHeight: 1.15,
        }}
        dir="ltr"
      >
        {revealed ? summary.toFixed(2) : "—.——"}
      </p>
      <p className="text-[9px] text-white/40 font-body mt-0.5 whitespace-nowrap" dir="ltr">{summaryLabel}</p>

      {/* Mini-grid of individual judge results — directly under the group total (v1.2.2) */}
      <div className="mt-2 pt-2 border-t shrink-0" style={{ borderColor: `${color}33` }}>
        <p className="text-[8px] uppercase tracking-[0.25em] text-white/35 font-body mb-1.5">Individual</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {judges.map(j => (
            <JudgeChip key={j.key} slot={j} revealed={revealed} />
          ))}
        </div>
      </div>
    </button>
  );
}

function StatusOrb({ state, color }: { state: "waiting" | "active" | "submitted"; color: string }) {
  if (state === "waiting") {
    return <span className="h-3 w-3 rounded-full bg-white/20 border border-white/30" title="Waiting" />;
  }
  if (state === "active") {
    return (
      <span className="relative h-3 w-3 rounded-full" title="Judging" style={{ background: color }}>
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.6 }} />
      </span>
    );
  }
  return (
    <span
      className="h-3 w-3 rounded-full"
      title="Submitted"
      style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 20px ${color}88` }}
    />
  );
}

/* Compact judge chip — circular like the reference scoreboard */
function JudgeChip({ slot, revealed }: { slot: JudgeSlot; revealed: boolean }) {
  if (!slot.online) {
    return (
      <div className="flex flex-col items-center gap-0.5 opacity-40 w-[42px]">
        <div className="h-9 w-9 rounded-full border border-dashed border-white/20 flex items-center justify-center">
          <span className="text-[8px] font-heading font-black text-white/40" dir="ltr">{slot.label}</span>
        </div>
        <span className="text-[8px] text-white/30 font-body leading-none">انتظار</span>
      </div>
    );
  }

  // CHIEF transparency: always show score to chief once submitted, even before public reveal.
  const hasScore = slot.score !== null;
  const isB = slot.group === "B";
  const isDropped = isB && (slot.bRole === "high" || slot.bRole === "low");
  const isKept = isB && slot.bRole === "kept";

  const ring = hasScore
    ? isDropped ? "rgba(239,68,68,0.7)"
    : isKept     ? "rgba(52,211,153,0.7)"
    : `${ORANGE}AA`
    : "rgba(255,255,255,0.15)";

  const valueColor = hasScore
    ? isDropped ? "#ef4444"
    : isKept     ? "#34d399"
    : ORANGE
    : "rgba(255,255,255,0.4)";

  return (
    <div className="flex flex-col items-center gap-0.5 w-[42px]">
      <div className="relative h-9 w-9 rounded-full border-2 flex flex-col items-center justify-center transition-all"
        style={{ borderColor: ring, background: "rgba(255,255,255,0.03)" }}>
        <span className="text-[7px] font-heading font-black text-white/70 leading-none" dir="ltr">{slot.label}</span>
        <span className="text-[10px] font-heading font-black tabular-nums leading-none mt-0.5" style={{ color: valueColor }} dir="ltr">
          {hasScore ? slot.score!.toFixed(2) : "—"}
        </span>
        {hasScore && isDropped && (
          <span className="absolute left-0.5 right-0.5 top-1/2 h-[2px] bg-red-500 -translate-y-1/2 rotate-[-15deg] rounded-full" />
        )}
        <span
          className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${slot.submitted ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`}
          title={slot.submitted ? "Received" : "Waiting"}
        />
      </div>
      <span className={`text-[7px] font-heading font-black tracking-wider leading-none ${slot.submitted ? "text-emerald-400" : "text-amber-400/80"}`} dir="ltr">
        {slot.submitted ? "✓" : "…"}
      </span>
    </div>
  );
}

/* Group detail modal — list of judges + override */
function GroupDetailModal({
  group, slots, revealed, onEdit, onClose,
}: {
  group: GroupKey;
  slots: JudgeSlot[];
  revealed: boolean;
  onEdit: (s: JudgeSlot) => void;
  onClose: () => void;
}) {
  const titles: Record<GroupKey, string> = {
    A: "GROUP A — Quality",
    B: "GROUP B — Performance",
    C: "GROUP C — Difficulty",
  };
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 rounded-3xl bg-[#0a0a0a] border p-5"
        style={{ borderColor: `${ORANGE}55`, boxShadow: `0 0 60px ${ORANGE}22` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-heading font-black text-white tracking-wider" dir="ltr">{titles[group]}</p>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {slots.map(j => {
            const isDropped = j.group === "B" && (j.bRole === "high" || j.bRole === "low");
            const isKept = j.group === "B" && j.bRole === "kept";
            const valueColor = revealed
              ? isDropped ? "#ef4444" : isKept ? "#34d399" : ORANGE
              : "rgba(255,255,255,0.4)";
            return (
              <div key={j.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full border flex items-center justify-center text-[10px] font-heading font-black text-white" style={{ borderColor: j.online ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.15)" }} dir="ltr">
                    {j.label}
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-body">
                      {j.online ? "Online" : "في الانتظار"}
                    </p>
                    {j.group === "B" && j.bRole && (
                      <p className="text-[10px] font-heading font-bold" style={{ color: isDropped ? "#ef4444" : "#34d399" }}>
                        {isDropped ? "Dropped" : "Counted"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-heading font-black tabular-nums" style={{ color: valueColor }} dir="ltr">
                    {j.score !== null ? (revealed ? j.score.toFixed(2) : "•••") : "—"}
                  </p>
                  <button
                    onClick={() => j.online && onEdit(j)}
                    disabled={!j.online}
                    className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center disabled:opacity-30"
                    title="Edit score"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  onClick, disabled, variant, icon, label,
}: {
  onClick: () => void; disabled?: boolean;
  variant: "orange" | "red" | "neutral";
  icon: React.ReactNode; label: string;
}) {
  const styles = {
    orange:  { background: ORANGE, color: "#000", boxShadow: `0 0 16px ${ORANGE}66` },
    red:     { background: "#ef4444", color: "#fff", boxShadow: "0 0 16px rgba(239,68,68,0.5)" },
    neutral: { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={styles}
      className="h-9 px-4 rounded-xl font-heading font-black text-[11px] tracking-[0.25em] flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
      {icon}
      {label}
    </button>
  );
}

function ChiefDrawer({
  onClose, sessionCode, copied, onCopy,
  competitionStyle, setCompetitionStyle,
  athletes, currentAthleteIndex, setCurrentAthleteIndex,
  marqueeText, setMarqueeText, sponsorLogos, addSponsorLogo, removeSponsorLogo,
  leaderboardMode, setLeaderboardMode, leaderboardCount, clearResults,
  publishingLive, onCast, isVarLiveOnPublic, setIsVarLiveOnPublic,
  onManualSync, manualSyncing, groupCompleted, onToggleGroupCompleted,
  onOpenInsights, timerRunning,
}: {
  onClose: () => void;
  sessionCode: string | null;
  copied: boolean;
  onCopy: () => void;
  competitionStyle: CompetitionStyle;
  setCompetitionStyle: (s: CompetitionStyle) => void;
  athletes: { id: string; name: string; country: string; category: string; order: number }[];
  currentAthleteIndex: number;
  setCurrentAthleteIndex: (i: number) => void;
  marqueeText: string;
  setMarqueeText: (s: string) => void;
  sponsorLogos: string[];
  addSponsorLogo: (url: string) => void;
  removeSponsorLogo: (i: number) => void;
  leaderboardMode: boolean;
  setLeaderboardMode: (v: boolean) => void;
  leaderboardCount: number;
  clearResults: () => void;
  publishingLive: boolean;
  onCast: () => void;
  isVarLiveOnPublic: boolean;
  setIsVarLiveOnPublic: (v: boolean) => void;
  onManualSync: () => void;
  manualSyncing: boolean;
  groupCompleted: boolean;
  onToggleGroupCompleted: () => void;
  onOpenInsights: () => void;
  timerRunning: boolean;
}) {
  const [marqueeDraft, setMarqueeDraft] = useState(marqueeText);
  const [marqueeApplied, setMarqueeApplied] = useState(false);
  const [uploadingSponsor, setUploadingSponsor] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => { setMarqueeDraft(marqueeText); }, [marqueeText]);

  const applyMarquee = async () => {
    setMarqueeText(marqueeDraft);
    if (sessionCode) {
      try {
        await pushDisplaySettings(sessionCode, { marquee: marqueeDraft });
        setMarqueeApplied(true);
        setTimeout(() => setMarqueeApplied(false), 1500);
      } catch (e) { console.error("[CHIEF] applyMarquee failed", e); }
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !sessionCode) { e.target.value = ""; return; }
    setUploadingSponsor(true);
    setUploadError(null);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const url = await uploadSponsorLogo(file, sessionCode);
        newUrls.push(url);
        addSponsorLogo(url);
      }
      await pushDisplaySettings(sessionCode, { sponsors: [...sponsorLogos, ...newUrls] });
    } catch (err) {
      console.error("[CHIEF] sponsor upload failed", err);
      setUploadError(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploadingSponsor(false);
      e.target.value = "";
    }
  };

  const handleRemoveSponsor = async (i: number) => {
    const next = sponsorLogos.filter((_, idx) => idx !== i);
    removeSponsorLogo(i);
    if (sessionCode) {
      try { await pushDisplaySettings(sessionCode, { sponsors: next }); } catch (e) { console.error(e); }
    }
  };
  return (
    <div className="fixed inset-0 z-[58] flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-80 md:w-96 h-full bg-[#0a0a0a] border-l overflow-y-auto"
        style={{ borderColor: `${ORANGE}33` }}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" style={{ color: ORANGE }} />
            <p className="text-sm font-heading font-black text-white tracking-wider">CONTROL PANEL</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-2">Session ID</p>
          <button onClick={onCopy}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border hover:bg-white/[0.06] transition-all"
            style={{ borderColor: `${ORANGE}40` }}>
            <span className="text-2xl font-heading font-black tabular-nums tracking-[0.25em]" style={{ color: ORANGE }} dir="ltr">
              {sessionCode || "------"}
            </span>
            {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-white/50" />}
          </button>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-white/50 font-body">
            <Wifi className="h-3 w-3 text-emerald-400" /> Vault active · شارك مع القضاة
          </div>

          {sessionCode && (
            <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/10 p-3 flex flex-col items-center">
              <div className="bg-white p-2 rounded-lg">
                <QRCodeSVG
                  value={typeof window !== "undefined"
                    ? `${window.location.origin}/judge-join?code=${sessionCode}`
                    : `/judge-join?code=${sessionCode}`}
                  size={120}
                  level="M"
                />
              </div>
              <p className="text-[10px] text-white/50 font-body mt-2 text-center leading-relaxed">
                امسح هذا الكود من هاتف القاضي للانضمام مباشرة
              </p>
            </div>
          )}
        </div>

        {/* OPERATIONS — moved out of the header to keep it clean (v1.2.3) */}
        <div className="p-4 border-b border-white/5 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-1">Operations</p>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-body">System status</span>
            <span className="text-[10px] font-heading font-black tracking-wider" style={{ color: timerRunning ? "#34d399" : ORANGE }} dir="ltr">
              {timerRunning ? "LIVE" : "READY"}
            </span>
          </div>
          <button onClick={onCast} disabled={publishingLive}
            className="w-full h-10 rounded-xl font-heading font-black text-[11px] tracking-[0.25em] flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff" }}>
            <Tv className="h-3.5 w-3.5" /> {publishingLive ? "..." : "CAST · تقرير"}
          </button>
          <button onClick={() => setIsVarLiveOnPublic(!isVarLiveOnPublic)}
            className="w-full h-10 rounded-xl border font-heading font-black text-[11px] tracking-[0.2em] flex items-center justify-center gap-2"
            style={isVarLiveOnPublic
              ? { background: "rgba(239,68,68,0.18)", borderColor: "rgba(239,68,68,0.6)", color: "#fca5a5" }
              : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
            <Radio className="h-3.5 w-3.5" /> {isVarLiveOnPublic ? "BROADCAST VAR · ON" : "BROADCAST VAR"}
          </button>
          <button onClick={onToggleGroupCompleted}
            className="w-full h-10 rounded-xl border font-heading font-black text-[11px] tracking-[0.2em] flex items-center justify-center gap-2"
            style={groupCompleted
              ? { background: `${GOLD}1A`, borderColor: `${GOLD}66`, color: GOLD }
              : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
            <Trophy className="h-3.5 w-3.5" /> {groupCompleted ? "REOPEN GROUP" : "COMPLETE GROUP"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onManualSync} disabled={manualSyncing}
              className="h-10 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-heading font-black text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40">
              <RefreshCw className={`h-3.5 w-3.5 ${manualSyncing ? "animate-spin" : ""}`} /> SYNC
            </button>
            <button onClick={onOpenInsights}
              className="h-10 rounded-xl font-heading font-black text-[10px] tracking-[0.2em] flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000" }}>
              <Sparkles className="h-3.5 w-3.5" /> AI
            </button>
          </div>
        </div>


        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Competition Style</p>
            <span className="text-[9px] font-heading font-bold tracking-wider px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
              READ-ONLY · DRIVEN BY TA
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map(s => {
              const active = competitionStyle === s.id;
              return (
                <div key={s.id}
                  className="h-10 rounded-lg border text-[11px] font-heading font-bold tracking-wider flex items-center justify-center select-none"
                  style={{
                    background: active ? `${ORANGE}20` : "rgba(255,255,255,0.02)",
                    borderColor: active ? `${ORANGE}80` : "rgba(255,255,255,0.08)",
                    color: active ? ORANGE : "rgba(255,255,255,0.45)",
                    opacity: active ? 1 : 0.55,
                  }}>
                  {s.label}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-white/40 mt-2 font-body leading-relaxed">
            النمط مرآة لاختيار المساعد التقني — يتغيّر تلقائيًا عند بدء المباراة.
          </p>
        </div>

        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body mb-2">Marquee Ticker</p>
          <textarea
            value={marqueeDraft}
            onChange={(e) => setMarqueeDraft(e.target.value)}
            rows={2}
            placeholder="نص الشريط الإخباري (اسم البطولة، التاريخ...)"
            className="w-full rounded-xl bg-black/40 border px-3 py-2 text-xs text-white font-body focus:outline-none resize-none"
            style={{ borderColor: `${ORANGE}33` }}
          />
          <button
            onClick={applyMarquee}
            disabled={marqueeDraft === marqueeText && !marqueeApplied}
            className="mt-2 w-full h-9 rounded-lg font-heading font-black text-xs tracking-[0.2em] border transition-all disabled:opacity-40"
            style={{
              background: marqueeApplied ? "rgba(16,185,129,0.15)" : `${ORANGE}1A`,
              borderColor: marqueeApplied ? "#10B98166" : `${ORANGE}66`,
              color: marqueeApplied ? "#10B981" : ORANGE,
            }}
          >
            {marqueeApplied ? "✓ APPLIED · LIVE" : "APPLY TO DISPLAY"}
          </button>
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Sponsor Logos</p>
            <label className={`cursor-pointer text-[10px] font-heading font-bold px-2 py-1 rounded border tracking-wider ${uploadingSponsor ? "opacity-50 pointer-events-none" : ""}`}
              style={{ color: ORANGE, borderColor: `${ORANGE}66`, background: `${ORANGE}10` }}>
              {uploadingSponsor ? "UPLOADING..." : "+ UPLOAD"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFile} disabled={uploadingSponsor} />
            </label>
          </div>
          {uploadError && <p className="text-[10px] text-red-400 font-body mb-2">{uploadError}</p>}
          {sponsorLogos.length === 0 ? (
            <p className="text-xs text-white/40 font-body text-center py-4">لا توجد شعارات بعد</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sponsorLogos.map((url, i) => (
                <div key={i} className="relative h-16 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden group">
                  <img src={url} alt={`Sponsor ${i + 1}`} className="max-h-14 max-w-[90%] object-contain" />
                  <button onClick={() => handleRemoveSponsor(i)}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/80 border border-white/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5" style={{ color: ORANGE }} />
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Athletes</p>
          </div>
          {athletes.length === 0 ? (
            <p className="text-xs text-white/40 font-body text-center py-6">لا يوجد لاعبون مضافون بعد</p>
          ) : (
            <div className="space-y-1.5">
              {athletes.map((a, i) => (
                <button key={a.id} onClick={() => setCurrentAthleteIndex(i)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all"
                  style={{
                    background: i === currentAthleteIndex ? `${ORANGE}1A` : "rgba(255,255,255,0.03)",
                    borderColor: i === currentAthleteIndex ? `${ORANGE}66` : "rgba(255,255,255,0.08)",
                  }}>
                  <div>
                    <p className="text-sm font-heading font-bold text-white">{a.name}</p>
                    <p className="text-[10px] text-white/50 font-body" dir="ltr">{a.country} · {a.category}</p>
                  </div>
                  <span className="text-[10px] font-heading font-black tabular-nums" style={{ color: ORANGE }}>#{a.order}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard mode toggle */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">Leaderboard Mode</p>
            </div>
            <button
              onClick={async () => {
                const next = !leaderboardMode;
                setLeaderboardMode(next);
                if (sessionCode) {
                  try { await pushDisplaySettings(sessionCode, { leaderboardMode: next }); }
                  catch (e) { console.error("[CHIEF] leaderboard toggle sync failed", e); }
                }
              }}
              role="switch"
              aria-checked={leaderboardMode}
              className="relative h-6 w-11 rounded-full border transition-all"
              style={{
                background: leaderboardMode ? GOLD : "rgba(255,255,255,0.08)",
                borderColor: leaderboardMode ? GOLD : "rgba(255,255,255,0.15)",
                boxShadow: leaderboardMode ? `0 0 12px ${GOLD}88` : "none",
              }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all"
                style={{ left: leaderboardMode ? "calc(100% - 1.125rem)" : "0.125rem" }}
              />
            </button>
          </div>
          <p className="text-[10px] text-white/40 font-body leading-relaxed mb-2">
            تبديل شاشة /scoreboard إلى عرض الترتيب النهائي للأبطال
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-body text-white/60">
              نتائج مسجلة: <span className="font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">{leaderboardCount}</span>
            </span>
            {leaderboardCount > 0 && (
              <button
                onClick={clearResults}
                className="text-[10px] font-heading font-bold tracking-wider px-2 py-1 rounded border text-white/60 hover:text-white border-white/10 hover:border-white/30"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EditScoreModal({
  slot, baseScore, currentOverride, onSave, onClear, onClose,
}: {
  slot: JudgeSlot;
  baseScore: number | null;
  currentOverride: number | null;
  onSave: (v: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState<string>((currentOverride ?? baseScore ?? 0).toFixed(3));
  const numeric = parseFloat(val);
  const valid = !Number.isNaN(numeric) && numeric >= 0 && numeric <= 10;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70" onClick={onClose} style={{ pointerEvents: "auto" }}>
      <div className="w-full max-w-sm mx-4 rounded-3xl bg-[#0a0a0a] border p-6"
        style={{ borderColor: `${ORANGE}66`, boxShadow: `0 0 60px ${ORANGE}33` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-body" style={{ color: ORANGE }}>Emergency Override</p>
            <p className="text-sm font-heading font-black text-white" dir="ltr">{slot.label}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-white/50 font-body mb-3">
          القيمة الأصلية: <span className="text-white font-bold tabular-nums" dir="ltr">{(baseScore ?? 0).toFixed(3)}</span>
        </p>
        <input
          type="number" step="0.01" min="0" max="10"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-full h-16 rounded-2xl bg-black/40 border border-white/10 text-center text-3xl font-heading font-black tabular-nums focus:outline-none"
          style={{ color: ORANGE }}
          dir="ltr"
        />
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={onClear}
            className="h-11 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-heading font-bold text-sm hover:bg-white/10 transition-all">
            CLEAR OVERRIDE
          </button>
          <button onClick={() => valid && onSave(numeric)} disabled={!valid}
            className="h-11 rounded-2xl bg-emerald-500 text-white font-heading font-black tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:brightness-110 transition-all disabled:opacity-40">
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

function AiInsightsSidebar({
  onClose, onOpenChat, judgeBScores, judgeBAverage, judgeAScore, judgeCScore, finalScore, approvedCount,
}: {
  onClose: () => void; onOpenChat: () => void;
  judgeBScores: number[]; judgeBAverage: number;
  judgeAScore: number; judgeCScore: number; finalScore: number;
  approvedCount: number;
}) {
  const maxGap = judgeBScores.length > 1 ? Math.max(...judgeBScores) - Math.min(...judgeBScores) : 0;
  const biasJudges = judgeBScores
    .map((s, i) => ({ i, dev: Math.abs(s - judgeBAverage) }))
    .filter(x => x.dev > 0.5);
  const totalSlots = 11;

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 z-[55] bg-[#0a0a0a]/95 backdrop-blur-2xl border-l flex flex-col"
      style={{ borderColor: `${ORANGE}40`, boxShadow: `0 0 60px ${ORANGE}22` }}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg border flex items-center justify-center" style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}66` }}>
            <Activity className="h-4 w-4" style={{ color: ORANGE }} />
          </div>
          <div>
            <p className="text-sm font-heading font-black text-white">AI Live Insights</p>
            <p className="text-[10px] text-white/50 font-body">تحليل لحظي للتحكيم</p>
          </div>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Judges Online" value={`${approvedCount}/${totalSlots}`} accent="emerald" />
          <Stat label="Final Score"  value={finalScore.toFixed(3)} accent="orange" />
          <Stat label="Net B"        value={judgeBAverage.toFixed(2)} accent="orange" />
          <Stat label="Group A"      value={judgeAScore.toFixed(2)} accent="red" />
          <Stat label="Group C"      value={judgeCScore.toFixed(2)} accent="orange" />
          <Stat label="B Gap"        value={maxGap.toFixed(3)} accent={maxGap > 0.5 ? "red" : "emerald"} />
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-body mb-2">Smart Alerts</p>
          <div className="space-y-2">
            {approvedCount < totalSlots && (
              <Alert tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                {(totalSlots - approvedCount) + " قاضٍ لم يدخل بعد · " + (totalSlots - approvedCount) + " judges pending"}
              </Alert>
            )}
            {biasJudges.length > 0 && (
              <Alert tone="red" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                {"فجوة كبيرة في تقييم " + biasJudges.map(b => "B" + (b.i + 1)).join(", ") + " (انحراف أكبر من 0.5)"}
              </Alert>
            )}
            {maxGap > 0.5 && (
              <Alert tone="red" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                {"Gap of " + maxGap.toFixed(3) + " between Judge B scores — review recommended"}
              </Alert>
            )}
            {approvedCount === totalSlots && biasJudges.length === 0 && maxGap <= 0.5 && (
              <Alert tone="emerald" icon={<CheckCircle className="h-3.5 w-3.5" />}>
                جميع القضاة متصلون ومتوافقون · All judges aligned
              </Alert>
            )}
          </div>
        </div>

        <button onClick={onOpenChat}
          className="w-full h-11 rounded-2xl border font-heading font-black text-sm tracking-wider transition-all flex items-center justify-center gap-2"
          style={{ background: `${ORANGE}15`, borderColor: `${ORANGE}66`, color: ORANGE }}>
          <Bot className="h-4 w-4" /> OPEN AI CHAT
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "orange" | "emerald" | "red" }) {
  const cls = {
    orange:  { color: ORANGE, borderColor: `${ORANGE}40`, background: `${ORANGE}0D` },
    emerald: { color: "#34d399", borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.05)" },
    red:     { color: "#ef4444", borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" },
  }[accent];
  return (
    <div className="rounded-xl border p-2.5" style={cls}>
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-body">{label}</p>
      <p className="text-xl font-heading font-black tabular-nums mt-0.5" dir="ltr">{value}</p>
    </div>
  );
}

function Alert({ tone, icon, children }: { tone: "red" | "amber" | "emerald"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = {
    red:     "bg-red-500/10 border-red-500/30 text-red-400",
    amber:   "bg-amber-500/10 border-amber-400/30 text-amber-300",
    emerald: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-body leading-tight ${cls}`}>
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/* ===========================================================
   CONTENT SHEET MODAL — Difficulty movements pre-registered
   =========================================================== */
function ContentSheetModal({
  athlete,
  onClose,
}: {
  athlete: { id: string; name: string; country: string; category: string; difficultySheet?: import("@/store/competition-store").DifficultyMovement[] };
  onClose: () => void;
}) {
  const sheet = athlete.difficultySheet ?? [];
  const total = sheet.reduce((s, m) => s + (m.value || 0), 0);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl mx-4 rounded-3xl bg-[#0a0a0a] border p-5 max-h-[80vh] flex flex-col"
        style={{ borderColor: `${GOLD}66`, boxShadow: `0 0 60px ${GOLD}33` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" style={{ color: GOLD }} />
              <p className="text-sm font-heading font-black text-white tracking-wider">CONTENT SHEET</p>
            </div>
            <p className="text-xs text-white/60 font-body mt-1 truncate" dir="auto">
              {athlete.name} · {athlete.country} · {athlete.category}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white flex items-center justify-center shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sheet.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center py-10">
            <div>
              <FileText className="h-10 w-10 mx-auto text-white/20 mb-2" />
              <p className="text-xs text-white/50 font-body">
                لا توجد حركات صعوبة مسجلة لهذا الرياضي.
              </p>
              <p className="text-[10px] text-white/30 font-body mt-1" dir="ltr">
                Import via Excel from the Technical Assistant panel.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sheet.map((m, i) => (
                <div
                  key={`${m.code}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-8 px-2 rounded-md font-heading font-black text-xs tabular-nums flex items-center justify-center shrink-0"
                      style={{ background: `${GOLD}1A`, color: GOLD, border: `1px solid ${GOLD}55` }}
                      dir="ltr"
                    >
                      {m.code}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-heading font-bold text-white truncate" dir="ltr">{m.label}</p>
                      <p className="text-[10px] text-white/40 font-body" dir="ltr">{m.connection}</p>
                    </div>
                  </div>
                  <p className="text-sm font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
                    +{m.value.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-body">
                Total Difficulty Value
              </span>
              <span className="text-2xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
                {total.toFixed(3)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===========================================================
   ATOMIC RESET — "Next Athlete" button (Chief side)
   - Archives current_match's athlete (if a result exists in match_results
     it stays; we don't delete it).
   - Clears current_match (athlete null, timer idle, elapsed 0).
   - Clears judge_scores + judge_status for the session so all judges
     revert to "Waiting for Athlete".
   =========================================================== */
function NextAthleteButton({
  sessionCode, onReset,
}: {
  sessionCode: string | null;
  onReset: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    if (!sessionCode || busy) return;
    if (!confirm("إعادة التعيين والانتقال للرياضي التالي؟\nReset and move to next athlete?")) return;
    setBusy(true);
    try {
      // a) Clear current_match (set athlete null, timer idle)
      await supabase.from("current_match").upsert(
        {
          session_code: sessionCode,
          athlete_id: null,
          style: null,
          timer_state: "idle",
          started_at: null,
          elapsed_ms: 0,
          payload: {} as never,
          ta_deductions: {} as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_code" },
      );
      // b) Clear judge_scores for the session
      await supabase.from("judge_scores").delete().eq("session_code", sessionCode);
      // c) Clear judge_status for the session
      await supabase.from("judge_status").delete().eq("session_code", sessionCode);
      // d) Local reset
      onReset();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={busy || !sessionCode}
      title="إعادة التعيين / الرياضي التالي"
      className="h-9 px-4 rounded-xl font-heading font-black text-[11px] tracking-[0.25em] flex items-center gap-2 transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: "rgba(239,68,68,0.12)",
        borderColor: "rgba(239,68,68,0.5)",
        color: "#fecaca",
      }}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {busy ? "..." : "NEXT ATHLETE"}
    </button>
  );
}

/* ===========================================================
   RAW JUDGES BREAKDOWN — every received submission visible to Chief
   - For Group A: shows each judge's deduction codes & their resulting score
   - For Group B: shows each judge's raw score (with kept/dropped role)
   - For Group C: shows each judge's success count + final value
   =========================================================== */
type RawScoreRow = {
  judge_slot: string;
  judge_role: string;
  score: number | null;
  payload: { codes?: string[]; deductions?: { code: string; value: number; label?: string }[]; attempts?: { code: string; successful: boolean; value: number }[] } | null;
};

function RawJudgesBreakdown({
  sessionCode, athleteId, bRoles,
}: {
  sessionCode: string | null;
  athleteId: string | null;
  bRoles: Record<string, "high" | "low" | "kept">;
}) {
  const [rows, setRows] = useState<RawScoreRow[]>([]);
  useEffect(() => {
    if (!sessionCode || !athleteId) { setRows([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("judge_scores")
        .select("judge_slot,judge_role,score,payload")
        .eq("session_code", sessionCode)
        .eq("athlete_id", athleteId);
      if (!cancelled) setRows((data ?? []) as unknown as RawScoreRow[]);
    };
    load();
    const ch = supabase
      .channel(`raw-${sessionCode}-${athleteId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => { load(); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode, athleteId]);

  const aRows = rows.filter(r => (r.judge_role === "A" || r.judge_slot.startsWith("A"))).sort((a,b)=>a.judge_slot.localeCompare(b.judge_slot));
  const bRows = rows.filter(r => (r.judge_role === "B" || r.judge_slot.startsWith("B"))).sort((a,b)=>a.judge_slot.localeCompare(b.judge_slot));
  const cRows = rows.filter(r => (r.judge_role === "C" || r.judge_slot.startsWith("C"))).sort((a,b)=>a.judge_slot.localeCompare(b.judge_slot));

  if (!athleteId) return null;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2 text-[10px] text-white/40 font-body">
        في انتظار إرسالات الحكام · Waiting for judge submissions…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md px-3 py-2 shrink-0">
      <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-body mb-1.5">
        Raw Judge Submissions · بيانات الحكام الخام
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
        {/* Group A */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-2">
          <p className="text-[9px] font-heading font-black tracking-[0.3em] text-emerald-400 mb-1.5">A · QUALITY</p>
          {aRows.length === 0 ? (
            <p className="text-[10px] text-white/30 italic">— no submissions —</p>
          ) : (
            <div className="space-y-1.5">
              {aRows.map(r => {
                const codes = r.payload?.codes ?? r.payload?.deductions?.map(d => d.code) ?? [];
                return (
                  <div key={r.judge_slot} className="flex items-start justify-between gap-2 rounded-lg bg-black/30 border border-white/5 px-2 py-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-heading font-black text-emerald-300" dir="ltr">{r.judge_slot}</span>
                        <span className="text-[9px] text-white/40 font-body" dir="ltr">{codes.length} codes</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {codes.length === 0 ? (
                          <span className="text-[9px] text-white/30 italic">no deductions</span>
                        ) : codes.map((c, i) => (
                          <span key={`${c}-${i}`} className="px-1 py-0 rounded text-[9px] font-mono tabular-nums border border-emerald-500/30 bg-emerald-500/10 text-emerald-200" dir="ltr">{c}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm font-heading font-black tabular-nums text-emerald-300 shrink-0" dir="ltr">
                      {r.score !== null ? r.score.toFixed(3) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Group B */}
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-2">
          <p className="text-[9px] font-heading font-black tracking-[0.3em] mb-1.5" style={{ color: GOLD }}>B · PERFORMANCE</p>
          {bRows.length === 0 ? (
            <p className="text-[10px] text-white/30 italic">— no submissions —</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {bRows.map(r => {
                const role = bRoles[r.judge_slot];
                const dropped = role === "high" || role === "low";
                const kept = role === "kept";
                const color = dropped ? "#ef4444" : kept ? "#34d399" : GOLD;
                return (
                  <div key={r.judge_slot} className="flex items-center justify-between rounded-lg bg-black/30 border px-2 py-1.5"
                    style={{ borderColor: `${color}55` }}>
                    <div>
                      <p className="text-[10px] font-heading font-black" style={{ color }} dir="ltr">{r.judge_slot}</p>
                      <p className="text-[8px] uppercase tracking-wider" style={{ color: `${color}cc` }}>
                        {dropped ? `Dropped (${role})` : kept ? "Counted" : "—"}
                      </p>
                    </div>
                    <span className="text-base font-heading font-black tabular-nums" style={{ color }} dir="ltr">
                      {r.score !== null ? r.score.toFixed(3) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Group C */}
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.04] p-2">
          <p className="text-[9px] font-heading font-black tracking-[0.3em] text-cyan-300 mb-1.5">C · DIFFICULTY</p>
          {cRows.length === 0 ? (
            <p className="text-[10px] text-white/30 italic">— no submissions —</p>
          ) : (
            <div className="space-y-1.5">
              {cRows.map(r => {
                const attempts = r.payload?.attempts ?? [];
                const ok = attempts.filter(a => a.successful).length;
                return (
                  <div key={r.judge_slot} className="flex items-center justify-between rounded-lg bg-black/30 border border-white/5 px-2 py-1">
                    <div>
                      <p className="text-[10px] font-heading font-black text-cyan-300" dir="ltr">{r.judge_slot}</p>
                      <p className="text-[9px] text-white/50 font-body" dir="ltr">
                        {attempts.length > 0 ? `${ok}/${attempts.length} success` : "score only"}
                      </p>
                    </div>
                    <span className="text-base font-heading font-black tabular-nums text-cyan-300" dir="ltr">
                      {r.score !== null ? r.score.toFixed(3) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
