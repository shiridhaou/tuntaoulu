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

/** Every difficulty code known to the internal Taolu rules table. */
export const KNOWN_CODES: string[] = Object.keys(CATALOG).sort();

/** Label + value pairs for TA drop-downs. */
export const KNOWN_CODE_OPTIONS: { code: string; label: string; value: number }[] =
  KNOWN_CODES.map((code) => ({ code, label: CATALOG[code]!.label, value: CATALOG[code]!.value }));

/**
 * True when a code can be resolved by the engine: a catalogued difficulty
 * movement, a numeric connection slot (0…11), or a "+" connection node.
 * Anything else is surfaced as "Invalid Code" in the TA table.
 */
export function isKnownCode(code: string): boolean {
  const key = String(code ?? "").trim().toUpperCase();
  if (!key) return false;
  if (isConnectionCode(key)) return true;
  return Object.prototype.hasOwnProperty.call(CATALOG, key);
}

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

/** Official IWUF connection / landing slot labels, `0` … `11`. */
const NUMERIC_CONNECTION_LABELS: Record<number, { label: string; labelAr: string }> = {
  0:  { label: "Direct connection (0 steps)", labelAr: "ربط مباشر (بدون خطوات)" },
  1:  { label: "Connection within 1 step",    labelAr: "ربط بخطوة واحدة" },
  2:  { label: "Connection within 2 steps",   labelAr: "ربط بخطوتين" },
  3:  { label: "Connection within 3 steps",   labelAr: "ربط بثلاث خطوات" },
  4:  { label: "Connection within 4 steps",   labelAr: "ربط بأربع خطوات" },
  5:  { label: "Landing connection 5",        labelAr: "ربط هبوط 5" },
  6:  { label: "Landing connection 6",        labelAr: "ربط هبوط 6" },
  7:  { label: "Landing connection 7",        labelAr: "ربط هبوط 7" },
  8:  { label: "Kick connection 8",           labelAr: "ربط ركل 8" },
  9:  { label: "Kick connection 9",           labelAr: "ربط ركل 9" },
  10: { label: "Kick connection 10",          labelAr: "ربط ركل 10" },
  11: { label: "Kick connection 11",          labelAr: "ربط ركل 11" },
};

/** True for a bare numeric connection slot code, `0` … `11`. */
export function parseNumericConnection(raw: string): { code: string; ordinal: number } | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (n < 0 || n > 11) return null;
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


export function lookupCode(code: string, ctx: { style?: string | null; prevCode?: string | null } = {}): DifficultyMovement {
  const key = code.trim().toUpperCase();
  const numeric = parseNumericConnection(key);
  if (numeric) {
    const c = lookupConnection(key, ctx);
    return { code: c.code, label: c.label, connection: "Connection", value: c.value };
  }
  const plus = parsePlusConnection(key);
  if (plus) {
    const c = lookupConnection(key, ctx);
    return { code: c.code, label: c.label, connection: "Connection", value: c.value };
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
    // Keep explicit bonuses / ordinal slots glued ("+ 0.10", "+ 6"), but
    // leave "+ 323B" as two timeline items: a connection then a movement.
    .replace(/\+\s+(?=(?:0?[.,]\d+|\d{1,2})(?=$|[,;|/\s]))/g, "+")
    // "323A+353B" stays combined; a standalone "+" stays its own token
    .split(/[,;|/\s]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Build a Group C difficulty sheet from a list of codes. Unknown codes get a
 * sensible fallback so judges still see them and can score them.
 */
export function buildDifficultySheet(codes: string[], style?: string | null): DifficultyMovement[] {
  let prevCode: string | null = null;
  return codes.map((code) => {
    const meta = lookupCode(code, { style, prevCode });
    if (!isConnectionCode(code)) prevCode = code;
    return meta;
  });
}


/* ───────── Connection codes (وضعيات الربط) ─────────
   Excel sheets may express a connection as a combined code such as
   "323A+353B". These are judged separately from movement difficulty and
   count against the 0.60 connection ceiling. */

/** Context used to price a connection slot (discipline + preceding movement). */
export interface ConnectionContext {
  style?: string | null;
  /** Code of the difficulty movement this connection is attached to. */
  prevCode?: string | null;
}

/** True when a code represents a connection: combined, `+` node, or `1`..`11`. */
export function isConnectionCode(code: string): boolean {
  const s = String(code ?? "").trim();
  return /\+/.test(s) || parseNumericConnection(s) !== null;
}

/** Normalize a combined code, a "+" node, or a numeric slot into a connection entry. */
export function lookupConnection(code: string, ctx: ConnectionContext = {}): ConnectionBonus {
  const raw = String(code ?? "").trim();
  const grade = gradeOfCode(ctx.prevCode ?? "");
  const numeric = parseNumericConnection(raw);
  if (numeric) {
    const meta = NUMERIC_CONNECTION_LABELS[numeric.ordinal]!;
    return {
      code: numeric.code,
      label: meta.label,
      labelAr: meta.labelAr,
      value: connectionValueFor(ctx.style, grade),
    };
  }
  const plus = parsePlusConnection(raw.toUpperCase());
  if (plus) {
    // "+3" / "+6" are the same connection slots as the bare numbers.
    const slot = /^\d{1,2}$/.test(plus.suffix) ? parseNumericConnection(plus.suffix) : null;
    if (slot) {
      const meta = NUMERIC_CONNECTION_LABELS[slot.ordinal]!;
      return {
        code: `+${slot.code}`,
        label: meta.label,
        labelAr: meta.labelAr,
        value: connectionValueFor(ctx.style, grade),
      };
    }
    // "+0.15" carries an explicit value; a bare "+" is priced from context.
    const explicit = /^[.,]?\d*[.,]\d+$/.test(plus.suffix);
    return {
      code: plus.code,
      label: plus.suffix ? `Connection ${plus.suffix}` : "Step Connection",
      labelAr: plus.suffix ? `ربط ${plus.suffix}` : "ربط بخطوة",
      value: explicit ? plus.value : connectionValueFor(ctx.style, grade),
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
