/* ─────────────── Group A — Style-Aware Rules Engine (UI data only) ───────────────
   Independent rule entries per { style, errorCode, pinyin, arabicDescription,
   deductionValue, activeForStyle }. Entries are intentionally duplicated per
   style even when code numbers overlap: criteria differ per style column.
   No sync / DB / routing logic lives here. */

export type GroupAStyle = "changquan" | "nanquan" | "taijiquan";

export type GroupARule = {
  style: GroupAStyle;
  errorCode: string;
  /** Decade key 0–7 */
  group: string;
  pinyin: string;
  arabicDescription: string;
  englishDescription: string;
  deductionValue: number;
  activeForStyle: boolean;
};

/** Keypad is strictly 0–7 and never changes shape. */
export const GROUP_A_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;

export const GROUP_A_GROUP_INFO: Record<string, { pinyin: string; titleAr: string; titleEn: string }> = {
  "0": { pinyin: "Shǒu Xíng", titleAr: "أشكال اليد", titleEn: "Hand Forms (01–09)" },
  "1": { pinyin: "Bù Xíng · Shǒu Xíng", titleAr: "الوقفات وأشكال اليد", titleEn: "Stances & Hand Forms (10–19)" },
  "2": { pinyin: "Tuǐ Fǎ", titleAr: "تقنيات الساق", titleEn: "Leg Techniques (20–29)" },
  "3": { pinyin: "Tiào Yuè", titleAr: "القفزات", titleEn: "Jumps & Leaps (30–39)" },
  "4": { pinyin: "Qì Xiè Fǎ", titleAr: "تقنيات السلاح", titleEn: "Weapon Techniques (40–49)" },
  "5": { pinyin: "Bù Xíng · Bù Fǎ", titleAr: "الوقفات والخطوات", titleEn: "Stances & Footwork (50–59)" },
  "6": { pinyin: "Qì Xiè", titleAr: "السلاح والتوازن", titleEn: "Apparatus / Weapon Balance (60–69)" },
  "7": { pinyin: "Tōng Yòng Kòu Fēn", titleAr: "الخصومات العامة", titleEn: "General Deductions (70A–79)" },
};

