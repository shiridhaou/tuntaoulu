import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeGroupAConsensus, type GroupARow, type GroupAConsensus } from "@/lib/groupAConsensus";

/**
 * Live Group A consensus for the current session + athlete.
 * Read-only: subscribes to `judge_scores` and derives the consensus set.
 */
export function useGroupAConsensus(
  sessionCode: string | null,
  athleteId: string | null,
  maxA: number,
): GroupAConsensus & { rows: GroupARow[] } {
  const [rows, setRows] = useState<GroupARow[]>([]);

  useEffect(() => {
    if (!sessionCode) { setRows([]); return; }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("judge_scores")
        .select("judge_slot, judge_role, athlete_id, score, submitted, payload")
        .eq("session_code", sessionCode)
        .eq("judge_role", "A");
      if (!cancelled) setRows((data ?? []) as unknown as GroupARow[]);
    };
    void load();

    // Unique suffix per mount: supabase.channel() reuses an existing channel
    // for the same topic, so a fixed name here makes a second mounted instance
    // add `.on()` after `.subscribe()` → "Cannot add postgres_changes callbacks
    // for realtime channel after subscribe()" crash.
    const ch = supabase
      .channel(`group-a-consensus-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => { void load(); },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);

  const consensus = useMemo(
    () => computeGroupAConsensus(rows, maxA, { athleteId }),
    [rows, maxA, athleteId],
  );

  return { ...consensus, rows };
}
