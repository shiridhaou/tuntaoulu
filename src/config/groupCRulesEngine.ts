/* ─────────────── Group C — Style-Aware Connection Rules Engine ─────────────── */

export type GroupCStyle = "changquan" | "nanquan" | "taijiquan";

export type ConnectionRule = {
  style: GroupCStyle;
  firstCode: string;       // كود الحركة الأولى
  connectionCode: string;  // كود الهبوط أو الربط (0-11 أو كود قفزة ثانية)
  grade: "A" | "B" | "C" | "D";
  value: number;           // 0.10, 0.15, 0.20, 0.25
  fullCode: string;        // التجميع الكامل مثل 312A+323B
};

// قاموس أكواد الهبوط/الربط العامة للتعريف
export const LANDING_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  "0": { ar: "وضع الانخفاض (Pū Bù)", en: "Crouching Stance" },
  "1": { ar: "وضعية الحصان (Mǎ Bù)", en: "Horse Stance" },
  "2": { ar: "وضعية الفراشة (Dié Bù)", en: "Butterfly Stance" },
  "3": { ar: "رفع الركبة (Tí Xī Dú Lì)", en: "Single Raised-Knee Stance" },
  "4": { ar: "الحوض الأمامي مع السقوط (Diē Shù Chā)", en: "Falling Front Split" },
  "5": { ar: "نصف الحوض (Diē Chā)", en: "Hurdler's Split Position" },
  "6": { ar: "الجلوس المتقاطع (Zuò Pán)", en: "Cross-Legged Sitting" },
  "7": { ar: "وضع القوس (Gōng Bù)", en: "Bow Stance" },
  "8": { ar: "الهبوط على قدم واحدة", en: "Single Foot Landing" },
  "9": { ar: "الرمي والإمساك بالسلاح (Pāo + Jiē)", en: "Throw + Catch" },
  "10": { ar: "وضعية المقس (Jiǎn Shì)", en: "Scissor Position" },
  "11": { ar: "وضعية العقرب (Xiē Shì)", en: "Scorpion Stance" },
};

