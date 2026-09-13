/**
 * Athlete affiliation helpers.
 * National events are identified by club, international events by country
 * (rendered with a flag emoji). Purely presentational — no scoring impact.
 */

const COUNTRY_CODES: Record<string, string> = {
  tunisia: "TN", tunisie: "TN", "تونس": "TN",
  algeria: "DZ", algerie: "DZ", "الجزائر": "DZ",
  morocco: "MA", maroc: "MA", "المغرب": "MA",
  libya: "LY", "ليبيا": "LY",
  egypt: "EG", "مصر": "EG",
  france: "FR", "فرنسا": "FR",
  italy: "IT", italie: "IT", "إيطاليا": "IT",
  spain: "ES", espagne: "ES", "إسبانيا": "ES",
  germany: "DE", allemagne: "DE", "ألمانيا": "DE",
  china: "CN", chine: "CN", "الصين": "CN",
  turkey: "TR", turkiye: "TR", "تركيا": "TR",
  qatar: "QA", "قطر": "QA",
  "saudi arabia": "SA", "السعودية": "SA",
  "united arab emirates": "AE", uae: "AE", "الإمارات": "AE",
  kuwait: "KW", "الكويت": "KW",
  jordan: "JO", "الأردن": "JO",
  lebanon: "LB", "لبنان": "LB",
  iran: "IR", "إيران": "IR",
  usa: "US", "united states": "US", "أمريكا": "US",
};

/** ISO-2 code for a free-text country name (falls back to the first 2 letters). */
export function countryCode(country?: string | null): string | null {
  const raw = (country ?? "").trim();
  if (!raw) return null;
  const hit = COUNTRY_CODES[raw.toLowerCase()];
  if (hit) return hit;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const letters = raw.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 ? letters.slice(0, 3).toUpperCase() : null;
}

/** Flag emoji from a country name, when the ISO-2 code is resolvable. */
export function countryFlag(country?: string | null): string {
  const code = countryCode(country);
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

/**
 * Single-line affiliation label: "🇹🇳 Tunisia · Club de Carthage".
 * Missing parts are dropped, never rendered as empty separators.
 */
export function affiliationLabel(club?: string | null, country?: string | null): string {
  const flag = countryFlag(country);
  const parts: string[] = [];
  const c = (country ?? "").trim();
  if (c) parts.push(flag ? `${flag} ${c}` : c);
  const k = (club ?? "").trim();
  if (k) parts.push(k);
  return parts.join(" · ");
}
