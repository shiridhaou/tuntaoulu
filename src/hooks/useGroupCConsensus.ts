import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeGroupCConsensus, type ChiefOverride, type GroupCConsensus, type GroupCRow,
} from "@/lib/groupCConsensus";

/** Live Group C votes (C1/C2/C3) streamed from judge_scores via Realtime. */
export function useGroupCConsensus(
  sessionCode: string | null,
  athleteId: string | null,
  overrides: Record<string, ChiefOverride>,
): GroupCConsensus {
  const [rows, setRows] = useState<GroupCRow[]>([]);

  useEffect(() => {
    if (!sessionCode) { setRows([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("judge_scores")
        .select("judge_slot, judge_role, athlete_id, score, submitted, payload, updated_at")
        .eq("session_code", sessionCode)
        .eq("judge_role", "C");
      if (!cancelled) setRows((data ?? []) as unknown as GroupCRow[]);
    };
    void load();
    const ch = supabase
      .channel(`group-c-consensus-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);

  return useMemo(() => computeGroupCConsensus(rows, athleteId, overrides), [rows, athleteId, overrides]);
}