/* ── 1. جداول الشمالي (Changquan) ── */
const CHANGQUAN_CONNECTIONS: Omit<ConnectionRule, "style">[] = [
  // Grade A (0.10)
  { firstCode: "244A", connectionCode: "6", grade: "A", value: 0.10, fullCode: "244A+6" },
  { firstCode: "312A", connectionCode: "6", grade: "A", value: 0.10, fullCode: "312A+6" },
  { firstCode: "312A", connectionCode: "323A", grade: "A", value: 0.10, fullCode: "312A+323A" },
  { firstCode: "312A", connectionCode: "324A", grade: "A", value: 0.10, fullCode: "312A+324A" },
  { firstCode: "312A", connectionCode: "353B", grade: "A", value: 0.10, fullCode: "312A+353B" },
  { firstCode: "323A", connectionCode: "1", grade: "A", value: 0.10, fullCode: "323A+1" },
  { firstCode: "323A", connectionCode: "4", grade: "A", value: 0.10, fullCode: "323A+4" },
  { firstCode: "323A", connectionCode: "6", grade: "A", value: 0.10, fullCode: "323A+6" },
  { firstCode: "323A", connectionCode: "324A", grade: "A", value: 0.10, fullCode: "323A+324A" },
  { firstCode: "323A", connectionCode: "353B", grade: "A", value: 0.10, fullCode: "323A+353B" },
  { firstCode: "324A", connectionCode: "1", grade: "A", value: 0.10, fullCode: "324A+1" },
  { firstCode: "324A", connectionCode: "4", grade: "A", value: 0.10, fullCode: "324A+4" },
  { firstCode: "324A", connectionCode: "6", grade: "A", value: 0.10, fullCode: "324A+6" },
  { firstCode: "324A", connectionCode: "7", grade: "A", value: 0.10, fullCode: "324A+7" },
  { firstCode: "333A", connectionCode: "353B", grade: "A", value: 0.10, fullCode: "333A+353B" },
  { firstCode: "333A", connectionCode: "6", grade: "A", value: 0.10, fullCode: "333A+6" },
  { firstCode: "335A", connectionCode: "4", grade: "A", value: 0.10, fullCode: "335A+4" },
  { firstCode: "335A", connectionCode: "353B", grade: "A", value: 0.10, fullCode: "335A+353B" },

  // Grade B (0.15)
  { firstCode: "312A", connectionCode: "335A", grade: "B", value: 0.15, fullCode: "312A+335A" },
  { firstCode: "312A", connectionCode: "323B", grade: "B", value: 0.15, fullCode: "312A+323B" },
  { firstCode: "312A", connectionCode: "324B", grade: "B", value: 0.15, fullCode: "312A+324B" },
  { firstCode: "323A", connectionCode: "3", grade: "B", value: 0.15, fullCode: "323A+3" },
  { firstCode: "323A", connectionCode: "324B", grade: "B", value: 0.15, fullCode: "323A+324B" },
  { firstCode: "323B", connectionCode: "1", grade: "B", value: 0.15, fullCode: "323B+1" },
  { firstCode: "323B", connectionCode: "4", grade: "B", value: 0.15, fullCode: "323B+4" },
  { firstCode: "323B", connectionCode: "6", grade: "B", value: 0.15, fullCode: "323B+6" },
  { firstCode: "323B", connectionCode: "324B", grade: "B", value: 0.15, fullCode: "323B+324B" },
  { firstCode: "324A", connectionCode: "3", grade: "B", value: 0.15, fullCode: "324A+3" },
  { firstCode: "324B", connectionCode: "0", grade: "B", value: 0.15, fullCode: "324B+0" },
  { firstCode: "324B", connectionCode: "1", grade: "B", value: 0.15, fullCode: "324B+1" },
  { firstCode: "324B", connectionCode: "6", grade: "B", value: 0.15, fullCode: "324B+6" },
  { firstCode: "333A", connectionCode: "244A", grade: "B", value: 0.15, fullCode: "333A+244A" },
  { firstCode: "353B", connectionCode: "4", grade: "B", value: 0.15, fullCode: "353B+4" },
  { firstCode: "353B", connectionCode: "323B", grade: "B", value: 0.15, fullCode: "353B+323B" },
  { firstCode: "335A", connectionCode: "323B", grade: "B", value: 0.15, fullCode: "335A+323B" },
  { firstCode: "323A", connectionCode: "9", grade: "B", value: 0.15, fullCode: "323A+9" },
  { firstCode: "324A", connectionCode: "9", grade: "B", value: 0.15, fullCode: "324A+9" },
  { firstCode: "312A", connectionCode: "9", grade: "B", value: 0.15, fullCode: "312A+9" },
  { firstCode: "445A", connectionCode: "9", grade: "B", value: 0.15, fullCode: "445A+9" },

  // Grade C (0.20)
  { firstCode: "312A", connectionCode: "323C", grade: "C", value: 0.20, fullCode: "312A+323C" },
  { firstCode: "312A", connectionCode: "324C", grade: "C", value: 0.20, fullCode: "312A+324C" },
  { firstCode: "312A", connectionCode: "353C", grade: "C", value: 0.20, fullCode: "312A+353C" },
  { firstCode: "323A", connectionCode: "353C", grade: "C", value: 0.20, fullCode: "323A+353C" },
  { firstCode: "323B", connectionCode: "3", grade: "C", value: 0.20, fullCode: "323B+3" },
  { firstCode: "323C", connectionCode: "1", grade: "C", value: 0.20, fullCode: "323C+1" },
  { firstCode: "323C", connectionCode: "6", grade: "C", value: 0.20, fullCode: "323C+6" },
  { firstCode: "324B", connectionCode: "3", grade: "C", value: 0.20, fullCode: "324B+3" },
  { firstCode: "324C", connectionCode: "6", grade: "C", value: 0.20, fullCode: "324C+6" },
  { firstCode: "333A", connectionCode: "353C", grade: "C", value: 0.20, fullCode: "333A+353C" },
  { firstCode: "353B", connectionCode: "323C", grade: "C", value: 0.20, fullCode: "353B+323C" },
  { firstCode: "335A", connectionCode: "323C", grade: "C", value: 0.20, fullCode: "335A+323C" },
  { firstCode: "335A", connectionCode: "353C", grade: "C", value: 0.20, fullCode: "335A+353C" },

  // Grade D (0.25)
  { firstCode: "323B", connectionCode: "324C", grade: "D", value: 0.25, fullCode: "323B+324C" },
  { firstCode: "323C", connectionCode: "4", grade: "D", value: 0.25, fullCode: "323C+4" },
  { firstCode: "324C", connectionCode: "1", grade: "D", value: 0.25, fullCode: "324C+1" },
  { firstCode: "353C", connectionCode: "4", grade: "D", value: 0.25, fullCode: "353C+4" },
];

