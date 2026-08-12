import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TeamConfig } from "@/store/competition-store";
import { DEFAULT_TEAM } from "@/store/competition-store";
import { MAX_JUDGE_SLOTS } from "@/lib/matchMode";

/**
 * Dynamic Judges Management — keeps team config (numA/numB/numC) in sync across
 * all screens (Chief, TA, Judges Monitor, Public Display) via current_match.payload.team.
 *
 * The TA is master alongside the Chief — both can mutate the team size live and
 * every connected client reflects the change instantly without page refresh.
 */

const MIN = 1;
// Official table layout supports up to 8 seats per group.
const MAX = MAX_JUDGE_SLOTS;

function clamp(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_TEAM.numA;
  return Math.max(MIN, Math.min(MAX, Math.round(n)));
}

function extract(payload: unknown): TeamConfig | null {
  const p = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null);
  if (!p) return null;
  const t = (p.team && typeof p.team === "object" ? (p.team as Record<string, unknown>) : null);
  if (!t) return null;
  return {
    numA: clamp(t.numA ?? DEFAULT_TEAM.numA),
    numB: clamp(t.numB ?? DEFAULT_TEAM.numB),
    numC: clamp(t.numC ?? DEFAULT_TEAM.numC),
  };
}

/** Subscribe to current_match.payload.team for the given session. */
export function useTeamSync(sessionCode: string | null): TeamConfig | null {
  const [team, setTeam] = useState<TeamConfig | null>(null);

  useEffect(() => {
    if (!sessionCode) { setTeam(null); return; }
    let cancelled = false;

    supabase
      .from("current_match")
      .select("payload")
      .eq("session_code", sessionCode)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const t = extract((data as { payload?: unknown } | null)?.payload);
        if (t) setTeam(t);
      });

    const ch = supabase
      .channel(`team-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        (payload: { new?: { payload?: unknown } }) => {
          const t = extract(payload.new?.payload);
          if (t) setTeam(t);
        },
      )
      .subscribe();

    return () => { cancelled = true; try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [sessionCode]);

  return team;
}

/** Push a new team config (merged into current_match.payload.team). */
export async function pushTeamConfig(sessionCode: string, team: TeamConfig): Promise<void> {
  const safe: TeamConfig = {
    numA: clamp(team.numA),
    numB: clamp(team.numB),
    numC: clamp(team.numC),
  };
  const { data } = await supabase
    .from("current_match")
    .select("payload")
    .eq("session_code", sessionCode)
    .maybeSingle();
  const prev = ((data as { payload?: Record<string, unknown> } | null)?.payload ?? {}) as Record<string, unknown>;
  const nextPayload = { ...prev, team: safe };

  const upd = await supabase
    .from("current_match")
    .update({ payload: nextPayload as never, updated_at: new Date().toISOString() })
    .eq("session_code", sessionCode)
    .select("session_code");

  if (upd.error || !upd.data || upd.data.length === 0) {
    await supabase.from("current_match").upsert(
      { session_code: sessionCode, payload: nextPayload as never, updated_at: new Date().toISOString() } as never,
      { onConflict: "session_code" } as never,
    );
  }
}

export const TEAM_LIMITS = { min: MIN, max: MAX } as const;
