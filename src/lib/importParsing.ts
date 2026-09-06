/**
 * importParsing.ts
 * ----------------------------------------------------------------------------
 * Pure, side-effect-free helpers used when importing athlete rosters from
 * Excel/CSV files. Extracted from TechnicalAssistantDashboard.tsx so the
 * parsing/normalization logic can be unit-tested and reused independently
 * of any React component.
 *
 * Nothing in this file touches Supabase, React state, or the DOM — every
 * export is a plain function of its inputs.
 * ----------------------------------------------------------------------------
 */

import { toWesternDigits } from "@/lib/numFormat";
import { normalizeStyle } from "@/lib/styleNames";
import { classifyAge, type AgeCategory } from "@/lib/ageCategories";

// ============================================================================
// Types
// ============================================================================

export interface DifficultyItem {
  code: string;
  label: string;
  value: number;
}

/** Shape returned by `normalizeRow` — one parsed athlete record, ready for
 *  preview/insert. `_mode` is transient and must be stripped before any DB
 *  write (the original dashboard does this in `persistRecords`). */
export interface NormalizedAthleteRow {
  tournament_id: string;
  bib_number: string | null;
  full_name: string;
  gender: string | null;
  birth_date: string | null;
  age_category: string | null;
  club: string | null;
  country: string | null;
  style: string | null;
  difficulty_codes: string[];
  difficulty_sheet: DifficultyItem[];
  status: "waiting";
  /** transient — must be stripped before persisting to the DB */
  _mode: "compulsory" | "optional" | null;
}

// ============================================================================
// Key normalization / cell lookup
// ============================================================================

/**
 * Normalizes a column header (or any string) for fuzzy matching: strips
 * Arabic diacritics, unifies alef/ya/ta-marbuta variants, removes separators,
 * and lowercases. Lets "Full Name", "full_name", and "الاسم الكامل" all be
 * matched against the same candidate-key list.
 */
export function normalizeKey(s: string): string {
  return s
    .toString()
    .replace(/[\u064B-\u0652\u0670]/g, "") // strip Arabic diacritics
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_\-./\\]+/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Looks up a value in a parsed spreadsheet row by trying a list of candidate
 * header names (in any language/casing/separator style). Returns the first
 * non-empty match, with Eastern-Arabic/Persian digits converted to 0-9 so
 * downstream parseFloat/parseDate calls work regardless of source locale.
 */
export function pick(row: Record<string, any>, keys: string[]): string {
  const normalizedKeys = keys.map(normalizeKey);
  for (const rk of Object.keys(row)) {
    const nk = normalizeKey(rk);
    const idx = normalizedKeys.indexOf(nk);
    if (idx !== -1 && row[rk] != null && String(row[rk]).trim() !== "") {
      return toWesternDigits(String(row[rk]).trim()).trim();
    }
  }
  return "";
}

// ============================================================================
// Field-level detectors
// ============================================================================

/** Detects match mode (compulsory/optional) from a free-text cell value,
 *  across Arabic/English/French phrasing. Returns null if undetermined. */
export function detectMatchMode(v: string): "compulsory" | "optional" | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (/(compuls|mandator|الزام|اجبار|إلزام|إجبار)/i.test(s)) return "compulsory";
  if (/(option|اختيار|حر|free)/i.test(s)) return "optional";
  return null;
}

/** Detects/normalizes a Wushu style value (e.g. "Northern", "CQ", "شمالي")
 *  down to the canonical style key via the shared styleNames normalizer. */
export function detectStyle(v: string): string | null {
  if (!v) return null;
  return normalizeStyle(v);
}

/**
 * Parses a date cell into canonical `YYYY-MM-DD`. Accepts ISO-prefixed
 * strings, `D/M/YYYY`-style separators (`/`, `-`, `.`), 2-digit years
 * (pivoted at 30), and falls back to native Date parsing. Returns null if
 * the value can't be interpreted as a date.
 */
export function parseDate(v: string): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 30 ? "19" : "20") + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ============================================================================
// Row normalization (Excel/CSV → athlete record)
// ============================================================================

/**
 * Normalizes one raw spreadsheet row into an athlete record ready for
 * preview/import. Handles bilingual (AR/FR/EN) header variants, per-movement
 * Group-C columns (`C1_code`/`C1_value`/`C1_label` … up to 20), and derives
 * age category from birth date when not explicitly provided.
 */
