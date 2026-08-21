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
  "5": { pinyin: "Stances", titleAr: "الوقفات", titleEn: "Stances (50–59)" },
  "6": { pinyin: "Weapon Techniques", titleAr: "تقنيات السلاح والمروحة", titleEn: "Weapon & Fan Techniques (60–69)" },
  "7": { pinyin: "Tōng Yòng Kòu Fēn", titleAr: "الخصومات العامة", titleEn: "General Deductions (70A–79)" },
};

/** Shared technical dictionary (code → wording). Style rows reuse it. */
const DICT: Record<string, { pinyin: string; ar: string; en: string; value?: number }> = {
  // Tab 0 — Hand Forms
  "01": { pinyin: "Quán", ar: "القبضة", en: "Fist Form" },
  "02": { pinyin: "Zhǎng / Zhǎo Hǔ", ar: "الكف / مخلب النمر", en: "Palm / Tiger Claw" },
  "03": { pinyin: "Gōu Shǒu / Zuǐ Hè", ar: "اليد الخطافية / منقار الكركي", en: "Hook / Crane Beak" },
  "04": { pinyin: "Jiàn Zhǐ / Dān Zhǐ Zhǎng", ar: "أصابع السيف / كف بإصبع واحد", en: "Sword-Finger / One-Finger Palm" },
  "05": { pinyin: "Tài Jí Zhǎng", ar: "كف التايجي غير صحيح", en: "Incorrect Taiji palm" },
  "06": { pinyin: "Tài Jí Quán Xíng", ar: "قبضة التايجي غير صحيحة", en: "Incorrect Taiji fist" },

  // Tab 1 — Balances
  "10": { pinyin: "Bân Jiǎo Cháo Tiān / Cè Tī Bào Jiǎo", ar: "رفع القدم إلى الأعلى والإمساك بها / الركلة الجانبية مع الإمساك بالقدم", en: "Balance with Leg Raised/Held" },
  "12": { pinyin: "Yǎng Shēn Píng Héng", ar: "التوازن الخلفي", en: "Backward Lean Balance" },
  "13": { pinyin: "Shí Zì Píng Héng", ar: "توازن الصليب والانحناء للأمام مع مد الذراعين", en: "Forward Cross Balance" },
  "14": { pinyin: "Kòu Tuǐ / Pán Tuǐ Píng Héng", ar: "توازن الرجل المتقاطعة (من الخلف / من الأمام)", en: "Cross-Legged Balance" },
  "15": { pinyin: "Cè Shēn / Tān Hǎi Píng Héng", ar: "التوازن الجانبي / توازن استكشاف البحر", en: "Side Balance / Sea Exploration" },
  "16": { pinyin: "Wàng Yuè Píng Héng / Pāo Jiē Shàn", ar: "توازن النظر إلى القمر / رمي المروحة والتقاطها", en: "Moon-Viewing Balance / Fan Throw & Catch" },
  "17": { pinyin: "Dī Shì Qián Dēng Cǎi Jiǎo", ar: "توازن منخفض مع ركلة أمامية بالكعب", en: "Low balance with front heel kick" },
  "18": { pinyin: "Hòu Chā Tuǐ Dī Shì", ar: "التوازن المنخفض مع إدخال الرجل خلفاً", en: "Low balance with leg crossed behind" },
  "19": { pinyin: "Qián Jǔ Tuǐ Dī Shì", ar: "توازن منخفض مع رفع الساق للأمام", en: "Low balance with front leg raised" },

  // Tab 2 — Kicks & Sweeps
  "20": { pinyin: "Qián Sǎo Tuǐ", ar: "المسح الأمامي", en: "Front Sweep" },
  "21": { pinyin: "Hòu Sǎo Tuǐ", ar: "المسح الخلفي", en: "Back Sweep" },
  "22": { pinyin: "Diē Shì Chā / Diē Chā", ar: "الحوض الأمامي / نصف الحوض", en: "Falling Front Split / Half Split" },
  "23": { pinyin: "Tán Tuǐ / Chuǎi Tuǐ / Dēng Tuǐ / Cǎi Héng", ar: "الركلة النابضة / الركلة الجانبية / الركلة الأفقية الضاغطة / ركلة ذيل النمر", en: "Snap / Heel Push / Side Kick / Tiger Tail" },
  "24": { pinyin: "Zhèng Tī Tuǐ / Cè Tī Tuǐ", ar: "الركلة الأمامية المستقيمة / الركلة الجانبية المستقيمة", en: "Front/Side Stretch Kick" },
  "25": { pinyin: "Lǐ Hé / Bǎi Lián / Dān Pái Jiǎo / Fēn Jiǎo", ar: "الركلة للداخل أو للخارج مع الصفع / الركلة المتفرقة", en: "Inward/Lotus/Front Slap Kick" },
  "26": { pinyin: "Tí Xī Dú Lì", ar: "رفع الركبة", en: "Single Knee Raised" },
  "27": { pinyin: "Tuǐ Dīng Héng", ar: "ركلة المسمار الأفقية", en: "Horizontal Nail Kick" },

  // Tab 3 — Jumps
  "30": { pinyin: "Téng Kōng Fēi Jiǎo / Xuān Fēng Jiǎo / Bǎi Lián", ar: "القفزة الطائرة الأمامية مع الصفع / القفز للإعصار / القفز للخارج", en: "Jumping Front Slap / Tornado / Lotus Jump" },
  "31": { pinyin: "Téng Kōng Zhèng Tī Tuǐ", ar: "الركلة الأمامية المستقيمة مع القفز", en: "Jumping Front Straight Kick" },
  "32": { pinyin: "Cè Kōng Fān / Cè Kōng Tī", ar: "العجلة الهوائية / العجلة الهوائية مع اللف", en: "Aerial Cartwheel / Twist" },
  "33": { pinyin: "Xuàn Zi / Xuàn Zi Zhuǎn Tǐ", ar: "ركلة الفراشة / ركلة الفراشة مع الدوران", en: "Butterfly / Butterfly Twist" },
  "34": { pinyin: "Téng Kōng Jiàn Tán / Téng Kōng Dēng Tuǐ", ar: "الركلة النابضة الطائرة / ركلة الدفع بالكعب", en: "Jumping Snap / Heel Push Kick" },

  // Tab 4 — Nanquan & Fall/Landing Techniques (40–49)
  "40": { pinyin: "Téng Kōng Pán Tuǐ 360° Cè Pū", ar: "ركلة طائرة مع تقاطع الساقين والهبوط على الجنب", en: "300 Jump Split with Side Fall" },
  "41": { pinyin: "Tēng Kōng Cè Chāi", ar: "ركلة جانبية مزدوجة بالقفز", en: "Jumping Split Side Kick" },
  "42": { pinyin: "Téng Kōng Shuāng Cè Chuài", ar: "الركلة الجانبية المزدوجة بالقفز (جنوبي)", en: "Nanquan Double Jumping Side Kick" },
  "43": { pinyin: "Nán Quán Tuǐ Fǎ", ar: "تقنيات أرجل الأسلوب الجنوبي الخاصة", en: "Special Nanquan Leg Techniques" },
  "44": { pinyin: "Qiè Xiè Xié Tiáo", ar: "تناسق حركة السلاح مع الجسم", en: "Weapon–Body Coordination (Nandao/Nangun)" },

  // Tab 5 — Stances
  "50": { pinyin: "Gōng Bù", ar: "وضع القوس", en: "Bow Stance" },
  "51": { pinyin: "Mǎ Bù", ar: "وضعية الحصان", en: "Horse Stance" },
  "52": { pinyin: "Xū Bù", ar: "الوضعية الفارغة", en: "Empty Stance" },
  "53": { pinyin: "Pū Bù", ar: "وضع الانخفاض", en: "Crouching Stance" },
  "54": { pinyin: "Xiē Bù", ar: "وضع الجلوس المتقاطع", en: "Cross-Legged Crouching" },
  "55": { pinyin: "Dié Bù", ar: "وضعية الفراشة", en: "Butterfly Stance" },
  "56": { pinyin: "Guì Bù", ar: "وضع الركوع", en: "Single Kneeling Stance" },
  "57": { pinyin: "Lóng Qí Bù", ar: "وضعية ركوب التنين", en: "Dragon Riding Stance" },
  "58": { pinyin: "Zuò Pán", ar: "وضع الجلوس المتقاطع على الأرض", en: "Cross-Legged Sitting Ground" },
  "59": { pinyin: "Shàng Bù / Tuì Bù / Jìn Bù / Gēn Bù / Cè Xíng Bù", ar: "خطوات التقدم / التراجع / الخطوات المتتابعة / الجانبية", en: "Advancing / Retreating / Stepping Footwork" },

  // Tab 6 — Weapon Techniques (60–69)
  "60": { pinyin: "Guà Jiàn / Liāo Jiàn / Shàn Liāo / Guà Shàn", ar: "صد السيف الدائري / رفع السيف / الدفاع والقطع بالسيف أو بالمروحة", en: "Defend & Cut Sword or Fan" },
  "61": { pinyin: "Wò Jiàn / Kāi Shàn", ar: "مسك السيف / فتح المروحة", en: "Sword Grip / Fan Open" },
  "62": { pinyin: "Chán Tóu / Guǒ Nǎo", ar: "لف السيف العريض حول الرأس / خلف الرأس", en: "Broadsword Wrap Around Head" },
  "63": { pinyin: "Lán Qiāng / Ná Qiāng / Zhā Qiāng / Hé Shàn / Cì Shàn / Pī Shàn", ar: "صد بالرمح / طعن / غلق المروحة / الطعن بالمروحة / القطع بالمروحة", en: "Spear Trio / Fan Close, Stab, Chop" },
  "64": { pinyin: "Píng Lún Gùn", ar: "دوران العصا أفقياً بيد واحدة", en: "Horizontal Staff Rotation" },
  "65": { pinyin: "Lì Wǔ Huā Qiāng / Gùn", ar: "شكل الرقم (8) العمودي بالرمح أو العصا", en: "Vertical Figure-8 Flower" },
  "66": { pinyin: "Qì Xiè Pāo Jiē / Gùn Shān Shǒu Tí Liāo Huā", ar: "رمي واستقبال السلاح / رفع العصا عمودياً باليدين", en: "Weapon Catch/Throw & Dual Staff Lift" },
  "67": { pinyin: "Gùn Dǐng", ar: "تثبيت العصا (غرس العصا)", en: "Ground Staff Support" },
  "68": { pinyin: "Jiǎo Jiàn", ar: "تدوير السيف", en: "Sword Tip Rotation" },
  "69": { pinyin: "Diǎn Shàn", ar: "الطعن برأس المروحة", en: "Fan Tip Dabbing/Stab" },

  // Group 7 — General Deductions (IWUF Standard)
  "70A": { pinyin: "Yí Bù / Tiao Bu", ar: "تحريك قدم الدعم أو القفز الإضافي", en: "Support foot shuffle or skip", value: 0.05 },
  "70B": { pinyin: "Yáo Huàng", ar: "اهتزاز الجذع", en: "Torso sways", value: 0.10 },
  "71": { pinyin: "Zhī Chēng", ar: "الدعم الإضافي", en: "Additional Support", value: 0.10 },
  "72": { pinyin: "Diē Dǎo", ar: "السقوط", en: "Fall", value: 0.30 },
  "73": { pinyin: "Chū Jiè", ar: "الخروج من البساط", en: "Out-of-bounds", value: 0.10 },
  "74": { pinyin: "Wàng Dòng Zuò", ar: "نسيان حركة", en: "Forgetting movement", value: 0.20 },
  "75": { pinyin: "Fú Shì Luò / Cán Qiē", ar: "سقوط زينة السلاح أو جزء من اللباس / التفاف الزينة / فقدان الحذاء", en: "Apparel/ornament drop, wrapping, lost shoe", value: 0.05 },
  "76": { pinyin: "Qì Xiè Cù Dì / Shī Kòng", ar: "لمس السلاح للأرض / فقدان السيطرة على السلاح", en: "Weapon touches ground / loss of control", value: 0.10 },
  "77": { pinyin: "Qì Xiè Zhàng Ái / BIAN XING", ar: "اصطدام السلاح بالجسم / تشوه السلاح / انفصال سطح المروحة", en: "Weapon hits body / deformation / fan surface detaches", value: 0.20 },
  "78": { pinyin: "Qì Xiè Duàn", ar: "كسر السلاح / كسر أجزاء المروحة أو سقوط مساميرها", en: "Broken weapon or fan parts", value: 0.30 },
  "79": { pinyin: "Qì Xiè Luò Dì", ar: "سقوط السلاح على الأرض", en: "Weapon dropped on floor", value: 0.30 },
};