/* ── 2. جداول الجنوبي (Nanquan) ── */
const NANQUAN_CONNECTIONS: Omit<ConnectionRule, "style">[] = [
  // Grade A (0.10)
  { firstCode: "312A", connectionCode: "3", grade: "A", value: 0.10, fullCode: "312A+3" },
  { firstCode: "323A", connectionCode: "1", grade: "A", value: 0.10, fullCode: "323A+1" },
  { firstCode: "323A", connectionCode: "2", grade: "A", value: 0.10, fullCode: "323A+2" },
  { firstCode: "323A", connectionCode: "312A", grade: "A", value: 0.10, fullCode: "323A+312A" },
  { firstCode: "323A", connectionCode: "324A", grade: "A", value: 0.10, fullCode: "323A+324A" },
  { firstCode: "324A", connectionCode: "1", grade: "A", value: 0.10, fullCode: "324A+1" },
  { firstCode: "324A", connectionCode: "346A", grade: "A", value: 0.10, fullCode: "324A+346A" },
  { firstCode: "335A", connectionCode: "10", grade: "A", value: 0.10, fullCode: "335A+10" },
  { firstCode: "346A", connectionCode: "2", grade: "A", value: 0.10, fullCode: "346A+2" },

  // Grade B (0.15)
  { firstCode: "312A", connectionCode: "346B", grade: "B", value: 0.15, fullCode: "312A+346B" },
  { firstCode: "323A", connectionCode: "324B", grade: "B", value: 0.15, fullCode: "323A+324B" },
  { firstCode: "323B", connectionCode: "1", grade: "B", value: 0.15, fullCode: "323B+1" },
  { firstCode: "323B", connectionCode: "2", grade: "B", value: 0.15, fullCode: "323B+2" },
  { firstCode: "324A", connectionCode: "346B", grade: "B", value: 0.15, fullCode: "324A+346B" },
  { firstCode: "324B", connectionCode: "1", grade: "B", value: 0.15, fullCode: "324B+1" },
  { firstCode: "346B", connectionCode: "2", grade: "B", value: 0.15, fullCode: "346B+2" },
  { firstCode: "447A", connectionCode: "2", grade: "B", value: 0.15, fullCode: "447A+2" },

  // Grade C (0.20)
  { firstCode: "323A", connectionCode: "3", grade: "C", value: 0.20, fullCode: "323A+3" },
  { firstCode: "323A", connectionCode: "346B", grade: "C", value: 0.20, fullCode: "323A+346B" },
  { firstCode: "323B", connectionCode: "324B", grade: "C", value: 0.20, fullCode: "323B+324B" },
  { firstCode: "324A", connectionCode: "3", grade: "C", value: 0.20, fullCode: "324A+3" },
  { firstCode: "324B", connectionCode: "0", grade: "C", value: 0.20, fullCode: "324B+0" },
  { firstCode: "324B", connectionCode: "346B", grade: "C", value: 0.20, fullCode: "324B+346B" },
  { firstCode: "346B", connectionCode: "11", grade: "C", value: 0.20, fullCode: "346B+11" },

  // Grade D (0.25)
  { firstCode: "323C", connectionCode: "1", grade: "D", value: 0.25, fullCode: "323C+1" },
  { firstCode: "324C", connectionCode: "1", grade: "D", value: 0.25, fullCode: "324C+1" },
  { firstCode: "323B", connectionCode: "324C", grade: "D", value: 0.25, fullCode: "323B+324C" },
];