export function normalizeRow(row: Record<string, any>, tournamentId: string): NormalizedAthleteRow {
  const bib = pick(row, ["number", "bib", "bib_number", "dossard", "n°", "no", "num", "id", "registration", "رقم", "الرقم", "رقم التسجيل", "رقم اللاعب"]);
  const name = pick(row, ["name", "full_name", "fullname", "athlete", "athlete_name", "nom", "nom complet", "nom_complet", "prenom nom", "participant", "competitor", "الاسم", "اسم", "اسم اللاعب", "الاسم الكامل"]);
  const gender = pick(row, ["gender", "sex", "sexe", "genre", "m/f", "الجنس", "النوع الاجتماعي"]);
  const birth = pick(row, ["birth", "birth_date", "date_of_birth", "dob", "naissance", "date de naissance", "تاريخ الميلاد", "الميلاد"]);
  const club = pick(row, ["club", "team", "equipe", "équipe", "association", "school", "ecole", "النادي", "نادي", "الجمعية", "الفريق"]);
  const country = pick(row, ["country", "pays", "nation", "الدولة", "بلد", "البلد"]);
  const categoryRaw = pick(row, ["category", "age_category", "age", "age group", "categorie", "catégorie", "cat", "الفئة", "الصنف", "الفئة العمرية"]);

  const styleRaw = pick(row, ["style", "styles", "discipline", "epreuve", "épreuve", "event", "event_type", "speciality", "specialty", "الأسلوب", "الاسلوب", "الاختصاص", "النوع"]);
  const modeRaw = pick(row, ["match_mode", "mode", "match mode", "type", "category_type", "نوع المنافسة", "النمط", "نمط", "نوع"]);
  // Pattern C — one combined column holding all Group C codes.
  const diffRaw = pick(row, [
    "difficulty_codes", "difficulty codes", "difficulty", "difficulties", "codes",
    "group_c", "group c", "groupc", "c_codes", "c codes", "movements", "difficulty_sheet",
    "صعوبة", "الصعوبة", "أكواد الصعوبة", "حركات الصعوبة", "المجموعة ج",
  ]);
  const birth_date = parseDate(birth);
  const style = detectStyle(styleRaw);
  const matchMode = detectMatchMode(modeRaw);

  // ── Pattern A/B — per-movement columns:
  //    A: C1_code + C1_value | C1_val | C1_pts (+ optional C1_label)
  //    B: shorthand C1 / C2 / … holding the code alone (value looked up)
  const sheet: DifficultyItem[] = [];
  for (let i = 1; i <= 20; i++) {
    const code = pick(row, [
      `C${i}_code`, `c${i}_code`, `c${i} code`, `code${i}`, `code ${i}`,
      `movement${i}_code`, `m${i}_code`, `movement_${i}`, `صعوبة${i}`, `حركة${i}`,
      // Pattern B — shorthand single column
      `C${i}`, `c${i}`, `c-${i}`, `c ${i}`, `d${i}`, `diff${i}`, `difficulty${i}`,
    ]);
    if (!code) continue;
    const valRaw = pick(row, [
      `C${i}_value`, `c${i}_value`, `c${i} value`, `C${i}_val`, `c${i}_val`, `c${i} val`,
      `value${i}`, `val${i}`, `points${i}`, `pts${i}`, `C${i}_pts`, `c${i}_points`, `قيمة${i}`,
    ]);
    const label = pick(row, [
      `C${i}_label`, `c${i}_label`, `c${i} label`, `label${i}`,
      `name${i}`, `movement${i}_name`, `اسم${i}`,
    ]);
    const cleanCode = code.toUpperCase().trim();
    const v = parseFloat(valRaw.replace(",", "."));
    const fallback = lookupCode(cleanCode);
    sheet.push({
      code: cleanCode,
      label: label || fallback.label || cleanCode,
      value: isFinite(v) ? v : fallback.value,
    });
  }

  // Pattern C — parse the combined column and build a sheet when no
  // per-movement columns were present.
  const codes = diffRaw
    ? parseDifficultyCodes(diffRaw)
    : sheet.map((s) => s.code);

  if (!sheet.length && codes.length) {
    for (const c of codes) {
      const meta = lookupCode(c);
      sheet.push({ code: meta.code, label: meta.label, value: meta.value });
    }
  }


  return {
    tournament_id: tournamentId,
    bib_number: bib || null,
    full_name: name,
    gender: gender || null,
    birth_date,
    age_category: (categoryRaw && String(categoryRaw).trim()) || classifyAge(birth_date),
    club: club || null,
    country: country || null,
    style: style || null,
    difficulty_codes: codes,
    difficulty_sheet: sheet,
    status: "waiting",
    // transient (stripped before DB insert)
    _mode: matchMode,
  };
}

// Re-exported for convenience so consumers of this module don't need a
// separate import from "@/lib/ageCategories" just to type athlete rows.
export type { AgeCategory };
