import type { DifficultyMovement } from "@/store/competition-store";

/**
 * IWUF Difficulty Codes catalogue.
 * Maps a code like "323A" to a friendly label, connection group, and value.
 *
 * Group C (Optional routines only) is worth 2.00 in total:
 *   · Movement difficulty (حركات الصعوبة) .. max 1.40
 *   · Connection difficulty (وضعيات الربط) . max 0.60
 */
const CATALOG: Record<string, Omit<DifficultyMovement, "code">> = {
  "142A": { label: "Balance Kick Hold",     connection: "Independent", value: 0.2 },
  "175A": { label: "Horizontal Balance",    connection: "Independent", value: 0.2 },
  "244B": { label: "Butterfly Twist 720°",  connection: "A+B",         value: 0.3 },
  "312A": { label: "Split Leap",            connection: "Independent", value: 0.2 },
  "323A": { label: "Tornado 360°",          connection: "Independent", value: 0.2 },
  "323B": { label: "Tornado 540°",          connection: "A+B",         value: 0.3 },
  "323C": { label: "Tornado 720°",          connection: "A+B+C",       value: 0.4 },
  "324A": { label: "Double Aerial Kick",    connection: "Independent", value: 0.2 },
  "324B": { label: "Triple Aerial Kick",    connection: "A+B",         value: 0.3 },
  "324C": { label: "Aerial Kick 720°",      connection: "A+B+C",       value: 0.4 },
  "333A": { label: "Sweep + Spin",          connection: "A+B",         value: 0.2 },
  "333B": { label: "Sweep + Jump",          connection: "A+B+C",       value: 0.3 },
  "342A": { label: "Lotus Kick 360°",       connection: "Independent", value: 0.2 },
  "353A": { label: "Aerial 360°",           connection: "Independent", value: 0.3 },
  "353B": { label: "Double Aerial Spin",    connection: "A+B",         value: 0.4 },
  "353C": { label: "Triple Aerial Spin",    connection: "A+B+C",       value: 0.5 },
  "355B": { label: "Aerial Spin 540° Land", connection: "A+B",         value: 0.4 },
  "423A": { label: "Whirlwind Kick 360°",   connection: "Independent", value: 0.2 },
  "447A": { label: "Back Flip Landing",     connection: "Independent", value: 0.3 },
  "753A": { label: "Weapon Aerial 360°",    connection: "Independent", value: 0.3 },
};

/** Codes offered as one-tap shortcuts on the Group C judge panel. */
export const QUICK_CODES: string[] = [
  "323A", "324B", "353C", "753A", "324C", "355B",
  "244B", "342A", "175A", "423A", "447A", "142A",
];

export interface ConnectionBonus {
  code: string;
  label: string;
  labelAr: string;
  value: number;
}

/** Connection difficulty (وضعيات الربط) — combined ceiling 0.60. */
export const CONNECTION_BONUSES: ConnectionBonus[] = [
  { code: "CN-01", label: "Fubu (Crouch stance)",  labelAr: "فوبو — وضعية القرفصاء", value: 0.1 },
  { code: "CN-02", label: "Congbo (Run-up combo)", labelAr: "تسونغبو — ربط بالجري",  value: 0.2 },
  { code: "CN-03", label: "Throw + Crash landing", labelAr: "رمي + سقوط",            value: 0.3 },
  { code: "CN-04", label: "Balance connection",    labelAr: "ربط بوضعية توازن",      value: 0.1 },
  { code: "CN-05", label: "Kick + Sweep chain",    labelAr: "ركل + كنس متصل",        value: 0.2 },
];

export const MAX_C_MOVEMENT = 1.4;
export const MAX_C_CONNECTION = 0.6;

/** Default bonus for a bare "+" connection node. */
export const DEFAULT_CONNECTION_VALUE = 0.1;

/**
 * A "plus" connection node written by the TA as `+`, `+0.10`, `+0.15`, `+1`,
 * `+6` … It belongs to the 0.60 connection bucket, never to the 1.40
 * movement bucket. Returns null when the code is not a plus node.
 */
export function parsePlusConnection(
  raw: string,
): { code: string; value: number; suffix: string } | null {
  const s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s.startsWith("+")) return null;
  const suffix = s.slice(1);
  if (suffix && !/^\d*[.,]?\d*$/.test(suffix)) return null; // e.g. "+353B" → combined code
  const n = parseFloat(suffix.replace(",", "."));
  // Decimal suffixes are explicit bonus values (0.10 / 0.15 / 0.20).
  // Integer suffixes (+1, +6) are ordinal labels, not values.
  const value = isFinite(n) && n > 0 && n < 1 ? n : DEFAULT_CONNECTION_VALUE;
  return { code: `+${suffix}`, value, suffix };
}

/* ───────── Numeric connection codes (1 … 11) ─────────
   Official sheets write connection / landing slots as bare numbers next to
   the difficulty movement they belong to (e.g. `312A  +  324C  6  353B`).
   They belong to the 0.60 connection bucket and their point value follows
   the IWUF table: the grade (A / B / C) of the PRECEDING difficulty movement
   and the discipline decide the bonus. */

export type DifficultyGrade = "A" | "B" | "C";

