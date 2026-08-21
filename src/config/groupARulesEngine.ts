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
  "0": { pinyin: "Shǒu Xíng / Shǒu Fǎ", titleAr: "أشكال وتقنيات اليد", titleEn: "Hand Forms & Techniques (01-06)" },
  "1": { pinyin: "Balances", titleAr: "التوازنات", titleEn: "Balances (10-19)" },
  "2": { pinyin: "Kicks & Sweeps", titleAr: "الركلات والمسح", titleEn: "Kicks & Sweeps (20-27)" },
  "3": { pinyin: "Jumps", titleAr: "القفزات", titleEn: "Jumps (30-34)" },
  "4": { pinyin: "Nanquan Fall/Landing", titleAr: "تقنيات السقوط للجنوبي", titleEn: "Nanquan Fall/Landing (40-42)" },
  "5": { pinyin: "Stances", titleAr: "الوقفات والخطوات", titleEn: "Stances & Footwork (50-59)" },
  "6": { pinyin: "Weapon Techniques", titleAr: "تقنيات السلاح والمروحة", titleEn: "Weapon & Fan Techniques (60-69)" },
  "7": { pinyin: "Tōng Yòng Kòu Fēn", titleAr: "الخصومات العامة", titleEn: "General Deductions (70A–79)" },
};