/** Shared technical dictionary (code → wording). Style rows reuse it. */
const DICT: Record<string, { pinyin: string; ar: string; en: string; value?: number }> = {
  "01": { pinyin: "Quán", ar: "قبضة غير صحيحة", en: "Incorrect fist form" },
  "02": { pinyin: "Zhǎng", ar: "كف غير صحيح", en: "Incorrect palm form" },
  "03": { pinyin: "Gōu", ar: "خطاف اليد غير صحيح", en: "Incorrect hook form" },
  "04": { pinyin: "Shǒu Xíng", ar: "شكل يد غير مكتمل", en: "Incomplete hand form" },
  "05": { pinyin: "Tài Jí Zhǎng", ar: "كف التايجي غير صحيح", en: "Incorrect Taiji palm" },
  "06": { pinyin: "Tài Jí Quán Xíng", ar: "قبضة التايجي غير صحيحة", en: "Incorrect Taiji fist" },

  "10": { pinyin: "Gōng Bù", ar: "وقفة القوس غير صحيحة", en: "Incorrect bow stance" },
  "12": { pinyin: "Mǎ Bù", ar: "وقفة الحصان غير صحيحة", en: "Incorrect horse stance" },
  "13": { pinyin: "Pū Bù", ar: "الوقفة المنخفضة غير صحيحة", en: "Incorrect crouch stance" },
  "14": { pinyin: "Xū Bù", ar: "الوقفة الفارغة غير صحيحة", en: "Incorrect empty stance" },
  "15": { pinyin: "Xiē Bù", ar: "وقفة التقاطع غير صحيحة", en: "Incorrect rest stance" },
  "16": { pinyin: "Dú Lì Bù", ar: "الوقوف على قدم واحدة غير صحيح", en: "Incorrect one-leg stance" },
  "17": { pinyin: "Tài Jí Gōng Bù", ar: "وقفة القوس (تايجي) غير صحيحة", en: "Incorrect Taiji bow stance" },
  "18": { pinyin: "Tài Jí Xū Bù", ar: "الوقفة الفارغة (تايجي) غير صحيحة", en: "Incorrect Taiji empty stance" },
  "19": { pinyin: "Tài Jí Dú Lì", ar: "الوقوف على قدم (تايجي) غير صحيح", en: "Incorrect Taiji one-leg stance" },

  "20": { pinyin: "Tī Tuǐ", ar: "الركل الأمامي غير صحيح", en: "Incorrect front kick" },
  "21": { pinyin: "Chā Tuǐ", ar: "الركل الجانبي غير صحيح", en: "Incorrect side kick" },
  "22": { pinyin: "Bǎi Lián", ar: "الركل الدائري الخارجي غير صحيح", en: "Incorrect outside crescent kick" },
  "23": { pinyin: "Tuǐ Fǎ", ar: "تقنية الساق غير صحيحة", en: "Incorrect leg technique" },
  "24": { pinyin: "Sǎo Tuǐ", ar: "الكنس بالساق غير صحيح", en: "Incorrect sweeping leg" },
  "25": { pinyin: "Gāo Dù", ar: "ارتفاع الركل غير كافٍ", en: "Insufficient kick height" },
  "26": { pinyin: "Zhī Chēng Tuǐ", ar: "عدم ثبات ساق الارتكاز", en: "Unstable supporting leg" },
  "27": { pinyin: "Nán Quán Tuǐ Fǎ", ar: "تقنية ساق النانكوان غير صحيحة", en: "Incorrect Nanquan leg technique" },

  "30": { pinyin: "Tiào Yuè", ar: "ارتفاع القفزة غير كافٍ", en: "Insufficient jump height" },
  "31": { pinyin: "Xuán Zhuǎn", ar: "الدوران غير مكتمل", en: "Incomplete rotation" },
  "32": { pinyin: "Luò Dì", ar: "الهبوط غير ثابت", en: "Unstable landing" },
  "33": { pinyin: "Téng Kōng", ar: "وضعية الجسم في الهواء غير صحيحة", en: "Incorrect airborne posture" },
  "34": { pinyin: "Lián Jiē", ar: "الربط بعد القفزة غير سليم", en: "Poor linking after jump" },

  "40": { pinyin: "Qì Xiè Fǎ", ar: "تقنية السلاح غير صحيحة", en: "Incorrect weapon technique" },
  "41": { pinyin: "Jiàn Fǎ", ar: "تقنية السيف المستقيم غير صحيحة", en: "Incorrect straightsword method" },
  "43": { pinyin: "Qiāng Fǎ", ar: "تقنية الرمح غير صحيحة", en: "Incorrect spear method" },
  "44": { pinyin: "Qì Xiè Xié Tiáo", ar: "تناسق السلاح مع الجسم غير صحيح", en: "Weapon–body coordination fault" },
  "42": { pinyin: "Dāo · Gùn Fǎ", ar: "طريقة السيف/العصا غير صحيحة", en: "Incorrect broadsword / cudgel method" },

  "50": { pinyin: "Bù Fǎ", ar: "الخطوة غير صحيحة", en: "Incorrect footwork" },
  "51": { pinyin: "Zhòng Xīn", ar: "نقل مركز الثقل غير سليم", en: "Poor weight transfer" },
  "52": { pinyin: "Bù Xíng", ar: "شكل الوقفة غير مكتمل", en: "Incomplete stance form" },
  "53": { pinyin: "Wěn Dìng", ar: "عدم ثبات الوقفة", en: "Unstable stance" },
  "54": { pinyin: "Cháng Quán Bù Fǎ", ar: "خطوات التشانغ تشوان غير صحيحة", en: "Incorrect Changquan footwork" },
  "55": { pinyin: "Nán Quán Bù Xíng", ar: "وقفة النانكوان غير صحيحة", en: "Incorrect Nanquan stance" },
  "56": { pinyin: "Nán Quán Mǎ Bù", ar: "وقفة الحصان (نانكوان) غير صحيحة", en: "Incorrect Nanquan horse stance" },
  "57": { pinyin: "Nán Quán Bù Fǎ", ar: "خطوات النانكوان غير صحيحة", en: "Incorrect Nanquan footwork" },
  "58": { pinyin: "Cháng Quán Xiē Bù", ar: "وقفة التقاطع (تشانغ تشوان) غير صحيحة", en: "Incorrect Changquan rest stance" },
  "59": { pinyin: "Tài Jí Bù Fǎ", ar: "خطوات التايجي غير صحيحة", en: "Incorrect Taiji footwork" },

  "60": { pinyin: "Qì Xiè Píng Héng", ar: "اختلال توازن السلاح", en: "Weapon balance fault" },
  "61": { pinyin: "Qì Xiè Wò Fǎ", ar: "مسك السلاح غير صحيح", en: "Incorrect weapon grip" },
  "62": { pinyin: "Qì Xiè Xíng", ar: "مسار السلاح غير صحيح", en: "Incorrect weapon trajectory" },
  "63": { pinyin: "Qì Xiè Lì Diǎn", ar: "نقطة قوة السلاح غير صحيحة", en: "Incorrect weapon force point" },
  "64": { pinyin: "Qì Xiè Sù Dù", ar: "سرعة السلاح غير مناسبة", en: "Incorrect weapon speed" },
  "65": { pinyin: "Nán Dāo Fǎ", ar: "تقنية سيف النانكوان غير صحيحة", en: "Incorrect Nandao method" },
  "66": { pinyin: "Qì Xiè Xié Tiáo", ar: "عدم تناسق السلاح مع الجسم", en: "Weapon–body coordination fault" },
  "67": { pinyin: "Nán Gùn Fǎ", ar: "تقنية عصا النانكوان غير صحيحة", en: "Incorrect Nangun method" },
  "68": { pinyin: "Tài Jí Jiàn Fǎ", ar: "تقنية سيف التايجي غير صحيحة", en: "Incorrect Taiji sword method" },
  "69": { pinyin: "Tài Jí Shàn Fǎ", ar: "تقنية مروحة التايجي غير صحيحة", en: "Incorrect Taiji fan method" },

  // Group 7 — general deductions (identical across all styles)
  "70A": { pinyin: "Yáo Huàng", ar: "اهتزاز الجذع", en: "Torso sway", value: 0.05 },
  "70B": { pinyin: "Yí Bù", ar: "تحريك القدم أو القفز", en: "Loss of balance / step", value: 0.1 },
  "71": { pinyin: "Zhī Chēng", ar: "الدعم الإضافي", en: "Additional support", value: 0.2 },
  "72": { pinyin: "Diē Dǎo", ar: "السقوط", en: "Fall", value: 0.3 },
  "73": { pinyin: "Qì Xiè Cuò", ar: "أخطاء مرتبطة بالسلاح", en: "Weapon fault", value: 0.1 },
  "74": { pinyin: "Qì Xiè Duàn", ar: "كسر السلاح أو المروحة", en: "Broken weapon / fan parts", value: 0.2 },
  "75": { pinyin: "Qì Xiè Luò", ar: "سقوط السلاح على الأرض", en: "Weapon drop", value: 0.3 },
  "76": { pinyin: "Fú Shì Luò", ar: "سقوط زينة السلاح أو اللباس", en: "Apparel / ornament drop", value: 0.1 },
  "77": { pinyin: "Píng Héng", ar: "عدم تنفيذ التوازن بالإيقاع / أقل من ثانيتين", en: "Balance held under 2 sec", value: 0.2 },
  "78": { pinyin: "Chū Jiè", ar: "الخروج من البساط", en: "Out of carpet", value: 0.3 },
  "79": { pinyin: "Wàng Dòng Zuò", ar: "نسيان حركة", en: "Forgotten movement", value: 0.1 },
};

