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

/** Realtime broadcast channel used for instant config (style / mode) pushes. */
export const SESSION_STATE_EVENT = "session_state_change";
export const sessionStateChannel = (code: string) => `session-state-${code}`;

/**
 * A single shared channel instance per session topic.
 * Joining the same topic twice on one socket makes supabase-js error out
 * ("tried to subscribe multiple times"), which silently killed TA broadcasts
 * (e.g. the green Start button) because the TA also *listens* on that topic.
 */
const stateChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function getSessionStateChannel(code: string) {
  const topic = sessionStateChannel(code);
  let ch = stateChannels.get(topic);
  if (!ch) {
    ch = supabase.channel(topic, { config: { broadcast: { self: true } } });
    stateChannels.set(topic, ch);
  }
  return ch;
}

/**
 * Push an immediate style / match-mode / category change to every connected
 * panel. This is a UI-level broadcast only — the authoritative row in
 * `current_match` is still written by the caller.
 */
export async function broadcastSessionState(
  sessionCode: string,
  patch: {
    style?: string | null;
    athlete_id?: string | null;
    payload?: Record<string, unknown>;
    timer_state?: TimerState;
    started_at?: string | null;
    elapsed_ms?: number;
  },
) {
  const ch = getSessionStateChannel(sessionCode);
  if (ch.state !== "joined") {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if (ch.state === "closed" || ch.state === "errored" || ch.state === "leaving") {
        ch.subscribe((status) => { if (status === "SUBSCRIBED") done(); });
      } else {
        // already joining — just wait a beat for the join to settle
        ch.subscribe((status) => { if (status === "SUBSCRIBED") done(); });
      }
      setTimeout(done, 1500);
    });
  }
  try {
    await ch.send({ type: "broadcast", event: SESSION_STATE_EVENT, payload: patch });
  } catch { /* never block the operator UI on a broadcast failure */ }
}



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
        athlete_id: p.athlete_id !== undefined ? p.athlete_id : (prev?.athlete_id ?? null),
        timer_state: p.timer_state !== undefined ? p.timer_state : (prev?.timer_state ?? "idle"),
        started_at: p.started_at !== undefined ? p.started_at : (prev?.started_at ?? null),
        elapsed_ms: p.elapsed_ms !== undefined ? p.elapsed_ms : (prev?.elapsed_ms ?? 0),
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
