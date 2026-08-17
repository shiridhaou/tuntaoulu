/**
 * useMatchTimer.ts
 * ----------------------------------------------------------------------------
 * Encapsulates the official match timer: realtime sync (via useMatchSync),
 * start/stop/reset controls, and the Out-of-Bounds + time-deduction
 * broadcasting that rides alongside it. The Technical Assistant is the
 * timer's master — every transition here is written to `current_match` so
 * Chief, Judges, and the Public Display all observe the same clock.
 *
 * Scope note: this hook does NOT decide which athlete is "live" — that
 * requires merging realtime state with local fallback logic that belongs to
 * the caller (see TechnicalAssistantDashboard's `liveAthlete` derivation).
 * Instead it exposes the raw `athleteId` from the realtime channel and a
 * pure `computeMatchPhase` helper, so the caller can combine them with its
 * own athlete-resolution logic without this hook needing to know about it.
 * ----------------------------------------------------------------------------
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { matchControl, useMatchSync, broadcastSessionState } from "@/hooks/useMatchSync";
import { checkCategoryTime, getCategoryRule } from "@/lib/categoryTimeRules";

// ============================================================================
// Types
// ============================================================================

export type MatchPhase = "pre" | "live" | "post";

export interface TaDeductionsPayload {
  time: { value: number; reason: string; drift: number; direction: "ok" | "over" | "under"; elapsed: number };
  oob: { count: number; value: number };
  total: number;
}

interface UseMatchTimerOptions {
  sessionCode: string | null;
  /** IWUF time-rule id used to compute automatic time deductions. */
  timeRuleId: string;
  /** Current style category — only needed to seed a brand-new current_match row. */
  styleCategory: string;
  /** Optional sink for a human-readable event-log entry (type, label). */
  onLog?: (type: string, label: string) => void;
}

interface UseMatchTimerResult {
  timerSec: number;
  timerRunning: boolean;
  /** Athlete id from the realtime current_match row (raw — no local fallback). */
  athleteId: string | null;
  oobPoints: number;
  /** Bump counter consumers can key a framer-motion pulse animation on. */
  oobPulse: number;
  /** Starts the authoritative countdown. Pass the athlete about to go live so
   *  a brand-new current_match row (if one doesn't exist yet) is seeded correctly. */
  timerStart: (liveAthleteId?: string | null) => Promise<void>;
  timerStop: () => Promise<void>;
  timerReset: () => Promise<void>;
  adjustOob: (delta: number) => Promise<void>;
  /** Resets the local OOB counter to zero without touching the timer itself
   *  (callers use this when starting a new athlete's match). */
  resetOob: () => void;
  broadcastTaDeductions: (opts: { atSec: number; oob: number; final?: boolean }) => Promise<void>;
}

// ============================================================================
// Pure helpers
// ============================================================================

/**
 * Derives the match phase from whether an athlete is live and the timer's
 * own state. Pure function — no hook, no state — so callers can compute it
 * from whatever "live athlete" resolution logic they already own.
 */
export function computeMatchPhase(hasLiveAthlete: boolean, timerRunning: boolean, timerSec: number): MatchPhase {
  if (!hasLiveAthlete) return "pre";
  if (timerRunning) return "live";
  if (timerSec > 0) return "post";
  return "pre";
}

async function emitMatchEvent(sessionCode: string | null, event_type: string, payload: Record<string, any> = {}) {
  if (!sessionCode) return;
  await supabase.from("match_events").insert({ session_code: sessionCode, event_type, payload });
}

// ============================================================================
// Hook
// ============================================================================