/** Group 7 general deductions — mandatory sub-code selection, shared by all styles. */
export const GENERAL_CODES = ["70A", "70B", "71", "72", "73", "74", "75", "76", "77", "78", "79"] as const;

/** Universal technical codes, active across all three styles. */
export const UNIVERSAL_CODES = ["01", "02", "23", "25", "26", "30", "50", "51", "52", "53"] as const;

const STYLE_CODES: Record<GroupAStyle, string[]> = {
  changquan: [
    "01", "02", // أشكال اليد (03 و 04 مطفأة)
    "10", "12", "13", "14", "15", "16", // التوازنات
    "20", "21", "22", "23", "24", "25", "26", // الركلات والمسح
    "30", "31", "32", "33", "34", // القفزات
    // تم حذف جميع أكواد المجموعة 4 (40-44) ليتعطل التبويب 4 بالكامل في الشمالي
    "50", "51", "52", "53", "54", "58", // الوقفات
    "60", "61", "62", "63", "64", "65", "66", // أساليب السلاح
    ...GENERAL_CODES,
  ],
  nanquan: [
    "01", "02", "03", // أشكال اليد
    "20", "23", "25", "26", "27", // الركلات
    "30", "32", // القفزات
    "40", "42", "44", // التبويب 4 يعمل حصرياً هنا للأسلوب الجنوبي
    "50", "51", "52", "53", "55", "56", "57", // الوقفات
    "62", "65", "66", "67", // السلاح
    ...GENERAL_CODES,
  ],
  taijiquan: [
    "01", "02", "04", "05", "06", // أشكال اليد
    "16", "17", "18", "19", // التوازنات
    "22", "23", "25", "26", // الركلات
    "30", "31", // القفزات
    // التبويب 4 مطفأ تماماً هنا أيضاً
    "50", "51", "52", "53", "59", // الوقفات
    "60", "61", "63", "66", "68", "69", // السلاح والمروحة
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
  if (s.includes("tai") || s.includes("tj") || s.includes("شأن")) return "taijiquan";
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
