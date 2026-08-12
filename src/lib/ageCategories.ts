// Tunisian Wushu Federation 2025-2026 age categories
export type AgeCategory =
  | "Poussins"
  | "Pupilles"
  | "Benjamins"
  | "Minimes"
  | "Cadets"
  | "Juniors"
  | "Seniors";

export function classifyAge(birthDate: string | Date | null | undefined): AgeCategory | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  if (year >= 2019) return "Poussins";
  if (year >= 2017) return "Pupilles";
  if (year >= 2015) return "Benjamins";
  if (year >= 2013) return "Minimes";
  if (year >= 2011) return "Cadets";
  if (year >= 2009) return "Juniors";
  return "Seniors";
}

export const AGE_CATEGORY_COLORS: Record<AgeCategory, string> = {
  Poussins: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Pupilles: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Benjamins: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Minimes: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Cadets: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Juniors: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Seniors: "bg-fed-red/15 text-red-300 border-fed-red/30",
};
