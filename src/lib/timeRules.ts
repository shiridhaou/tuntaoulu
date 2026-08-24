/**
 * IWUF official time windows per style.
 * Returns { min, max } in seconds. If `min === max` the rule is exact.
 *
 * Time deduction rule (IWUF Routines & Apparatus rules):
 *  - Out of window by ≤ 2 s   → −0.10
 *  - Out of window by 2 – 5 s → −0.20
 *  - Out of window by > 5 s   → −0.30
 *
 * The deduction is the same whether the athlete went under OR over the window.
 */
export type TimeWindow = { min: number; max: number };

export const TIME_WINDOWS: Record<string, TimeWindow> = {
  changquan:  { min: 80,  max: 80  },  // ≥ 1:20
  nanquan:    { min: 80,  max: 80  },  // ≥ 1:20
  taijiquan:  { min: 180, max: 240 },  // 3:00 – 4:00
  traditional:{ min: 60,  max: 90  },  // 1:00 – 1:30 (traditional fist & weapons)
};

export interface TimeDeductionResult {
  /** Penalty value (0, 0.1, 0.2, 0.3). */
  value: number;
  /** Human-readable reason. */
  reason: string;
  /** "under" | "over" | "ok". */
  direction: "under" | "over" | "ok";
  /** Seconds outside the legal window (positive). */
  drift: number;
  /** The window used. */
  window: TimeWindow;
}

/**
 * Compute the time-based deduction for a finished routine.
 * For Changquan/Nanquan the rule is "≥ 1:20" — only UNDER-time is penalised.
 * For Taiji & Traditional the routine must fall inside the [min, max] window.
 */
export function computeTimeDeduction(
  styleId: string | null,
  elapsedSec: number,
): TimeDeductionResult {
  const w = (styleId && TIME_WINDOWS[styleId]) || null;
  if (!w || elapsedSec <= 0) {
    return { value: 0, reason: "—", direction: "ok", drift: 0, window: { min: 0, max: 0 } };
  }

  // Single-bound styles (CQ/NQ): only under-time is penalised.
  const singleBound = w.min === w.max;
  let drift = 0;
  let direction: "under" | "over" | "ok" = "ok";

  if (elapsedSec < w.min) {
    drift = w.min - elapsedSec;
    direction = "under";
  } else if (!singleBound && elapsedSec > w.max) {
    drift = elapsedSec - w.max;
    direction = "over";
  }

  if (drift === 0) {
    return { value: 0, reason: "ضمن الزمن المسموح", direction: "ok", drift: 0, window: w };
  }

  // IWUF 2024 · Article 26: Taiji → −0.10 per 5 s drift, others → −0.10 per 2 s drift.
  const step = styleId === "taijiquan" ? 5 : 2;
  const value = Math.round(Math.ceil(drift / step) * 0.1 * 100) / 100;

  const verb = direction === "under" ? "أقل من" : "أكثر من";
  const reason = `زمن الأداء ${verb} المسموح به بـ ${drift}ث`;
  return { value, reason, direction, drift, window: w };
}

export function fmtWindow(w: TimeWindow): string {
  const f = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return w.min === w.max ? `≥ ${f(w.min)}` : `${f(w.min)} – ${f(w.max)}`;
}
