/**
 * Official Wushu Taolu scoring caps (Tunisian Federation / IWUF aligned).
 *
 * COMPULSORY (الأساليب الإلزامية) — total 10.00
 *   Group A (Technical Quality) ....... 7.00  (deductions subtracted from 7.00)
 *   Group B (Overall Performance) ..... 3.00
 *   Group C ........................... DISABLED
 *
 * OPTIONAL (الأساليب الاختيارية) — total 10.00
 *   Group A (Technical Quality) ....... 5.00
 *   Group B (Overall Performance) ..... 3.00
 *   Group C (Degree of Difficulty) .... 2.00
 *        · Movement difficulty (حركات الصعوبة) .. max 1.40
 *        · Connection difficulty (وضعيات الربط) . max 0.60
 */

export type MatchMode = "compulsory" | "optional";

export interface ModeCaps {
  maxA: number;
  maxB: number;
  maxC: number;
  /** Group C split — only meaningful in optional mode. */
  maxCMovement: number;
  maxCConnection: number;
  includeC: boolean;
  total: number;
  /** Max judges supported on the table for this mode. */
  maxJudges: number;
}

export const COMPULSORY_CAPS: ModeCaps = {
  maxA: 7.0,
  maxB: 3.0,
  maxC: 0,
  maxCMovement: 0,
  maxCConnection: 0,
  includeC: false,
  total: 10.0,
  maxJudges: 8,
};

export const OPTIONAL_CAPS: ModeCaps = {
  maxA: 5.0,
  maxB: 3.0,
  maxC: 2.0,
  maxCMovement: 1.4,
  maxCConnection: 0.6,
  includeC: true,
  total: 10.0,
  maxJudges: 11,
};

export function isCompulsory(mode: MatchMode | string | null | undefined): boolean {
  return mode === "compulsory";
}

/** Full cap set for a mode (defaults to optional). */
export function modeCaps(mode: MatchMode | string | null | undefined): ModeCaps {
  return isCompulsory(mode) ? COMPULSORY_CAPS : OPTIONAL_CAPS;
}

/** Group A ceiling: 7.00 compulsory · 5.00 optional. */
export function effectiveMaxA(mode: MatchMode | string | null | undefined, _base?: number): number {
  return modeCaps(mode).maxA;
}

/** Group B ceiling: 3.00 in BOTH modes (official rule). */
export function effectiveMaxB(mode: MatchMode | string | null | undefined, _base?: number): number {
  return modeCaps(mode).maxB;
}

/** Group C ceiling: 2.00 optional · 0 (disabled) compulsory. */
export function effectiveMaxC(mode: MatchMode | string | null | undefined, _base?: number): number {
  return modeCaps(mode).maxC;
}

/** Group C is only judged in Optional routines. */
export function includesGroupC(mode: MatchMode | string | null | undefined): boolean {
  return modeCaps(mode).includeC;
}

/** Default Group B starting score (perfect start) — 3.00 in both modes. */
export function defaultBStart(mode: MatchMode | string | null | undefined): number {
  return modeCaps(mode).maxB;
}

/** Compulsory table order: B1, A2, B3, A4, B5, A6, B7, B8 (8 seats). */
export const COMPULSORY_TABLE: string[] = ["B1", "A2", "B3", "A4", "B5", "A6", "B7", "B8"];

/** Maximum judge slots per group supported by the UI/table (B1..B8). */
export const MAX_JUDGE_SLOTS = 8;
