/**
 * Unified routine-style naming.
 * Any incoming string (Arabic, abbreviation, English, mixed) is normalized to
 * one internal value so Chief / TA / Judge headers always read the same.
 */

export type StyleKey = "changquan" | "nanquan" | "taijiquan" | "traditional";

const MAP: Array<{ key: StyleKey; tests: RegExp[] }> = [
  {
    key: "nanquan",
    tests: [/nanquan/i, /\bnq\b/i, /nan\s*quan/i, /southern/i, /جنوبي/, /نانكوان/, /نان\s*تشوان/],
  },
  {
    key: "taijiquan",
    tests: [/taiji/i, /tai\s*chi/i, /\btjq?\b/i, /تايجي/, /تاي\s*تشي/],
  },
  {
    key: "traditional",
    tests: [/tradition/i, /\btr\b/i, /تقليدي/],
  },
  {
    key: "changquan",
    tests: [/changquan/i, /\bcq\b/i, /chang\s*quan/i, /northern/i, /شمالي/, /تشانغ/],
  },
];

/** Normalize any style string to its internal key (defaults to changquan). */
export function normalizeStyle(raw: unknown, fallback: StyleKey = "changquan"): StyleKey {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  for (const m of MAP) if (m.tests.some((re) => re.test(s))) return m.key;
  return fallback;
}

const LABELS: Record<StyleKey, { ar: string; en: string; short: string }> = {
  changquan: { ar: "تشانغ تشوان — شمالي", en: "Changquan (Northern)", short: "CQ" },
  nanquan: { ar: "نان تشوان — جنوبي", en: "Nanquan (Southern)", short: "NQ" },
  taijiquan: { ar: "تاي جي تشوان", en: "Taijiquan", short: "TJQ" },
  traditional: { ar: "الأساليب التقليدية", en: "Traditional", short: "TR" },
};

export function styleLabelAr(raw: unknown): string {
  return LABELS[normalizeStyle(raw)].ar;
}
export function styleLabelEn(raw: unknown): string {
  return LABELS[normalizeStyle(raw)].en;
}
export function styleShort(raw: unknown): string {
  return LABELS[normalizeStyle(raw)].short;
}