/** Group 7 general deductions — mandatory sub-code selection, shared by all styles. */
export const GENERAL_CODES = ["70A", "70B", "71", "72", "73", "74", "75", "76", "77", "78", "79"] as const;

/** Universal technical codes, active across all three styles. */
export const UNIVERSAL_CODES = ["01", "02", "04", "23", "25", "26", "30", "50", "51", "52", "53"] as const;

const STYLE_CODES: Record<GroupAStyle, string[]> = {
  changquan: [
    "01", "02", "03", "04",
    "10", "12", "13", "14", "15", "16",
    "20", "21", "22", "23", "24", "25", "26",
    "30", "31", "32", "33", "34",
    "40", "41", "42", "43", "44",
    "50", "51", "52", "53", "54", "58",
    "60", "61", "62", "63", "64",
    ...GENERAL_CODES,
  ],
  nanquan: [
    "01", "02", "03", "04",
    "20", "23", "25", "26", "27",
    "30", "32",
    "40", "42", "44",
    "50", "51", "52", "53", "55", "56", "57",
    "62", "65", "66", "67",
    ...GENERAL_CODES,
  ],
  taijiquan: [
    "01", "02", "04", "05", "06",
    "17", "18", "19",
    "22", "23", "25", "26",
    "30", "31",
    "50", "51", "52", "53", "59",
    "60", "61", "63", "66", "68", "69",
    ...GENERAL_CODES,
  ],
};