export function useMatchTimer({
  sessionCode,
  timeRuleId,
  styleCategory,
  onLog,
}: UseMatchTimerOptions): UseMatchTimerResult {
  // Single realtime subscription for this session's match state — timerSec /
  // timerRunning / athleteId are all derived from it.
  const sync = useMatchSync(sessionCode);
  const timerSec = sync.elapsedSec;
  const timerRunning = sync.timerState === "running";
  const athleteId = sync.athleteId ?? null;

  const [oobPoints, setOobPoints] = useState(0);
  const [oobPulse, setOobPulse] = useState(0);

  const log = useCallback((type: string, label: string) => onLog?.(type, label), [onLog]);

  const broadcastTaDeductions = useCallback(async (opts: { atSec: number; oob: number; final?: boolean }) => {
    if (!sessionCode) return;
    const t = opts.final
      ? checkCategoryTime(timeRuleId, opts.atSec)
      : { value: 0, reason: "—", direction: "ok" as const, drift: 0, rule: getCategoryRule(timeRuleId) };
    const oobValue = Math.round(opts.oob * 0.1 * 10) / 10;
    const total = Math.round((t.value + oobValue) * 10) / 10;
    const payload: TaDeductionsPayload = {
      time: { value: t.value, reason: t.reason, drift: t.drift, direction: t.direction, elapsed: opts.atSec },
      oob: { count: opts.oob, value: oobValue },
      total,
    };
    await supabase.from("current_match")
      .update({ ta_deductions: payload as never, updated_at: new Date().toISOString() })
      .eq("session_code", sessionCode);
  }, [sessionCode, timeRuleId]);

  const timerStart = useCallback(async (liveAthleteId: string | null = null) => {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    try {
      // matchControl.start() UPDATEs the row — make sure it exists first,
      // otherwise the click silently does nothing and the clock never moves.
      const { data: existing } = await supabase
        .from("current_match").select("session_code")
        .eq("session_code", sessionCode).maybeSingle();
      if (!existing) {
        await supabase.from("current_match").upsert({
          session_code: sessionCode,
          athlete_id: liveAthleteId,
          style: styleCategory,
          timer_state: "idle",
          started_at: null,
          elapsed_ms: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "session_code" });
      }
      await matchControl.start(sessionCode);
      // Instant unlock for every judge panel — realtime replication can lag,
      // so the timer transition also rides the low-latency broadcast channel.
      await broadcastSessionState(sessionCode, {
        athlete_id: liveAthleteId,
        style: styleCategory,
        timer_state: "running",
        started_at: new Date().toISOString(),
        payload: { match_started: true, phase: "live" },
      });
      await emitMatchEvent(sessionCode, "timer_start", { at: timerSec });
      log("time", "▶ تشغيل المؤقت");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر تشغيل المؤقت");
    }
  }, [sessionCode, styleCategory, timerSec, log]);

  const timerStop = useCallback(async () => {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    await matchControl.pause(sessionCode);
    await broadcastSessionState(sessionCode, {
      timer_state: "stopped",
      started_at: null,
      elapsed_ms: timerSec * 1000,
      payload: { phase: "post" },
    });
    await emitMatchEvent(sessionCode, "timer_stop", { at: timerSec });
    await broadcastTaDeductions({ atSec: timerSec, oob: oobPoints, final: true });
    const td = checkCategoryTime(timeRuleId, timerSec);
    if (td.value > 0) {
      log("time", `⏱ ${td.reason} → −${td.value.toFixed(2)}`);
      toast.warning(`خصم زمني تلقائي −${td.value.toFixed(2)} · ${td.reason}`);
    } else if (timerSec > 0) {
      log("time", `⏱ ضمن الزمن المسموح (${timerSec}s)`);
    }
  }, [sessionCode, timerSec, oobPoints, timeRuleId, broadcastTaDeductions, log]);

  const timerReset = useCallback(async () => {
    if (!sessionCode) return;
    await matchControl.reset(sessionCode);
    await broadcastSessionState(sessionCode, {
      timer_state: "idle",
      started_at: null,
      elapsed_ms: 0,
      payload: { phase: "pre", match_started: false },
    });
    await emitMatchEvent(sessionCode, "timer_reset");
    await supabase.from("current_match")
      .update({ ta_deductions: { time: { value: 0 }, oob: { count: 0, value: 0 }, total: 0 } as never })
      .eq("session_code", sessionCode);
  }, [sessionCode]);

  const adjustOob = useCallback(async (delta: number) => {
    const next = Math.max(0, oobPoints + delta);
    setOobPoints(next);
    if (delta > 0) setOobPulse((p) => p + 1);
    await emitMatchEvent(sessionCode, "oob_adjust", { at: timerSec, delta, total: next });
    log("oob", `OOB ${delta > 0 ? "+" : ""}${delta} (total ${next})`);
    await broadcastTaDeductions({ atSec: timerSec, oob: next, final: !timerRunning && timerSec > 0 });
  }, [oobPoints, sessionCode, timerSec, timerRunning, broadcastTaDeductions, log]);

  const resetOob = useCallback(() => setOobPoints(0), []);

  return {
    timerSec,
    timerRunning,
    athleteId,
    oobPoints,
    oobPulse,
    timerStart,
    timerStop,
    timerReset,
    adjustOob,
    resetOob,
    broadcastTaDeductions,
  };
}
