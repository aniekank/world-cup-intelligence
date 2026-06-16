/**
 * ELO utilities. The live ELO ratings are maintained by the match simulator;
 * these helpers convert ratings into win expectancies for display and for
 * blending into the power rating.
 */

/** Expected score for A vs B (0..1), with optional home advantage in points. */
export function eloExpectation(ratingA: number, ratingB: number, homeAdvantage = 0): number {
  const dr = ratingA + homeAdvantage - ratingB;
  return 1 / (Math.pow(10, -dr / 400) + 1);
}

/** Decompose an ELO win expectancy into W/D/L using a draw-rate prior. */
export function eloOutcomeProbabilities(
  ratingA: number,
  ratingB: number,
  homeAdvantage = 60,
): { win: number; draw: number; loss: number } {
  const exp = eloExpectation(ratingA, ratingB, homeAdvantage);
  // Empirically, draw rate peaks ~28% for even games and shrinks with mismatch
  const drawRate = 0.30 * Math.exp(-Math.pow((exp - 0.5) * 3.6, 2));
  const win = exp - drawRate / 2;
  const loss = 1 - exp - drawRate / 2;
  const norm = win + drawRate + loss;
  return {
    win: round3(Math.max(0, win) / norm),
    draw: round3(drawRate / norm),
    loss: round3(Math.max(0, loss) / norm),
  };
}

/** Convert an ELO rating to an intuitive 0..100 tier score for the UI. */
export function eloToTier(elo: number, min = 1580, max = 2120): number {
  return Math.round(((elo - min) / (max - min)) * 100);
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
