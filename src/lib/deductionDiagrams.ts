/* UI-only reference data for the Group A deduction modal.
   Hand-drawn diagrams + pinyin titles extracted from
   Wushu_Judging_Rules_HandDrawn_PlatformReady_FINAL.pdf. */

import d020 from "@/assets/deductions/d-001-020.asset.json";
import d032 from "@/assets/deductions/d-001-032.asset.json";
import d062 from "@/assets/deductions/d-002-062.asset.json";
import d076 from "@/assets/deductions/d-002-076.asset.json";
import d084 from "@/assets/deductions/d-002-084.asset.json";
import d127 from "@/assets/deductions/d-003-127.asset.json";
import d133 from "@/assets/deductions/d-003-133.asset.json";
import d146 from "@/assets/deductions/d-004-146.asset.json";

export type CategoryInfo = {
  pinyin: string;
  titleAr: string;
  image: string;
};

/** Keyed by category (tens digit). Group A keypad is limited to 0–7. */
export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  "0": { pinyin: "Jī Běn", titleAr: "عام / بدون فئة", image: d020.url },
  "1": { pinyin: "Shǒu Xíng · Bù Xíng", titleAr: "الأساسيات والوقفات", image: d084.url },
  "2": { pinyin: "Nán Quán", titleAr: "النانكوان", image: d062.url },
  "3": { pinyin: "Tiào Yuè", titleAr: "القفزات", image: d032.url },
  "4": { pinyin: "Jié Zòu", titleAr: "الإيقاع والانسجام", image: d076.url },
  "5": { pinyin: "Tài Jí Quán", titleAr: "التايجي", image: d127.url },
  "6": { pinyin: "Qì Xiè", titleAr: "التزامن والسلاح", image: d133.url },
  "7": { pinyin: "Píng Héng", titleAr: "الوضعيات والتوازن", image: d146.url },
};

/** Per-code pinyin hints shown in the modal rows. */
export const CODE_PINYIN: Record<string, string> = {
  "10A": "Jī Běn Gōng",
  "10B": "Bù Xíng",
  "11": "Yí Bù",
  "12": "Shēn Fǎ",
  "20A": "Nán Quán Jìn",
  "20B": "Shǒu Xíng",
  "21": "Fā Shēng",
  "30A": "Tiào Gāo",
  "30B": "Zhuǎn Tǐ",
  "31": "Luò Dì",
  "32": "Diē Dǎo",
  "40A": "Jié Zòu",
  "40B": "Biàn Huà",
  "41": "Tíng Dùn",
  "50A": "Lián Guàn",
  "50B": "Róu Hé",
  "51": "Bù Wěn",
  "52": "Shī Héng",
  "60A": "Yīn Yuè",
  "60B": "Qì Xiè Yí",
  "61": "Qì Xiè Tuō",
  "62": "Qì Xiè Luò",
  "70A": "Yáo Huàng",
  "70B": "Shī Héng",
  "71": "Zhī Chēng",
  "72": "Diē Dǎo",
};

export const GROUP_A_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;
