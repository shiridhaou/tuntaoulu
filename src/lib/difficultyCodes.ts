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

export function lookupCode(code: string): DifficultyMovement {
  const key = code.trim().toUpperCase();
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

/** True when a code represents a connection (combined) rather than a single movement. */
export function isConnectionCode(code: string): boolean {
  return /\+/.test(String(code ?? ""));
}

/** Normalize a combined code like "323a + 353b" into a connection bonus entry. */
export function lookupConnection(code: string): ConnectionBonus {
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
