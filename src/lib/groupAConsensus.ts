/**
 * IWUF Group A consensus rule.
 *
 * Group A judges record deductions independently during the whole routine —
 * no simultaneous tapping is required. At total-score time a deduction code is
 * only VALIDATED (and therefore deducted) when it appears in the submitted
 * lists of AT LEAST TWO Group A judges. A code recorded by a single judge is
 * disregarded.
 *
 * Pure functions only — no side effects, no DB access.
 */

export interface GroupARow {
  judge_slot: string;
  judge_role: string;
  athlete_id?: string | null;
  submitted?: boolean | null;
  score?: number | null;
  payload?: {
    codes?: string[];
    deductions?: { code?: string; value?: number; label?: string }[];
  } | null;
}

export interface ConsensusCode {
  code: string;
  label: string;
  value: number;
  count: number;
  slots: string[];
}

export interface FlaggedCode {
  code: string;
  label: string;
  value: number;
  slot: string;
}

export interface GroupAConsensus {
  /** Codes confirmed by >= threshold judges — these are deducted. */
  confirmed: ConsensusCode[];
  /** Codes from a single judge — disregarded. */
  flagged: FlaggedCode[];
  /** Sum of the confirmed deduction values. */
  deduction: number;
  /** maxA - deduction, floored at 0. Null when no A judge has submitted. */
  score: number | null;
  /** Number of distinct Group A slots that submitted. */
  judgeCount: number;
  /** Judges required to validate a code (2, or 1 when a single A judge exists). */
  threshold: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isGroupARow(r: { judge_role: string; judge_slot: string }): boolean {
  return r.judge_role === "A" || r.judge_slot.startsWith("A");
}

export function computeGroupAConsensus(
  rows: GroupARow[],
  maxA: number,
  opts: { athleteId?: string | null; submittedOnly?: boolean } = {},
): GroupAConsensus {
  const relevant = rows.filter(r => {
    if (!isGroupARow(r)) return false;
    if (opts.athleteId && (r.athlete_id ?? null) !== opts.athleteId) return false;
    if (opts.submittedOnly && r.submitted === false) return false;
    return true;
  });

  // Keep one row per slot (latest wins in the order supplied).
  const bySlot = new Map<string, GroupARow>();
  relevant.forEach(r => bySlot.set(r.judge_slot, r));

  const judgeCount = bySlot.size;
  const threshold = judgeCount >= 2 ? 2 : 1;

  const slots = new Map<string, Set<string>>();
  const meta = new Map<string, { label: string; value: number }>();

  bySlot.forEach((row, slot) => {
    const deductions = Array.isArray(row.payload?.deductions) ? row.payload!.deductions! : [];
    const codes = Array.isArray(row.payload?.codes) ? row.payload!.codes! : [];
    const entries: { code: string; label?: string; value?: number }[] = deductions.length
      ? deductions.filter(d => !!d?.code).map(d => ({ code: String(d.code), label: d.label, value: d.value }))
      : codes.map(c => ({ code: String(c) }));

    entries.forEach(e => {
      if (!slots.has(e.code)) slots.set(e.code, new Set());
      slots.get(e.code)!.add(slot);
      const prev = meta.get(e.code);
      const value = typeof e.value === "number" ? e.value : prev?.value ?? 0;
      meta.set(e.code, { label: e.label ?? prev?.label ?? e.code, value });
    });
  });

  const confirmed: ConsensusCode[] = [];
  const flagged: FlaggedCode[] = [];

  slots.forEach((slotSet, code) => {
    const list = Array.from(slotSet);
    const m = meta.get(code) ?? { label: code, value: 0 };
    if (list.length >= threshold) {
      confirmed.push({ code, label: m.label, value: m.value, count: list.length, slots: list });
    } else {
      flagged.push({ code, label: m.label, value: m.value, slot: list[0] });
    }
  });

  confirmed.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  flagged.sort((a, b) => a.code.localeCompare(b.code));

  const deduction = round2(confirmed.reduce((s, c) => s + (c.value || 0), 0));
  const hasPayload = slots.size > 0;

  // No payload at all → fall back to the average of the submitted slot scores
  // so nothing regresses for judges on an older client.
  let score: number | null = null;
  if (hasPayload) {
    score = round2(Math.max(0, maxA - deduction));
  } else if (judgeCount > 0) {
    const nums = Array.from(bySlot.values())
      .map(r => (typeof r.score === "number" ? r.score : null))
      .filter((v): v is number => v !== null);
    score = nums.length ? round2(nums.reduce((s, v) => s + v, 0) / nums.length) : null;
  }

  return { confirmed, flagged, deduction, score, judgeCount, threshold };
}
