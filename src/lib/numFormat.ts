/**
 * Western (ASCII) digit formatting helpers.
 * The UI is RTL/Arabic, but every number, date and score MUST render with
 * standard Western Arabic numerals (0-9) — never Eastern Arabic/Hindi digits.
 */

const AR_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Convert any Eastern Arabic / Persian digits in a string to 0-9. */
export function toWesternDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(AR_DIGITS, (d) => {
    const c = d.charCodeAt(0);
    const base = c >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(c - base);
  });
}

/** Fixed-decimal number in en-US (e.g. 9.850 for official scores). */
export function fmtNum(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

/**
 * Parse a numeric input value typed on any locale keyboard.
 * Converts Eastern Arabic/Persian digits to 0-9 and accepts ".", "," or the
 * Arabic decimal separator "٫" (U+066B) as the decimal point, so typing
 * "0.10" never collapses to "010" → 10.
 */
export function parseDecimalInput(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  const s = toWesternDigits(String(input))
    .replace(/[٫,]/g, ".")
    .replace(/[^0-9.]/g, "");
  // Keep only the first decimal point ("1.2.3" → "1.2").
  const firstDot = s.indexOf(".");
  const normalized = firstDot === -1 ? s : s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  const v = parseFloat(normalized);
  return isFinite(v) ? v : 0;
}

/** Round a score numerically to IWUF's displayed three-decimal precision. */
export function roundScore(value: number): number {
  if (!isFinite(Number(value))) return 0;
  return Number(Number(value).toFixed(3));
}

/** ISO date string YYYY-MM-DD, always Western digits. */
export function fmtDate(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(toWesternDigits(String(value)));
  if (isNaN(d.getTime())) return toWesternDigits(String(value)).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** HH:MM:SS clock time in en-GB (24h, Western digits). */
export function fmtClock(ts: number | Date): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

/** Props to spread on any <input type="date"> so it renders ISO + LTR. */
export const dateInputProps = {
  lang: "en-GB",
  dir: "ltr" as const,
  placeholder: "YYYY-MM-DD",
  pattern: "\\d{4}-\\d{2}-\\d{2}",
};
