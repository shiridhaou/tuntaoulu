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
  "0": { pinyin: "Shǒu Xíng", titleAr: "أشكال اليد", titleEn: "Hand Forms (01-04)" },
  "1": { pinyin: "Balances", titleAr: "التوازنات", titleEn: "Balances (10-16)" },
  "2": { pinyin: "Kicks & Sweeps", titleAr: "الركلات والمسح", titleEn: "Kicks & Sweeps (20-26)" },
  "3": { pinyin: "Jumps", titleAr: "القفزات", titleEn: "Jumps (30-34)" },
  "4": { pinyin: "Nanquan & Fall/Landing", titleAr: "تقنيات النانكوان والسقوط", titleEn: "Nanquan & Fall/Landing Techniques (40–49)" },
  "5": { pinyin: "Stances", titleAr: "الوقفات", titleEn: "Stances (50–58)" },
  "6": { pinyin: "Weapon Techniques", titleAr: "تقنيات السلاح", titleEn: "Weapon Techniques (60–68)" },
  "7": { pinyin: "Tōng Yòng Kòu Fēn", titleAr: "الخصومات العامة", titleEn: "General Deductions (70A–79)" },
};

/** Shared technical dictionary (code → wording). Style rows reuse it. */
const DICT: Record<string, { pinyin: string; ar: string; en: string; value?: number }> = {
  // Tab 0 — Hand Forms
  "01": { pinyin: "Quán", ar: "القبضة", en: "Fist Form" },
  "02": { pinyin: "Zhǎng", ar: "الكف", en: "Palm Form" },
  "03": { pinyin: "Gōu Shǒu", ar: "اليد المعقوفة", en: "Hook Form" },
  "04": { pinyin: "Jiàn Zhǐ", ar: "أصابع السيف", en: "Sword-Finger" },
  "05": { pinyin: "Tài Jí Zhǎng", ar: "كف التايجي غير صحيح", en: "Incorrect Taiji palm" },
  "06": { pinyin: "Tài Jí Quán Xíng", ar: "قبضة التايجي غير صحيحة", en: "Incorrect Taiji fist" },

  // Tab 1 — Balances
  "10": { pinyin: "Balance with Leg Raised/Held", ar: "الوقوف مع الإمساك بالقدم/رفعها", en: "Balance with Leg Raised/Held" },
  "12": { pinyin: "Backward Lean Balance", ar: "التوازن مع إمالة الجسم للخلف", en: "Backward Lean Balance" },
  "13": { pinyin: "Forward Balance", ar: "التوازن الأمامي", en: "Forward Balance" },
  "14": { pinyin: "Cross-Legged Balance", ar: "التوازن المتقاطع", en: "Cross-Legged Balance" },
  "15": { pinyin: "Side Balance / Sea Exploration", ar: "التوازن الجانبي / استكشاف البحر", en: "Side Balance / Sea Exploration" },
  "16": { pinyin: "Moon-Viewing Balance", ar: "توازن النظر إلى القمر", en: "Moon-Viewing Balance" },
  "17": { pinyin: "Tài Jí Gōng Bù", ar: "وقفة القوس (تايجي) غير صحيحة", en: "Incorrect Taiji bow stance" },
  "18": { pinyin: "Tài Jí Xū Bù", ar: "الوقفة الفارغة (تايجي) غير صحيحة", en: "Incorrect Taiji empty stance" },
  "19": { pinyin: "Tài Jí Dú Lì", ar: "الوقوف على قدم (تايجي) غير صحيح", en: "Incorrect Taiji one-leg stance" },

  // Tab 2 — Kicks & Sweeps
  "20": { pinyin: "Front Sweep", ar: "المسح الأمامي", en: "Front Sweep" },
  "21": { pinyin: "Back Sweep", ar: "المسح الخلفي", en: "Back Sweep" },
  "22": { pinyin: "Falling Front Split", ar: "الحوض الأمامي", en: "Falling Front Split" },
  "23": { pinyin: "Snap / Heel Push / Side Kick", ar: "الركل النابض/الدفع/الجانبي", en: "Snap / Heel Push / Side Kick" },
  "24": { pinyin: "Front/Side Stretch Kick", ar: "الركل المستقيم الأمامي/الجانبي", en: "Front/Side Stretch Kick" },
  "25": { pinyin: "Inward/Lotus/Front Slap Kick", ar: "الركل مع الصفع", en: "Inward/Lotus/Front Slap Kick" },
  "26": { pinyin: "Single Knee Raised", ar: "رفع الركبة المفردة", en: "Single Knee Raised" },
  "27": { pinyin: "Nán Quán Tuǐ Fǎ", ar: "تقنية ساق النانكوان غير صحيحة", en: "Incorrect Nanquan leg technique" },

  // Tab 3 — Jumps
  "30": { pinyin: "Fei Jiao / Xuan Feng Jiao / Bai Lian", ar: "القفزات الدورانية والصفاعية", en: "Fei Jiao / Xuan Feng Jiao / Bai Lian" },
  "31": { pinyin: "Jumping Front Straight Kick", ar: "القفز المستقيم الأمامي", en: "Jumping Front Straight Kick" },
  "32": { pinyin: "Aerial Cartwheel", ar: "العجلة الهوائية", en: "Aerial Cartwheel" },
  "33": { pinyin: "Butterfly / Butterfly Twist", ar: "الفراشة والدوران", en: "Butterfly / Butterfly Twist" },
  "34": { pinyin: "Jumping Snap / Heel Push Kick", ar: "القفز النابض/الدفع", en: "Jumping Snap / Heel Push Kick" },

  // Tab 4 — Nanquan & Fall/Landing Techniques (40–49)
  "40": { pinyin: "Qián Tū Tiào", ar: "ركلة طائرة مع قفز وسقوط", en: "Front Jump Kick with Fall" },
  "41": { pinyin: "Tēng Kōng Cè Chāi", ar: "ركلة جانبية مزدوجة بالقفز", en: "Jumping Split Side Kick" },
  "42": { pinyin: "Diē Bù", ar: "تقنيات السقوط والربط الأرضي", en: "Fall and Ground Link Techniques" },
  "43": { pinyin: "Nán Quán Tuǐ Fǎ", ar: "تقنيات أرجل الأسلوب الجنوبي الخاصة", en: "Special Nanquan Leg Techniques" },
  "44": { pinyin: "Qiè Xiè Xié Tiáo", ar: "تناسق حركة السلاح مع الجسم", en: "Weapon–Body Coordination (Nandao/Nangun)" },

  // Tab 5 — Stances
  "50": { pinyin: "Gōng Bù", ar: "وقفة القوس", en: "Bow Stance" },
  "51": { pinyin: "Mǎ Bù", ar: "وقفة الحصان", en: "Horse Stance" },
  "52": { pinyin: "Xū Bù", ar: "الوقفة الفارغة", en: "Empty Stance" },
  "53": { pinyin: "Pū Bù", ar: "الوقفة المنخفضة", en: "Crouching Stance" },
  "54": { pinyin: "Xiē Bù", ar: "الجلوس المتقاطع", en: "Cross-Legged Crouching" },
  "55": { pinyin: "Dié Bù", ar: "وقفة الفراشة", en: "Butterfly Stance" },
  "56": { pinyin: "Guì Bù", ar: "وقفة الركوع", en: "Single Kneeling" },
  "57": { pinyin: "Nán Quán Bù Fǎ", ar: "خطوات النانكوان غير صحيحة", en: "Incorrect Nanquan footwork" },
  "58": { pinyin: "Zuò Pán", ar: "الجلوس المتقاطع الأرضي", en: "Cross-Legged Sitting" },
  "59": { pinyin: "Tài Jí Bù Fǎ", ar: "خطوات التايجي غير صحيحة", en: "Incorrect Taiji footwork" },

  // Tab 6 — Weapon Techniques (60–68)
  "60": { pinyin: "Guà Jiàn / Liāo Jiàn", ar: "دفاع وقطع السيف (Vertical Circle)", en: "Defend and Cut Sword (Vertical Circle)" },
  "61": { pinyin: "Wò Jiàn", ar: "مسك السيف الصحيح (Sword Grip)", en: "Correct Sword Grip" },
  "62": { pinyin: "Chán Tóu / Guǒ Nǎo", ar: "لف السيف/السكين حول الرأس", en: "Sword / Knife Around Head" },
  "63": { pinyin: "Lán / Ná / Zhā Qiāng", ar: "تقنيات الرمح الثلاثية (حظر/سحب/طعن)", en: "Three Spear Techniques (Block / Drag / Stab)" },
  "64": { pinyin: "Píng Lūn Gùn", ar: "تدوير العصا الأفقية", en: "Horizontal Staff Rotation" },
  "65": { pinyin: "Lì Wǔ Huā", ar: "تنسيق الزهرة العمودية بالرمح/العصا", en: "Vertical Flower Coordination" },
  "66": { pinyin: "Throw and Catch Weapon", ar: "رمي واستقبال السلاح (Weapon Catch/Throw)", en: "Weapon Throw and Catch" },
  "67": { pinyin: "Dǐng Gùn", ar: "تثبيت العصا على الأرض", en: "Ground Staff Support" },
  "68": { pinyin: "Jiǎo Jiàn", ar: "تدوير رأس السيف", en: "Sword Tip Rotation" },
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
  "77": { pinyin: "Píng Héng", ar: "عدم تنفيذ التوازن بالإيقاع / أقل من ثانيتين", en: "Balance held under 2 sec", value: 0.1 },
  "78": { pinyin: "Chū Jiè", ar: "الخروج من البساط", en: "Out of carpet", value: 0.1 },
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
