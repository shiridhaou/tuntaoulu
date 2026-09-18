/**
 * Head Judge choreography / content deductions (IWUF 2024, codes 80–86).
 * These are applied by the Chief Judge only and are independent of the
 * Group A deduction catalogue.
 */

export interface ChoreoCodeEntry {
  code: string;
  value: number;
  label: string;
  labelAr: string;
}

export const CHOREO_CODES: ChoreoCodeEntry[] = [
  { code: "80", value: 0.2, label: "Compulsory technique missing/altered", labelAr: "حركة إجبارية ناقصة أو مغيّرة" },
  { code: "81", value: 0.1, label: "Compulsory routine steps missing/added", labelAr: "خطوات إجبارية ناقصة أو مضافة" },
  { code: "82", value: 0.2, label: "Nanquan/Nandao/Nangun vocalization error", labelAr: "خطأ في الصرخة (نانكوان/نانداو/نانغون)" },
  { code: "83", value: 0.1, label: "Static pause >2s / rhythm disruption", labelAr: "توقف ثابت أكثر من ثانيتين أو اضطراب الإيقاع" },
  { code: "84", value: 0.1, label: "Direction deviation >90° or >45°", labelAr: "انحراف الاتجاه أكثر من 90° أو 45°" },
  { code: "85", value: 0.1, label: "<2 complete techniques between difficulty groups", labelAr: "أقل من حركتين كاملتين بين مجموعات الصعوبة" },
  { code: "86", value: 0.5, label: "Music missing / vocals error", labelAr: "غياب الموسيقى أو خطأ غنائي" },
];

export const CHOREO_CODE_MAP: Record<string, ChoreoCodeEntry> = CHOREO_CODES.reduce(
  (acc, e) => { acc[e.code] = e; return acc; },
  {} as Record<string, ChoreoCodeEntry>,
);

/** Normalize free text input ("80", " 80 ", "code 80") to a known code or null. */
export function lookupChoreoCode(input: string): ChoreoCodeEntry | null {
  const digits = String(input).replace(/[^\d]/g, "");
  return CHOREO_CODE_MAP[digits] ?? null;
}
