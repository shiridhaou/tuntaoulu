/**
 * IWUF-style final score calculation.
 * Final = A (quality, after deductions) + trimmed B average (performance) + C (difficulty)
 * B trimming: when 3+ active scores, drop highest and lowest, average the rest.
 */

export interface FinalScoreInput {
  scoreA: number | null;
  scoresB: number[];      // only ACTIVE judges' scores
  scoreC: number | null;
  extraDeductions?: number; // chief-applied deductions (e.g., AHJ)
}

export interface FinalScoreResult {
  scoreA: number;
  scoreBAvg: number;
  scoreC: number;
  deductions: number;
  finalScore: number;
}

export function computeFinalScore(input: FinalScoreInput): FinalScoreResult {
  const a = input.scoreA ?? 0;
  const c = input.scoreC ?? 0;
  let bs = [...input.scoresB].filter((v) => typeof v === "number" && !Number.isNaN(v));
  // Trim high+low only when 5+ active B judges. For 1–4 judges → simple mean.
  if (bs.length >= 5) {
    bs.sort((x, y) => x - y);
    bs = bs.slice(1, -1);
  }
  const bAvg = bs.length === 0 ? 0 : bs.reduce((s, v) => s + v, 0) / bs.length;
  const ded = input.extraDeductions ?? 0;
  const final = Math.max(0, a + bAvg + c - ded);
  return {
    scoreA: round3(a),
    scoreBAvg: round3(bAvg),
    scoreC: round3(c),
    deductions: round3(ded),
    finalScore: round3(final),
  };
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
