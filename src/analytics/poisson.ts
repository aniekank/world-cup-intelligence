/**
 * Match outcome model — a bivariate-Poisson goals model.
 *
 * Each team's goal expectation (λ) is derived from attack vs. opposition
 * defense strength, tournament-calibrated to the seeded data, with a home-field
 * adjustment and a shared covariance term that captures the empirical positive
 * correlation between the two scores (open, end-to-end games). From the joint
 * score distribution we read off win/draw/loss, BTTS, over/under and the
 * most-likely correct scores.
 */

import type { Team, MatchPrediction } from '@/domain/types';

const MAX_GOALS = 8;
const LEAGUE_AVG_GOALS = 1.35; // per team, tournament football runs lower than club

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function poissonPmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Goal expectation for a side. Ratings are 0..100; we map the attack/defense
 * differential onto a multiplicative adjustment around the league average.
 */
export function expectedGoals(attack: Team, defense: Team, isHome: boolean): number {
  const atk = attack.attackRating / 75; // ~0.9..1.2
  const def = defense.defenseRating / 75;
  const homeMul = isHome ? 1.12 : 0.94;
  return Math.max(0.18, LEAGUE_AVG_GOALS * atk * (2 - def) * homeMul);
}

/** Bivariate-Poisson joint distribution as a (MAX+1)×(MAX+1) matrix. */
export function scoreMatrix(lambdaHome: number, lambdaAway: number, cov = 0.12): number[][] {
  // Bivariate Poisson via shared component λ3 = cov*min(λ1,λ2)
  const l3 = cov * Math.min(lambdaHome, lambdaAway);
  const l1 = Math.max(0.05, lambdaHome - l3);
  const l2 = Math.max(0.05, lambdaAway - l3);
  const matrix: number[][] = [];
  for (let x = 0; x <= MAX_GOALS; x++) {
    const row: number[] = [];
    for (let y = 0; y <= MAX_GOALS; y++) {
      let p = 0;
      const kMax = Math.min(x, y);
      for (let k = 0; k <= kMax; k++) {
        p +=
          poissonPmf(x - k, l1) *
          poissonPmf(y - k, l2) *
          poissonPmf(k, l3);
      }
      row.push(p);
    }
    matrix.push(row);
  }
  // Normalize (truncation correction)
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  return matrix.map((row) => row.map((p) => p / total));
}

export function predictMatch(home: Team, away: Team): MatchPrediction {
  const lh = expectedGoals(home, away, true);
  const la = expectedGoals(away, home, false);
  const m = scoreMatrix(lh, la);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over25 = 0;
  let homeCS = 0;
  let awayCS = 0;
  const scores: { home: number; away: number; prob: number }[] = [];

  for (let x = 0; x < m.length; x++) {
    for (let y = 0; y < m[x]!.length; y++) {
      const p = m[x]![y]!;
      if (x > y) homeWin += p;
      else if (x === y) draw += p;
      else awayWin += p;
      if (x > 0 && y > 0) btts += p;
      if (x + y > 2.5) over25 += p;
      if (y === 0) homeCS += p;
      if (x === 0) awayCS += p;
      scores.push({ home: x, away: y, prob: p });
    }
  }

  scores.sort((a, b) => b.prob - a.prob);

  return {
    matchId: '',
    homeWin: round3(homeWin),
    draw: round3(draw),
    awayWin: round3(awayWin),
    scoreline: scores.slice(0, 6).map((s) => ({ ...s, prob: round3(s.prob) })),
    expectedGoals: { home: round2(lh), away: round2(la) },
    homeCleanSheet: round3(homeCS),
    awayCleanSheet: round3(awayCS),
    bttsProb: round3(btts),
    over25Prob: round3(over25),
  };
}

/** Sample a single match scoreline (used by the Monte Carlo simulator). */
export function sampleScore(
  rngNext: () => number,
  home: Team,
  away: Team,
  neutral = false,
): { home: number; away: number } {
  const lh = expectedGoals(home, away, !neutral);
  const la = expectedGoals(away, home, false);
  return { home: samplePoisson(rngNext, lh), away: samplePoisson(rngNext, la) };
}

function samplePoisson(rngNext: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rngNext();
  } while (p > L);
  return k - 1;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
