import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reports a judge's status to the technical assistant monitor.
 * Call with state="judging" while evaluating, state="sent" after submission.
 */
export function useJudgeStatus(
  sessionCode: string | null,
  judgeSlot: string | null,
  state: "judging" | "sent",
  athleteId: string | null = null,
) {
  useEffect(() => {
    if (!sessionCode || !judgeSlot) return;
    void supabase
      .from("judge_status")
      .upsert(
        {
          session_code: sessionCode,
          judge_slot: judgeSlot,
          state,
          athlete_id: athleteId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_code,judge_slot" },
      );
  }, [sessionCode, judgeSlot, state, athleteId]);
}
