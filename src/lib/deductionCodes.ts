/* ───────── Group A — Official IWUF deduction code catalogue ─────────
   Grouped by category (tens digit). Codes may carry a letter suffix
   (e.g. 70A / 70B) for graded severities of the same error family.
   Style-conditional categories:
   - 2x → Nanquan only
   - 5x → Taijiquan only
   - all others → every style
*/

export type CodeEntry = { code: string; label: string; labelAr: string; value: number };

export const DEDUCTION_CODES: Record<number, CodeEntry[]> = {
  // فئة 1 — الأساسيات والوقفات
  1: [
    { code: "10A", label: "Incorrect basic technique", labelAr: "تقنية أساسية غير صحيحة", value: 0.1 },
    { code: "10B", label: "Incomplete stance", labelAr: "وقفة ناقصة", value: 0.1 },
    { code: "11", label: "Foot displacement", labelAr: "إزاحة القدم", value: 0.1 },
    { code: "12", label: "Incorrect body method", labelAr: "طريقة جسم غير صحيحة", value: 0.2 },
  ],
  // فئة 2 — النانكوان (Nanquan only)
  2: [
    { code: "20A", label: "Weak Nanquan power", labelAr: "ضعف قوة النانكوان", value: 0.1 },
    { code: "20B", label: "Incorrect Nanquan hand form", labelAr: "شكل يد غير صحيح", value: 0.1 },
    { code: "21", label: "Missing Nanquan shout", labelAr: "غياب الصرخة", value: 0.2 },
  ],
  // فئة 3 — القفزات
  3: [
    { code: "30A", label: "Insufficient jump height", labelAr: "ارتفاع قفز غير كافٍ", value: 0.1 },
    { code: "30B", label: "Incomplete rotation", labelAr: "دوران ناقص", value: 0.1 },
    { code: "31", label: "Unstable landing", labelAr: "هبوط غير ثابت", value: 0.2 },
    { code: "32", label: "Fall after jump", labelAr: "سقوط بعد القفزة", value: 0.3 },
  ],
  // فئة 4 — الإيقاع والانسجام
  4: [
    { code: "40A", label: "Rhythm interruption", labelAr: "انقطاع الإيقاع", value: 0.05 },
    { code: "40B", label: "Unclear rhythm changes", labelAr: "تغيّر إيقاع غير واضح", value: 0.1 },
    { code: "41", label: "Pause / hesitation", labelAr: "توقف أو تردد", value: 0.2 },
  ],
  // فئة 5 — التايجي (Taijiquan only)
  5: [
    { code: "50A", label: "Broken continuity", labelAr: "انقطاع الاستمرارية", value: 0.05 },
    { code: "50B", label: "Lacking softness / evenness", labelAr: "نقص النعومة والانسيابية", value: 0.1 },
    { code: "51", label: "Stance instability (Taiji)", labelAr: "عدم ثبات الوقفة", value: 0.2 },
    { code: "52", label: "Balance loss (Taiji)", labelAr: "فقدان التوازن", value: 0.2 },
  ],
  // فئة 6 — التزامن والسلاح
  6: [
    { code: "60A", label: "Music synchronization error", labelAr: "خطأ في التزامن مع الموسيقى", value: 0.05 },
    { code: "60B", label: "Weapon displacement", labelAr: "إزاحة السلاح", value: 0.1 },
    { code: "61", label: "Weapon release / illegal contact", labelAr: "إفلات السلاح أو ارتطام غير مجاز", value: 0.2 },
    { code: "62", label: "Weapon dropped", labelAr: "سقوط السلاح", value: 0.3 },
  ],
  // فئة 7 — الوضعيات والتوازن
  7: [
    { code: "70A", label: "Torso sways", labelAr: "ميلان الجذع", value: 0.05 },
    { code: "70B", label: "Slight loss of balance / shake", labelAr: "اهتزاز أو فقدان توازن خفيف", value: 0.1 },
    { code: "71", label: "Additional support", labelAr: "استناد إضافي", value: 0.2 },
    { code: "72", label: "Fall", labelAr: "سقوط", value: 0.3 },
  ],
  // فئة 8 — الزي والمعدات
  8: [
    { code: "80A", label: "Costume issue", labelAr: "خلل في الزي", value: 0.05 },
    { code: "80B", label: "Costume item falls", labelAr: "سقوط قطعة من الزي", value: 0.1 },
    { code: "81", label: "Equipment deformation / break", labelAr: "تشوّه أو كسر معدات", value: 0.2 },
  ],
  // فئة 9 — أخطاء المساحة والبروتوكول
  9: [
    { code: "90A", label: "Out of carpet boundary", labelAr: "الخروج عن حدود البساط", value: 0.1 },
    { code: "90B", label: "Missing salute", labelAr: "غياب التحية", value: 0.1 },
    { code: "91", label: "Routine interruption", labelAr: "توقف الأداء", value: 0.3 },
  ],
};

export const CATALOG: CodeEntry[] = Object.keys(DEDUCTION_CODES)
  .map(Number)
  .sort((a, b) => a - b)
  .flatMap(k => DEDUCTION_CODES[k]);

export function catalogForStyle(style: string | null): CodeEntry[] {
  return CATALOG.filter(e => {
    const tier = e.code[0];
    if (tier === "2") return style === "nanquan";
    if (tier === "5") return style === "taijiquan";
    return true;
  });
}