/** Shared technical dictionary (code → wording). Style rows reuse it. */
const DICT: Record<string, { pinyin: string; ar: string; en: string; value?: number }> = {
  // Tab 0 — Hand Forms & Body
  "01": { pinyin: "Quán", ar: "القبضة", en: "Fist Form" },
  "02": { pinyin: "Zhǎng / Hǔ Zhǎo", ar: "الكف / مخلب النمر", en: "Palm / Tiger Claw" },
  "03": { pinyin: "Gōu Shǒu / Hè Zuǐ", ar: "اليد الخطافية / منقار الكركي", en: "Hook / Crane Beak" },
  "04": { pinyin: "Jiàn Zhǐ / Dān Zhǐ Zhǎng", ar: "أصابع السيف / كف بإصبع واحد", en: "Sword-Finger / One-Finger Palm" },
  "05": { pinyin: "Shǒu Fǎ", ar: "تقنيات اليد", en: "Hand Techniques" },
  "06": { pinyin: "Shēn Xíng", ar: "وضع الجسم", en: "Body Posture" },

  // Tab 1 — Balances
  "10": { pinyin: "Bân Jiǎo Cháo Tiān / Cè Tī Bào Jiǎo", ar: "رفع القدم إلى الأعلى وإمساكها / الركلة الجانبية مع الإمساك بالقدم", en: "Leg Raised & Held / Side Kick Held" },
  "12": { pinyin: "Yǎng Shēn Píng Héng", ar: "التوازن الخلفي", en: "Backward Lean Balance" },
  "13": { pinyin: "Shí Zì Píng Héng", ar: "توازن الصليب والانحناء للأمام مع مد الذراعين", en: "Forward Cross Balance" },
  "14": { pinyin: "Kòu Tuǐ / Pán Tuǐ Píng Héng", ar: "توازن الرجل المتقاطعة من الخلف / من الأمام", en: "Cross-Legged Balance (Behind/Front)" },
  "15": { pinyin: "Cè Shēn / Tān Hǎi Píng Héng", ar: "التوازن الجانبي / توازن استكشاف البحر", en: "Side Balance / Sea Exploration" },
  "16": { pinyin: "Wàng Yuè Píng Héng", ar: "توازن النظر إلى القمر", en: "Moon-Viewing Balance" },
  "17": { pinyin: "Dī Shì Qián Dēng Cǎi Jiǎo", ar: "توازن منخفض مع ركلة أمامية بالكعب", en: "Low Balance with Front Heel Kick" },
  "18": { pinyin: "Hòu Chā Tuǐ Dī Shì Píng Héng", ar: "التوازن المنخفض مع إدخال الرجل خلفاً", en: "Low Balance Leg Crossed Behind" },
  "19": { pinyin: "Qián Jǔ Tuǐ Dī Shì Píng Héng", ar: "توازن منخفض مع رفع الساق للأمام", en: "Low Balance Front Leg Raised" },

  // Tab 2 — Kicks & Sweeps
  "20": { pinyin: "Qián Sǎo Tuǐ", ar: "المسح الأمامي", en: "Front Sweep" },
  "21": { pinyin: "Hòu Sǎo Tuǐ", ar: "المسح الخلفي", en: "Back Sweep" },
  "22": { pinyin: "Diē Shì Chā / Diē Chā", ar: "الحوض الأمامي / نصف الحوض", en: "Front Split / Half Split" },
  "23": { pinyin: "Tán Tuǐ / Chuǎi Tuǐ / Dēng Tuǐ / Fēn Jiǎo", ar: "الركلة النابضة / ركلة الدفع بالكعب / الركلة الجانبية / الركل بالكعب / الركلة المتفرقة", en: "Snap Kick / Heel Push / Side Kick / Split Kick" },
  "24": { pinyin: "Zhèng Tī Tuǐ / Cè Tī Tuǐ", ar: "الركلة الأمامية المستقيمة / الركلة الجانبية المستقيمة", en: "Front Straight Kick / Side Straight Kick" },
  "25": { pinyin: "Lǐ Hé / Bǎi Lián / Dān Pái Jiǎo / Zhuǎn Shēn Hòu Bǎi Tuǐ", ar: "الركلة للداخل مع الصفع / الركلة للخارج مع الصفع / الركلة الأمامية مع الصفع / الركلة الهلالية الخلفية مع الدوران", en: "Inward Slap / Outward Slap / Front Slap / Spinning Back Crescent Kick" },
  "26": { pinyin: "Tí Xī Dú Lì", ar: "رفع الركبة", en: "Single Knee Raised" },
  "27": { pinyin: "Héng Dīng Tuǐ", ar: "ركلة المسمار الأفقية", en: "Horizontal Nail Kick" },

  // Tab 3 — Jumps
  "30": { pinyin: "Téng Kōng Fēi Jiǎo / Xie Fei / Xuan Feng / Bai Lian / Qian Jin / Hou Jin", ar: "القفزة الطائرة الأمامية مع الصفع / الركلة الطائرة المائلة / القفز للإعصار / القفز للخارج / القفزة للداخل", en: "Slap Jump / Oblique Jump / Tornado Jump / Outward Jump / Inward Jump" },
  "31": { pinyin: "Téng Kōng Zhèng Tī Tuǐ", ar: "الركلة الأمامية المستقيمة مع القفز", en: "Jumping Front Straight Kick" },
  "32": { pinyin: "Cè Kōng Fān / Cè Kōng Tī", ar: "العجلة الهوائية / العجلة الهوائية مع اللف", en: "Aerial Cartwheel / Aerial Cartwheel Twist" },
  "33": { pinyin: "Xuàn Zi / Xuàn Zi Zhuǎn Tǐ", ar: "ركلة الفراشة / ركلة الفراشة مع الدوران", en: "Butterfly / Butterfly Twist" },
  "34": { pinyin: "Téng Kōng Jiàn Tán / Téng Kōng Dēng Tuǐ", ar: "الركلة النابضة الطائرة / ركلة الدفع بالكعب", en: "Jumping Snap Kick / Jumping Heel Push" },

  // Tab 4 — Nanquan Landing
  "40": { pinyin: "Téng Kōng Pán Tuǐ 360° Cè Pū", ar: "ركلة طائرة مع تقاطع الساقين والهبوط على الجنب", en: "360 Jump Split with Side Landing" },
  "41": { pinyin: "Tēng Kōng Cè Chāi", ar: "الركلة الجانبية المزدوجة بالقفز", en: "Jumping Split Side Kick" },
  "42": { pinyin: "Téng Kōng Shuāng Cè Chuài", ar: "الركلة الجانبية المزدوجة بالقفز", en: "Jumping Double Side Kick" },

  // Tab 5 — Stances
  "50": { pinyin: "Gōng Bù", ar: "وضع القوس", en: "Bow Stance" },
  "51": { pinyin: "Mǎ Bù", ar: "وضعية الحصان", en: "Horse Stance" },
  "52": { pinyin: "Xū Bù", ar: "الوضعية الفارغة", en: "Empty Stance" },
  "53": { pinyin: "Pū Bù", ar: "وضع الانخفاض", en: "Crouching Stance" },
  "54": { pinyin: "Xiē Bù", ar: "وضع الجلوس المتقاطع", en: "Cross-Legged Stance" },
  "55": { pinyin: "Dié Bù", ar: "وضعية الفراشة", en: "Butterfly Stance" },
  "56": { pinyin: "Guì Bù", ar: "وضع الركوع", en: "Kneeling Stance" },
  "57": { pinyin: "Qí Lóng Bù", ar: "وضعية ركوب التنين", en: "Dragon Riding Stance" },
  "58": { pinyin: "Zuò Pán", ar: "وضع الجلوس المتقاطع على الأرض", en: "Cross-Legged Ground Sitting" },
  "59": { pinyin: "Shàng Bù / Tuì Bù / Jìn Bù / Gēn Bù / Cè Xíng Bù", ar: "خطوة التقدم إلى الأمام / خطوة التراجع / خطوة إلى الأمام / الخطوات المتتابعة / الخطوة الجانبية", en: "Stepping Footwork Methods" },

  // Tab 6 — Weapons & Fan
  "60": { pinyin: "Guā Jiàn / Liāo Jiàn / Shàn Liāo / Guà Shàn", ar: "صد السيف الدائري / رفع السيف للأعلى / الدفاع والقطع بالسيف الرفيع أو بالمروحة", en: "Defend & Cut Sword / Fan Lift" },
  "61": { pinyin: "Wò Jiàn / Kāi Shàn", ar: "مسك السيف / فتح المروحة", en: "Sword Grip / Open Fan" },
  "62": { pinyin: "Chán Tóu / Guǒ Nǎo", ar: "لف السيف العريض حول الرأس / لف السيف خلف الرأس", en: "Broadsword Wrap Around Head / Behind Head" },
  "63": { pinyin: "Lán Qiāng / Ná Qiāng / Zhā Qiāng / Hé Shàn / Cì Shàn / Pī Shàn", ar: "صد بالرمح للخارج / صد بالرمح للداخل / الطعن بالرمح / غلق المروحة / الطعن بالمروحة / القطع بالمروحة", en: "Spear Defenses & Stabs / Fan Close, Stab, Chop" },
  "64": { pinyin: "Píng Lún Gùn", ar: "دوران العصا أفقياً بيد واحدة", en: "Horizontal Staff Rotation" },
  "65": { pinyin: "Lì Wǔ Huā Qiāng / Lì Wǔ Huā Gùn", ar: "شكل الرقم (8) العمودي بالرمح / شكل الرقم (8) العمودي بالعصا", en: "Vertical Figure-8 Spear / Staff" },
  "66": { pinyin: "Gùn Shuāng Shǒu Tí Liāo Huā / Qi Xiè Pāo Jiē / Pāo Jiē Shàn", ar: "رفع العصا بشكل عمودي باليدين / رمي واستقبال السلاح / رمي المروحة والتقاطها", en: "Staff Lift / Weapon Throw & Catch / Fan Catch" },
  "67": { pinyin: "Dīng Gùn", ar: "تثبيت العصا (غرس العصا)", en: "Ground Staff Support" },
  "68": { pinyin: "Jiǎo Jiàn", ar: "تدوير السيف", en: "Sword Tip Rotation" },
  "69": { pinyin: "Diǎn Shàn", ar: "الطعن برأس بالمروحة", en: "Fan Tip Dab/Stab" },

  // Tab 7 — General Deductions (IWUF Standard)
  "70A": { pinyin: "Yáo Huàng", ar: "اهتزاز الجذع", en: "Torso sways", value: 0.05 },
  "70B": { pinyin: "Yí Bù / Tiào Bù", ar: "تحريك القدم أو القفز الإضافي", en: "Foot shuffles or skips", value: 0.10 },
  "71": { pinyin: "Zhī Chēng", ar: "الدعم الإضافي", en: "Additional Support", value: 0.20 },
  "72": { pinyin: "Diē Dǎo", ar: "السقوط", en: "Fall", value: 0.30 },
  "73": { pinyin: "Chū Jiè", ar: "الخروج من البساط", en: "Out-of-bounds", value: 0.10 },
  "74": { pinyin: "Wàng Dòng Zuò", ar: "نسيان حركة", en: "Forgetting movement", value: 0.10 },
  "75": { pinyin: "Fú Shì Luò / Cán Qiē", ar: "سقوط زينة السلاح أو جزء من اللباس أو غطاء الرأس / التفاف الزينة أو السلاح اللين / فقدان الحذاء", en: "Apparel Ornament Drop / Wrapping / Lost Shoe", value: 0.05 },
  "76": { pinyin: "Qì Xiè Cù Dì / Shī Kòng / Ping Heng", ar: "عدم تنفيذ حركة التوازن بإيقاع سريع ومناسب / عدم الثبات في التوازن لمدة لا تقل عن ثانيتين", en: "Unsteady Balance Rhythm / Held under 2 sec", value: 0.10 },
  "77": { pinyin: "Qì Xiè Cù Dì / Shī Kòng", ar: "لمس السلاح للأرض / فقدان السيطرة على السلاح", en: "Weapon touches ground / loss of control", value: 0.10 },
  "78": { pinyin: "Qì Xiè Zhàng Ái / Biàn Xíng / Shàn Miàn", ar: "اصطدام السلاح بالجسم / تشوه السلاح / انفصال سطح المروحة", en: "Weapon hits body / deformation / fan detached", value: 0.20 },
  "79": { pinyin: "Qì Xiè Duàn / Qì Xiè Luò Dì", ar: "كسر السلاح / كسر أجزاء المروحة أو سقوط مساميرها / سقوط السلاح على الأرض", en: "Broken weapon or fan parts / Weapon dropped", value: 0.30 },
};

