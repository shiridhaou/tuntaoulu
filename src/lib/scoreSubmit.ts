import { supabase } from "@/integrations/supabase/client";

/**
 * Push a judge score to the shared judge_scores table so the Chief Referee
 * dashboard receives it in real time.
 *
 * Strict validation:
 *  1. The session must exist and be active (`sessions.active = true`).
 *  2. There must be a current_match for that session.
 *  3. The athleteId provided MUST match current_match.athlete_id (otherwise the
 *     judge is scoring a stale athlete and the chief would never see it).
 *
 * If validation fails the function returns `{ ok: false, error }` so the judge
 * UI can surface a real error toast instead of a misleading success.
 */
export async function submitJudgeScore(args: {
  sessionCode: string;
  judgeSlot: string;        // e.g. "A1", "B3", "C2"
  judgeRole: "A" | "B" | "C";
  athleteId: string | null;
  score: number;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { sessionCode, judgeSlot, judgeRole, athleteId, score, payload = {} } = args;
  try {
    // 1) Validate session is active
    const { data: session, error: sErr } = await supabase
      .from("sessions").select("active").eq("code", sessionCode).maybeSingle();
    if (sErr) return { ok: false, error: `جلسة غير صالحة: ${sErr.message}` };
    if (!session) return { ok: false, error: "رمز الجلسة غير موجود" };
    if (!session.active) return { ok: false, error: "الجلسة غير نشطة" };

    // 2) Validate current_match athlete matches
    const { data: cm } = await supabase
      .from("current_match").select("athlete_id, timer_state")
      .eq("session_code", sessionCode).maybeSingle();
    if (!cm) return { ok: false, error: "لا توجد مباراة جارية — انتظر الحكم الرئيسي" };
    if (cm.athlete_id !== athleteId) {
      return { ok: false, error: "الرياضي تغيّر — حدّث الشاشة قبل الإرسال" };
    }

    // 3) Remove any prior submission from this slot for this athlete
    let del = supabase
      .from("judge_scores")
      .delete()
      .eq("session_code", sessionCode)
      .eq("judge_slot", judgeSlot);
    if (athleteId) del = del.eq("athlete_id", athleteId);
    else del = del.is("athlete_id", null);
    await del;

    // 4) Insert the new score
    const { error } = await supabase.from("judge_scores").insert({
      session_code: sessionCode,
      judge_slot: judgeSlot,
      judge_role: judgeRole,
      athlete_id: athleteId,
      score,
      payload: payload as never,
      submitted: true,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "submit failed" };
  }
}
