import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hybrid timer synchronization.
 * - Chief = authority. Writes timer_state + started_at + elapsed_ms to current_match.
 * - All other clients subscribe and compute elapsed locally from started_at.
 *
 * State machine:
 *   idle    -> no athlete or reset; elapsed = 0
 *   running -> started_at set; elapsed = (now - started_at) + base_elapsed_ms
 *   stopped -> elapsed frozen at elapsed_ms (final)
 */

export type TimerState = "idle" | "running" | "stopped";

export interface MatchSyncRow {
  session_code: string;
  athlete_id: string | null;
  timer_state: TimerState;
  started_at: string | null;
  elapsed_ms: number;
  style: string | null;
  payload: Record<string, unknown> | null;
  updated_at: string;
}

export interface MatchSyncSnapshot {
  athleteId: string | null;
  timerState: TimerState;
  elapsedSec: number;
  style: string | null;
  payload: Record<string, unknown> | null;
}

/** Subscribe to current_match for a session and return live elapsed seconds. */
export function useMatchSync(sessionCode: string | null): MatchSyncSnapshot {
  const [row, setRow] = useState<MatchSyncRow | null>(null);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1) Initial fetch + realtime subscription
  useEffect(() => {
    if (!sessionCode) {
      setRow(null);
      return;
    }
    let cancelled = false;

    supabase
      .from("current_match")
      .select("*")
      .eq("session_code", sessionCode)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setRow(data as unknown as MatchSyncRow);
      });

    // Unique channel name per mount to avoid "callbacks after subscribe" error
    // when StrictMode double-invokes effects or when sessionCode changes rapidly.
    const channelName = `cm-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel(channelName);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
      (payload) => {
        if (payload.eventType === "DELETE") setRow(null);
        else setRow(payload.new as unknown as MatchSyncRow);
      },
    ).subscribe();

    // Low-latency fallback: the Technical Assistant also pushes a lightweight
    // `session_state_change` broadcast whenever style / mode / category change,
    // so judge panels update even if postgres replication lags.
    const bc = supabase.channel(sessionStateChannel(sessionCode));
    bc.on("broadcast", { event: SESSION_STATE_EVENT }, ({ payload }) => {
      const p = (payload ?? {}) as Partial<MatchSyncRow>;
      setRow((prev) => ({
        session_code: sessionCode,
        athlete_id: prev?.athlete_id ?? null,
        timer_state: prev?.timer_state ?? "idle",
        started_at: prev?.started_at ?? null,
        elapsed_ms: prev?.elapsed_ms ?? 0,
        style: p.style !== undefined ? p.style : (prev?.style ?? null),
        payload: { ...(prev?.payload ?? {}), ...((p.payload as Record<string, unknown>) ?? {}) },
        updated_at: new Date().toISOString(),
      }));
    }).subscribe();

    return () => {
      cancelled = true;
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
      try { supabase.removeChannel(bc); } catch { /* ignore */ }
    };
  }, [sessionCode]);


  // 2) Local 1Hz tick only while running
  useEffect(() => {
    if (row?.timer_state === "running") {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 250);
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [row?.timer_state]);

  // 3) Compute elapsed locally from authoritative started_at
  let elapsedSec = 0;
  if (row) {
    if (row.timer_state === "running" && row.started_at) {
      const base = row.elapsed_ms ?? 0;
      const delta = Date.now() - new Date(row.started_at).getTime();
      elapsedSec = Math.max(0, Math.floor((base + delta) / 1000));
    } else {
      elapsedSec = Math.floor((row.elapsed_ms ?? 0) / 1000);
    }
  }
  // tick is read to satisfy lint (forces re-render)
  void tick;

  return {
    athleteId: row?.athlete_id ?? null,
    timerState: row?.timer_state ?? "idle",
    elapsedSec,
    style: row?.style ?? null,
    payload: row?.payload ?? null,
  };
}

/** Chief-only helpers to mutate the authoritative timer. */
export const matchControl = {
  async setAthlete(
    sessionCode: string,
    athleteId: string | null,
    style: string | null,
    payload: Record<string, unknown> = {},
  ) {
    await supabase.from("current_match").upsert(
      {
        session_code: sessionCode,
        athlete_id: athleteId,
        style,
        timer_state: "idle",
        started_at: null,
        elapsed_ms: 0,
        payload: payload as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_code" },
    );
  },
  async start(sessionCode: string) {
    // Resume from current elapsed_ms — read it first.
    const { data } = await supabase
      .from("current_match")
      .select("elapsed_ms")
      .eq("session_code", sessionCode)
      .maybeSingle();
    const base = (data as { elapsed_ms?: number } | null)?.elapsed_ms ?? 0;
    await supabase
      .from("current_match")
      .update({
        timer_state: "running",
        started_at: new Date().toISOString(),
        elapsed_ms: base,
        updated_at: new Date().toISOString(),
      })
      .eq("session_code", sessionCode);
  },
  async pause(sessionCode: string) {
    const { data } = await supabase
      .from("current_match")
      .select("started_at, elapsed_ms")
      .eq("session_code", sessionCode)
      .maybeSingle();
    const r = data as { started_at?: string | null; elapsed_ms?: number } | null;
    const base = r?.elapsed_ms ?? 0;
    const delta = r?.started_at ? Date.now() - new Date(r.started_at).getTime() : 0;
    await supabase
      .from("current_match")
      .update({
        timer_state: "stopped",
        started_at: null,
        elapsed_ms: base + delta,
        updated_at: new Date().toISOString(),
      })
      .eq("session_code", sessionCode);
  },
  async stop(sessionCode: string) {
    return matchControl.pause(sessionCode);
  },
  async reset(sessionCode: string) {
    await supabase
      .from("current_match")
      .update({
        timer_state: "idle",
        started_at: null,
        elapsed_ms: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("session_code", sessionCode);
  },
};