const DEFAULT_TECH_VALUE = 0.1;

function groupOf(code: string): string {
  return code.startsWith("0") ? "0" : code[0];
}

function buildRules(): GroupARule[] {
  const out: GroupARule[] = [];
  (Object.keys(STYLE_CODES) as GroupAStyle[]).forEach(style => {
    const active = new Set(STYLE_CODES[style]);
    Object.keys(DICT).forEach(code => {
      const d = DICT[code];
      out.push({
        style,
        errorCode: code,
        group: groupOf(code),
        pinyin: d.pinyin,
        arabicDescription: d.ar,
        englishDescription: d.en,
        deductionValue: d.value ?? DEFAULT_TECH_VALUE,
        activeForStyle: active.has(code),
      });
    });
  });
  return out;
}

/** Full independent rule table — one entry per (style, code). */
export const GROUP_A_RULES: GroupARule[] = buildRules();

/** Normalizes any incoming live style string to one of the three rule columns. */
export function resolveStyle(style: string | null | undefined): GroupAStyle {
  const s = (style ?? "").toLowerCase();
  if (s.includes("nan")) return "nanquan";
  if (s.includes("tai") || s.includes("tj")) return "taijiquan";
  return "changquan";
}

/** Active rules for a style, sorted by code. */
export function rulesForStyle(style: string | null | undefined): GroupARule[] {
  const s = resolveStyle(style);
  return GROUP_A_RULES.filter(r => r.style === s && r.activeForStyle).sort((a, b) =>
    a.errorCode.localeCompare(b.errorCode, "en", { numeric: true }),
  );
}

/** Active codes inside one decade key (0–7). */
export function rulesForKey(style: string | null | undefined, key: string): GroupARule[] {
  return rulesForStyle(style).filter(r => r.group === key);
}

/** Keys 0–7 that hold at least one active code for the style. */
export function enabledKeysForStyle(style: string | null | undefined): string[] {
  const active = rulesForStyle(style);
  return GROUP_A_KEYS.filter(k => active.some(r => r.group === k));
}

/** Key 7 never logs directly — it always requires sub-code selection. */
export const REQUIRES_SUBCODE_KEYS = ["7"] as const;
