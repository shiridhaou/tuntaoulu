/**
 * Category / style time limits (Tunisian Wushu Federation official rules).
 * Each preset gives a legal window in seconds; the TA picks the preset and the
 * system auto-flags + values any under/over-time violation.
 *
 * Deduction scale (same for under and over):
 *   ≤ 2 s outside  → −0.10
 *   2 – 5 s        → −0.20
 *   > 5 s          → −0.30
 */

export interface CategoryTimeRule {
  id: string;
  label: string;      // Arabic
  labelEn: string;
  min: number;        // seconds
  max: number;        // seconds
  group: "standard" | "taiji" | "team";
}

export const CATEGORY_TIME_RULES: CategoryTimeRule[] = [
  { id: "seniors",       label: "أكابر / كبار",            labelEn: "Seniors / Adults",        min: 80,  max: 95,  group: "standard" },
  { id: "juniors",       label: "أواسط / شباب (1:20)",     labelEn: "Juniors (1:20)",          min: 80,  max: 95,  group: "standard" },
  { id: "youth",         label: "أصاغر / شباب (1:10)",     labelEn: "Youth (1:10)",            min: 70,  max: 85,  group: "standard" },
  { id: "children",      label: "أطفال",                    labelEn: "Children",                min: 165, max: 195, group: "standard" },
  { id: "taiji_fan",     label: "تايجي شان (مروحة)",        labelEn: "Taijiquan Fan",           min: 300, max: 360, group: "taiji" },
  { id: "taiji_42_24",   label: "تايجي 42/24 والسيف",       labelEn: "Taiji 42/24 & Sword",     min: 240, max: 300, group: "taiji" },
  { id: "taiji_general", label: "تايجي عام",                labelEn: "General Taiji",           min: 180, max: 240, group: "taiji" },
  { id: "duilian",       label: "دويليان / عرض جماعي",      labelEn: "Duilian / Group",         min: 180, max: 240, group: "team" },
];

export const DEFAULT_CATEGORY_RULE_ID = "seniors";

export function getCategoryRule(id: string | null | undefined): CategoryTimeRule | null {
  if (!id) return null;
  return CATEGORY_TIME_RULES.find((r) => r.id === id) ?? null;
}

export interface CategoryTimeCheck {
  /** Deduction value: 0, 0.1, 0.2 or 0.3 */
  value: number;
  direction: "under" | "over" | "ok";
  /** Seconds outside the legal window (positive). */
  drift: number;
  reason: string;
  rule: CategoryTimeRule | null;
}

export function fmtSec(s: number): string {
  const v = Math.max(0, Math.round(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

export function fmtRuleWindow(rule: CategoryTimeRule | null): string {
  if (!rule) return "—";
  return `${fmtSec(rule.min)} – ${fmtSec(rule.max)}`;
}

/** Compute the auto time deduction for a finished routine against a category preset. */
export function checkCategoryTime(ruleId: string | null | undefined, elapsedSec: number): CategoryTimeCheck {
  const rule = getCategoryRule(ruleId);
  if (!rule || elapsedSec <= 0) {
    return { value: 0, direction: "ok", drift: 0, reason: "—", rule };
  }

  let drift = 0;
  let direction: "under" | "over" | "ok" = "ok";
  if (elapsedSec < rule.min) {
    drift = Math.round(rule.min - elapsedSec);
    direction = "under";
  } else if (elapsedSec > rule.max) {
    drift = Math.round(elapsedSec - rule.max);
    direction = "over";
  }

  if (drift === 0) {
    return { value: 0, direction: "ok", drift: 0, reason: "ضمن الزمن المسموح", rule };
  }

  // IWUF 2024 · Article 26 — automatic time deduction:
  //   Taiji styles : −0.10 for every 5 s over/under the legal window
  //   Other styles : −0.10 for every 2 s over/under the legal window
  const step = rule.group === "taiji" ? 5 : 2;
  const value = Math.round(Math.ceil(drift / step) * 0.1 * 100) / 100;
  const verb = direction === "under" ? "أقل من الزمن الأدنى" : "أكثر من الزمن الأقصى";
  return {
    value,
    direction,
    drift,
    reason: `${verb} بـ ${drift}ث (${fmtRuleWindow(rule)})`,
    rule,
  };
}