/* ── 3. جداول التايجي (Taijiquan) ── */
const TAIJI_CONNECTIONS: Omit<ConnectionRule, "style">[] = [
  // Grade A (0.10)
  { firstCode: "142A", connectionCode: "3", grade: "A", value: 0.10, fullCode: "142A+3" },
  { firstCode: "143A", connectionCode: "3", grade: "A", value: 0.10, fullCode: "143A+3" },
  { firstCode: "143A", connectionCode: "212A", grade: "A", value: 0.10, fullCode: "143A+212A" },
  { firstCode: "312A", connectionCode: "3", grade: "A", value: 0.10, fullCode: "312A+3" },
  { firstCode: "312A", connectionCode: "324B", grade: "A", value: 0.10, fullCode: "312A+324B" },
  { firstCode: "323A", connectionCode: "3", grade: "A", value: 0.10, fullCode: "323A+3" },

  // Grade B (0.15)
  { firstCode: "143B", connectionCode: "3", grade: "B", value: 0.15, fullCode: "143B+3" },
  { firstCode: "143B", connectionCode: "212A", grade: "B", value: 0.15, fullCode: "143B+212A" },
  { firstCode: "312B", connectionCode: "8", grade: "B", value: 0.15, fullCode: "312B+8" },
  { firstCode: "323B", connectionCode: "8", grade: "B", value: 0.15, fullCode: "323B+8" },
  { firstCode: "324B", connectionCode: "8", grade: "B", value: 0.15, fullCode: "324B+8" },
  { firstCode: "324B", connectionCode: "5", grade: "B", value: 0.15, fullCode: "324B+5" },

  // Grade C (0.20)
  { firstCode: "323B", connectionCode: "3", grade: "C", value: 0.20, fullCode: "323B+3" },
  { firstCode: "324B", connectionCode: "3", grade: "C", value: 0.20, fullCode: "324B+3" },
  { firstCode: "312A", connectionCode: "324C", grade: "C", value: 0.20, fullCode: "312A+324C" },

  // Grade D (0.25)
  { firstCode: "323C", connectionCode: "3", grade: "D", value: 0.25, fullCode: "323C+3" },
  { firstCode: "324C", connectionCode: "3", grade: "D", value: 0.25, fullCode: "324C+3" },
  { firstCode: "324C", connectionCode: "5", grade: "D", value: 0.25, fullCode: "324C+5" },
];

// تجميع كل البيانات
export const ALL_GROUP_C_RULES: ConnectionRule[] = [
  ...CHANGQUAN_CONNECTIONS.map(r => ({ ...r, style: "changquan" as GroupCStyle })),
  ...NANQUAN_CONNECTIONS.map(r => ({ ...r, style: "nanquan" as GroupCStyle })),
  ...TAIJI_CONNECTIONS.map(r => ({ ...r, style: "taijiquan" as GroupCStyle })),
];

// دالة لمعرفة الأسلوب الحالي
export function resolveCStyle(styleName?: string | null): GroupCStyle {
  const s = (styleName || "").toLowerCase();
  if (s.includes("nan")) return "nanquan";
  if (s.includes("tai") || s.includes("tj") || s.includes("شأن")) return "taijiquan";
  return "changquan";
}

// دالة جلب روابط الصعوبة المتاحة لحركة إجبارية معينة
export function getValidConnectionsForMovement(
  styleName: string | undefined | null,
  firstMovementCode: string
): ConnectionRule[] {
  const style = resolveCStyle(styleName);
  // تنظيف الكود الأساسي من أي إضافات
  const cleanCode = firstMovementCode.trim().toUpperCase();
  
  return ALL_GROUP_C_RULES.filter(
    rule => rule.style === style && rule.firstCode === cleanCode
  );
}
