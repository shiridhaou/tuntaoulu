/**
 * iwufDifficultyRules.ts
 * ----------------------------------------------------------------------------
 * IWUF 2024 Group C rule engine — DEFENSIVE / READ-ONLY.
 *
 * Purely additive: nothing here mutates state, performs I/O, or changes the
 * Head Judge score formula. It only answers "is this difficulty + connection
 * declaration plausible for the selected sub-style?" and returns advisory
 * issues that the UI can render as mild warnings.
 * ----------------------------------------------------------------------------
 */

export type StyleFamily = "northern" | "southern" | "taiji";

export interface SubStyle {
  /** Stable id, e.g. "daoshu". */
  id: string;
  family: StyleFamily;
  labelEn: string;
  labelAr: string;
  /** Internal engine style key used by the rest of the app. */
  styleKey: "changquan" | "nanquan" | "taijiquan";
}

/** Official event list grouped by family. */
export const SUB_STYLES: SubStyle[] = [
  { id: "changquan", family: "northern", labelEn: "Changquan", labelAr: "تشانغ تشوان", styleKey: "changquan" },
  { id: "daoshu", family: "northern", labelEn: "Daoshu", labelAr: "داو شو", styleKey: "changquan" },
  { id: "jianshu", family: "northern", labelEn: "Jianshu", labelAr: "جيان شو", styleKey: "changquan" },
  { id: "gunshu", family: "northern", labelEn: "Gunshu", labelAr: "قون شو", styleKey: "changquan" },
  { id: "qiangshu", family: "northern", labelEn: "Qiangshu", labelAr: "تشيانغ شو", styleKey: "changquan" },
  { id: "nanquan", family: "southern", labelEn: "Nanquan", labelAr: "نان تشوان", styleKey: "nanquan" },
  { id: "nandao", family: "southern", labelEn: "Nandao", labelAr: "نان داو", styleKey: "nanquan" },
  { id: "nangun", family: "southern", labelEn: "Nangun", labelAr: "نان قون", styleKey: "nanquan" },
  { id: "taijiquan", family: "taiji", labelEn: "Taijiquan", labelAr: "تاي جي تشوان", styleKey: "taijiquan" },
  { id: "taijijian", family: "taiji", labelEn: "Taijijian", labelAr: "تاي جي جيان", styleKey: "taijiquan" },
  { id: "taijifan", family: "taiji", labelEn: "Taijifan", labelAr: "مروحة التاي جي", styleKey: "taijiquan" },
];

export const FAMILY_LABEL: Record<StyleFamily, { en: string; ar: string }> = {
  northern: { en: "Northern", ar: "الأسلحة الشمالية" },
  southern: { en: "Southern", ar: "الأسلوب الجنوبي" },
  taiji: { en: "Taiji", ar: "التاي جي" },
};

/** Resolve any free-text style / sub-style label to a known sub-style. */
export function resolveSubStyle(raw?: string | null): SubStyle | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  return (
    SUB_STYLES.find((x) => x.id === s) ??
    SUB_STYLES.find((x) => s.includes(x.id)) ??
    SUB_STYLES.find((x) => s.includes(x.labelEn.toLowerCase())) ??
    null
  );
}

export function familyOf(raw?: string | null): StyleFamily {
  const sub = resolveSubStyle(raw);
  if (sub) return sub.family;
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("taiji") || s.includes("tjq")) return "taiji";
  if (s.includes("nan") || s.includes("south")) return "southern";
  return "northern";
}

/**
 * Standard connection combinations (difficulty movement + connection).
 * Reference list — used for "recognised combination" hints only.
 */
export const STANDARD_CONNECTIONS: Record<StyleFamily, string[]> = {
  northern: ["312A+324A", "323A+324B", "335A+353B", "143B+212A", "313A+324A", "345A+324B"],
  southern: ["312A+324A", "354A+324A", "143B+212A", "352A+324B"],
  taiji: ["323A+324A", "333A+324B", "334A+324A", "143B+212A"],
};

/** Codes that only exist in one family's difficulty table (advisory only). */
const FAMILY_EXCLUSIVE: Record<StyleFamily, string[]> = {
  northern: ["353B", "355A", "345A"],
  southern: ["354A", "352A"],
  taiji: ["333A", "334A", "335B"],
};

export interface GroupCRuleIssue {
  severity: "warning";
  code: string;
  message: string;
}

export interface GroupCRuleResult {
  family: StyleFamily;
  issues: GroupCRuleIssue[];
  /** True when nothing suspicious was found. */
  ok: boolean;
}

const norm = (c: unknown) => String(c ?? "").trim().toUpperCase();

/** Split a compound connection ("312A+324A") into its constituent codes. */
export function connectionParts(code: string): string[] {
  return norm(code)
    .split("+")
    .map((p) => p.trim())
    .filter((p) => /^\d{3}[A-C]$/.test(p));
}

/**
 * Validate a declared Group C sheet against the selected style.
 * NEVER throws — always returns a result object.
 */
export function validateGroupC(
  selectedStyle: string | null | undefined,
  difficultyCodes: (string | null | undefined)[] = [],
  connections: (string | null | undefined)[] = [],
): GroupCRuleResult {
  const family = familyOf(selectedStyle);
  const issues: GroupCRuleIssue[] = [];

  try {
    const declared = new Set(difficultyCodes.map(norm).filter(Boolean));

    // Rule A — a connection cannot be valid unless its base codes are declared.
    connections.forEach((raw) => {
      const code = norm(raw);
      if (!code) return;
      const parts = connectionParts(code);
      if (parts.length < 2) return; // numeric slot / "+" forms: nothing to check
      const missing = parts.filter((p) => !declared.has(p));
      if (missing.length > 0) {
        issues.push({
          severity: "warning",
          code,
          message: `تحذير: كود الأساس غير موجود في قائمة الصعوبات (${missing.join(", ")})`,
        });
      }
    });

    // Rule B — codes exclusive to another family.
    const foreign = (Object.keys(FAMILY_EXCLUSIVE) as StyleFamily[])
      .filter((f) => f !== family)
      .flatMap((f) => FAMILY_EXCLUSIVE[f]);
    declared.forEach((code) => {
      if (foreign.includes(code)) {
        issues.push({
          severity: "warning",
          code,
          message: `تحذير: الكود ${code} غير معتاد في ${FAMILY_LABEL[family].ar}`,
        });
      }
    });
  } catch {
    // Defensive: a malformed sheet must never break the TA screen.
    return { family, issues: [], ok: true };
  }

  return { family, issues, ok: issues.length === 0 };
}

/** True when the pair is one of the documented standard combinations. */
export function isStandardConnection(selectedStyle: string | null | undefined, pair: string): boolean {
  return STANDARD_CONNECTIONS[familyOf(selectedStyle)].includes(norm(pair));
}