export const GENERAL_CODES = ["70A", "70B", "71", "72", "73", "74", "75", "76", "77", "78", "79"] as const;

export const UNIVERSAL_CODES = ["01", "02", "23", "25", "26", "30", "50", "51", "52", "53"] as const;

const STYLE_CODES: Record<GroupAStyle, string[]> = {
  changquan: [
    "01", "02", "03", "04",
    "10", "12", "13", "14", "15", "16",
    "20", "21", "22", "23", "24", "25", "26",
    "30", "31", "32", "33", "34",
    // التبويب 4 محذوف بالكامل هنا ليتعطل الزر 4 تماماً في الشمالي
    "50", "51", "52", "53", "54", "58",
    "60", "61", "62", "63", "64", "65", "66",
    ...GENERAL_CODES,
  ],
  nanquan: [
    "01", "02", "03", "04",
    "20", "23", "25", "26", "27",
    "30", "32",
    "40", "41", "42", // تم حذف 44
    "50", "51", "52", "53", "55", "56", "57",
    "62", "67", // تم حذف 65 و 66
    ...GENERAL_CODES,
  ],
  taijiquan: [
    "01", "02", "04", "05", "06",
    "17", "18", "19", // تم حذف 16
    "22", "23", "25", "26",
    "30", "31",
    // التبويب 4 محذوف هنا أيضاً
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

export const GROUP_A_RULES: GroupARule[] = buildRules();

export function resolveStyle(style: string | null | undefined): GroupAStyle {
  const s = (style ?? "").toLowerCase();
  if (s.includes("nan")) return "nanquan";
  if (s.includes("tai") || s.includes("tj") || s.includes("شأن")) return "taijiquan";
  return "changquan";
}

export function rulesForStyle(style: string | null | undefined): GroupARule[] {
  const s = resolveStyle(style);
  return GROUP_A_RULES.filter(r => r.style === s && r.activeForStyle).sort((a, b) =>
    a.errorCode.localeCompare(b.errorCode, "en", { numeric: true }),
  );
}

export function rulesForKey(style: string | null | undefined, key: string): GroupARule[] {
  return rulesForStyle(style).filter(r => r.group === key);
}

export function enabledKeysForStyle(style: string | null | undefined): string[] {
  const active = rulesForStyle(style);
  return GROUP_A_KEYS.filter(k => active.some(r => r.group === k));
}

export const REQUIRES_SUBCODE_KEYS = ["7"] as const;