/** Bonus per grade of the preceding movement, per discipline family. */
const CONNECTION_VALUE_BY_STYLE: Record<string, Record<DifficultyGrade, number>> = {
  changquan:  { A: 0.1, B: 0.15, C: 0.2 },
  nanquan:    { A: 0.1, B: 0.15, C: 0.2 },
  taijiquan:  { A: 0.1, B: 0.15, C: 0.2 },
  default:    { A: 0.1, B: 0.15, C: 0.2 },
};

/** Labels for the numeric connection / landing slots used on official sheets. */
const NUMERIC_CONNECTION_LABELS: Record<number, { label: string; labelAr: string }> = {
  1:  { label: "Connection 1",  labelAr: "ربط 1" },
  2:  { label: "Connection 2",  labelAr: "ربط 2" },
  3:  { label: "Connection 3",  labelAr: "ربط 3" },
  4:  { label: "Connection 4",  labelAr: "ربط 4" },
  5:  { label: "Connection 5",  labelAr: "ربط 5" },
  6:  { label: "Connection 6",  labelAr: "ربط 6" },
  7:  { label: "Connection 7",  labelAr: "ربط 7" },
  8:  { label: "Connection 8",  labelAr: "ربط 8" },
  9:  { label: "Connection 9",  labelAr: "ربط 9" },
  10: { label: "Connection 10", labelAr: "ربط 10" },
  11: { label: "Connection 11", labelAr: "ربط 11" },
};

/** True for a bare numeric connection slot code, `1` … `11`. */
export function parseNumericConnection(raw: string): { code: string; ordinal: number } | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (n < 1 || n > 11) return null;
  return { code: String(n), ordinal: n };
}

/** Grade (A / B / C) carried by a difficulty code such as `353B`. */
export function gradeOfCode(code: string): DifficultyGrade {
  const last = String(code ?? "").trim().toUpperCase().slice(-1);
  return last === "C" ? "C" : last === "B" ? "B" : "A";
}

/**
 * Point value of a connection slot, given the discipline and the grade of the
 * difficulty movement it is attached to. Used for numeric slots and for the
 * bare `+` step connector.
 */
export function connectionValueFor(style?: string | null, grade: DifficultyGrade = "A"): number {
  const table = CONNECTION_VALUE_BY_STYLE[String(style ?? "").toLowerCase()]
    ?? CONNECTION_VALUE_BY_STYLE["default"]!;
  return table[grade];
}


export function lookupCode(code: string): DifficultyMovement {
  const key = code.trim().toUpperCase();
  const plus = parsePlusConnection(key);
  if (plus) {
    return {
      code: plus.code,
      label: plus.suffix ? `Connection ${plus.suffix}` : "Connection",
      connection: "Connection",
      value: plus.value,
    };
  }
  if (/\+/.test(key)) {
    const parts = key.split("+").map(s => s.trim()).filter(Boolean);
    return {
      code: parts.join("+"),
      label: `Connection ${parts.join(" + ")}`,
      connection: "Connection",
      value: parts.length >= 3 ? 0.3 : 0.2,
    };
  }
  const meta = CATALOG[key];
  if (meta) return { code: key, ...meta };

  const tier = key.slice(-1);
  const value = tier === "C" ? 0.4 : tier === "B" ? 0.3 : 0.2;
  return { code: key, label: key, connection: "Independent", value };
}

/**
 * Parse a free-text "Difficulty Codes" cell into an array of normalized codes.
 * Accepts comma-, semicolon-, slash-, pipe- or space-separated values.
 */
export function parseDifficultyCodes(raw: unknown): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  return s
    // keep "+ 0.10" / "+ 6" glued to their plus sign
    .replace(/\+\s+(?=[\d.,])/g, "+")
    // "323A+353B" stays combined; a standalone "+" stays its own token
    .split(/[,;|/\s]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Build a Group C difficulty sheet from a list of codes. Unknown codes get a
 * sensible fallback so judges still see them and can score them.
 */
export function buildDifficultySheet(codes: string[]): DifficultyMovement[] {
  return codes.map(lookupCode);
}

/* ───────── Connection codes (وضعيات الربط) ─────────
   Excel sheets may express a connection as a combined code such as
   "323A+353B". These are judged separately from movement difficulty and
   count against the 0.60 connection ceiling. */

/** True when a code represents a connection (combined, or a "+" bonus node). */
export function isConnectionCode(code: string): boolean {
  return /\+/.test(String(code ?? ""));
}

/** Normalize a combined code like "323a + 353b", or a "+" bonus node, into a connection entry. */
export function lookupConnection(code: string): ConnectionBonus {
  const plus = parsePlusConnection(String(code).toUpperCase());
  if (plus) {
    return {
      code: plus.code,
      label: plus.suffix ? `Connection ${plus.suffix}` : "Connection",
      labelAr: plus.suffix ? `ربط ${plus.suffix}` : "وضعية ربط",
      value: plus.value,
    };
  }
  const parts = String(code).toUpperCase().split("+").map(s => s.trim()).filter(Boolean);
  const key = parts.join("+");
  const value = parts.length >= 3 ? 0.3 : 0.2;
  return {
    code: key,
    label: `Connection ${parts.join(" + ")}`,
    labelAr: `ربط ${parts.join(" + ")}`,
    value,
  };
}
