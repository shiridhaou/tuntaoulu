import { supabase } from "@/integrations/supabase/client";
import { ensureDeviceSession, joinSessionMembership } from "@/lib/sessionMembership";

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
/**
 * Push a PROVISIONAL (not yet submitted) judge score so the Chief, TA and the
 * public scoreboard follow the running total live. Rows are flagged
 * `submitted: false` so they never count as a formal submission.
 */
export async function pushLiveJudgeScore(args: {
  sessionCode: string;
  judgeSlot: string;
  judgeRole: "A" | "B" | "C";
  athleteId: string | null;
  score: number;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sessionCode = (args.sessionCode ?? "").trim().toUpperCase();
  if (!sessionCode || !args.judgeSlot) return;
  try {
    let del = supabase
      .from("judge_scores")
      .delete()
      .eq("session_code", sessionCode)
      .eq("judge_slot", args.judgeSlot)
      .eq("submitted", false);
    del = args.athleteId ? del.eq("athlete_id", args.athleteId) : del.is("athlete_id", null);
    await del;
    await supabase.from("judge_scores").insert({
      session_code: sessionCode,
      judge_slot: args.judgeSlot,
      judge_role: args.judgeRole,
      athlete_id: args.athleteId,
      score: args.score,
      payload: (args.payload ?? {}) as never,
      submitted: false,
    });
  } catch {
    /* live preview only — silent */
  }
}

export async function submitJudgeScore(args: {
  sessionCode: string;
  judgeSlot: string;        // e.g. "A1", "B3", "C2"
  judgeRole: "A" | "B" | "C";
  athleteId: string | null;
  score: number;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { judgeSlot, judgeRole, athleteId, score, payload = {} } = args;
  // Canonical code: URL / localStorage / manual entry may differ in case or spacing.
  const sessionCode = (args.sessionCode ?? "").trim().toUpperCase()
    || (typeof window !== "undefined"
      ? (window.localStorage.getItem("taolu.sessionCode") ?? "").trim().toUpperCase()
      : "");
  if (!sessionCode) return { ok: false, error: "كود الجلسة غير متوفر — أعد الدخول بالرمز" };
  try {
    // 0) Guarantee a device identity + membership row (RLS needs both, and a
    //    missing membership is what made the session look "not found").
    await ensureDeviceSession();
    await joinSessionMembership(sessionCode, judgeRole, judgeSlot);

    // 1) Validate session is active. The direct read can be hidden by RLS, so
    //    fall back to the security-definer check before failing the judge.
    const { data: session } = await supabase
      .from("sessions").select("active").eq("code", sessionCode).maybeSingle();
    if (session && !session.active) return { ok: false, error: "الجلسة غير نشطة" };
    if (!session) {
      const { data: active, error: rpcErr } = await supabase.rpc("is_active_session", { _code: sessionCode });
      if (rpcErr) return { ok: false, error: `تعذّر التحقق من الجلسة: ${rpcErr.message}` };
      if (!active) return { ok: false, error: "رمز الجلسة غير موجود أو غير نشط" };
    }

    // 2) Validate current_match athlete matches (when a match row is visible)
    const { data: cm } = await supabase
      .from("current_match").select("athlete_id, timer_state")
      .eq("session_code", sessionCode).maybeSingle();
    if (cm && athleteId && cm.athlete_id && cm.athlete_id !== athleteId) {
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
