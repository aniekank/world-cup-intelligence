/**
 * labMath — small, dependency-free numerical kernels powering the Model Lab.
 *
 * Everything here is pure (no I/O, no globals) so it runs identically on the
 * server (data prep) and in the browser (live re-compute when the user drags a
 * control). Implemented from first principles on purpose — the point of the Lab
 * is to *show the math*, not import a black box:
 *
 *   • bivariatePoissonGrid — the joint scoreline distribution behind every prediction
 *   • pca                  — covariance + power-iteration eigendecomposition → 2D
 *   • kmeans               — k-means++ seeded, deterministic, Lloyd's iterations
 *   • calibrationBins      — reliability-diagram binning + Brier decomposition
 *   • shapleyContributions — exact Shapley values over a small factor set
 */

// ── deterministic PRNG (so SSR and client agree, and runs are reproducible) ──
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, d = 3) => { const f = 10 ** d; return Math.round(x * f) / f; };

// ────────────────────────────────────────────────────────────────────────────
// Bivariate Poisson — the generative model under the predictions
// ────────────────────────────────────────────────────────────────────────────

function factorial(n: number): number { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
export function poissonPmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export interface ScoreGrid {
  grid: number[][];          // grid[h][a] = P(home scores h, away scores a)
  homeWin: number;
  draw: number;
  awayWin: number;
  btts: number;              // both teams to score
  over25: number;            // total goals > 2.5
  topScores: { home: number; away: number; prob: number }[];
  lambdaHome: number;
  lambdaAway: number;
}

/**
 * Joint scoreline distribution for a bivariate Poisson with a shared component
 * λ3 = cov·min(λ1,λ2) that captures the positive correlation between the two
 * scores (open, end-to-end games). Returns the normalized grid plus the
 * aggregates the UI reads off it.
 */
export function bivariatePoissonGrid(lambdaHome: number, lambdaAway: number, cov = 0.12, maxGoals = 8): ScoreGrid {
  const l3 = cov * Math.min(lambdaHome, lambdaAway);
  const l1 = Math.max(0.05, lambdaHome - l3);
  const l2 = Math.max(0.05, lambdaAway - l3);
  const grid: number[][] = [];
  for (let x = 0; x <= maxGoals; x++) {
    const row: number[] = [];
    for (let y = 0; y <= maxGoals; y++) {
      let p = 0;
      const kMax = Math.min(x, y);
      for (let k = 0; k <= kMax; k++) p += poissonPmf(x - k, l1) * poissonPmf(y - k, l2) * poissonPmf(k, l3);
      row.push(p);
    }
    grid.push(row);
  }
  const total = grid.flat().reduce((a, b) => a + b, 0) || 1;
  for (const row of grid) for (let j = 0; j < row.length; j++) row[j]! /= total;

  let homeWin = 0, draw = 0, awayWin = 0, btts = 0, over25 = 0;
  const flat: { home: number; away: number; prob: number }[] = [];
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const p = grid[x]![y]!;
      if (x > y) homeWin += p; else if (x === y) draw += p; else awayWin += p;
      if (x > 0 && y > 0) btts += p;
      if (x + y > 2.5) over25 += p;
      flat.push({ home: x, away: y, prob: p });
    }
  }
  flat.sort((a, b) => b.prob - a.prob);
  return { grid, homeWin, draw, awayWin, btts, over25, topScores: flat.slice(0, 5), lambdaHome, lambdaAway };
}

/** Sample a Poisson(λ) via Knuth's algorithm using the supplied uniform RNG. */
export function samplePoisson(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** Draw one scoreline from the bivariate Poisson: X=U1+U3, Y=U2+U3. */
export function sampleBivariatePoisson(rng: () => number, lambdaHome: number, lambdaAway: number, cov = 0.12): { home: number; away: number } {
  const l3 = cov * Math.min(lambdaHome, lambdaAway);
  const u3 = samplePoisson(rng, l3);
  return { home: samplePoisson(rng, Math.max(0.05, lambdaHome - l3)) + u3, away: samplePoisson(rng, Math.max(0.05, lambdaAway - l3)) + u3 };
}

/** Win/draw/loss probabilities for the REMAINING match: current score + bivariate-Poisson tail. */
export function winProbFromState(scoreHome: number, scoreAway: number, lambdaHome: number, lambdaAway: number, cov = 0.12): { home: number; draw: number; away: number } {
  const g = bivariatePoissonGrid(lambdaHome, lambdaAway, cov, 8);
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = g.grid[i]![j]!;
    const fh = scoreHome + i, fa = scoreAway + j;
    if (fh > fa) home += p; else if (fh === fa) draw += p; else away += p;
  }
  return { home, draw, away };
}

// ────────────────────────────────────────────────────────────────────────────
// Standardization + PCA (covariance → power-iteration eigendecomposition)
// ────────────────────────────────────────────────────────────────────────────

export function standardizeColumns(rows: number[][]): { z: number[][]; means: number[]; stds: number[] } {
  const n = rows.length, d = rows[0]?.length ?? 0;
  const means = Array(d).fill(0), stds = Array(d).fill(0);
  for (const r of rows) for (let j = 0; j < d; j++) means[j] += r[j]! / n;
  for (const r of rows) for (let j = 0; j < d; j++) stds[j] += (r[j]! - means[j]) ** 2 / n;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j]) || 1;
  const z = rows.map((r) => r.map((v, j) => (v - means[j]!) / stds[j]!));
  return { z, means, stds };
}

/** Pearson correlation matrix (d×d) of the columns of `rows`. */
export function correlationMatrix(rows: number[][]): number[][] {
  // standardizeColumns divides by n (population), so (1/n)·ZᵀZ is exactly the
  // Pearson correlation — diagonal 1, off-diagonals in [-1,1]. (Not covariance(),
  // which uses n-1 and would inflate the diagonal to n/(n-1).)
  const { z } = standardizeColumns(rows);
  const n = z.length, d = z[0]?.length ?? 0;
  const C = Array.from({ length: d }, () => Array(d).fill(0));
  for (const r of z) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i]![j]! += (r[i]! * r[j]!) / (n || 1);
  return C;
}

function covariance(z: number[][]): number[][] {
  const n = z.length, d = z[0]?.length ?? 0;
  const C = Array.from({ length: d }, () => Array(d).fill(0));
  for (const r of z) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i]![j]! += (r[i]! * r[j]!) / (n - 1 || 1);
  return C;
}

function matVec(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((s, m, j) => s + m * v[j]!, 0));
}
function norm(v: number[]): number { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)); }

/** Dominant eigenpair via power iteration. */
function powerIteration(M: number[][], iters = 300, seed = 7): { vec: number[]; val: number } {
  const d = M.length;
  const rnd = lcg(seed);
  let v = Array.from({ length: d }, () => rnd() - 0.5);
  let nv = norm(v) || 1; v = v.map((x) => x / nv);
  let val = 0;
  for (let it = 0; it < iters; it++) {
    const Mv = matVec(M, v);
    nv = norm(Mv) || 1;
    const next = Mv.map((x) => x / nv);
    val = matVec(M, next).reduce((s, x, j) => s + x * next[j]!, 0); // Rayleigh quotient
    v = next;
  }
  return { vec: v, val };
}

function deflate(M: number[][], vec: number[], val: number): number[][] {
  return M.map((row, i) => row.map((m, j) => m - val * vec[i]! * vec[j]!));
}

export interface PcaResult {
  coords: number[][];        // n×2 projected points
  components: number[][];     // 2×d loading vectors (PC1, PC2)
  explained: number[];        // explained-variance ratio for PC1, PC2
}

/** PCA via covariance + power iteration with deflation. Expects standardized rows. */
export function pca(z: number[][], dims = 2): PcaResult {
  const C = covariance(z);
  const totalVar = C.reduce((s, row, i) => s + row[i]!, 0) || 1;
  let M = C;
  const components: number[][] = [];
  const explained: number[] = [];
  for (let k = 0; k < dims; k++) {
    const { vec, val } = powerIteration(M, 300, 7 + k);
    components.push(vec);
    explained.push(Math.max(0, val) / totalVar);
    M = deflate(M, vec, val);
  }
  const coords = z.map((r) => components.map((pc) => pc.reduce((s, c, j) => s + c * r[j]!, 0)));
  return { coords, components, explained };
}

// ────────────────────────────────────────────────────────────────────────────
// k-means (k-means++ seeding, Lloyd's iterations) — deterministic
// ────────────────────────────────────────────────────────────────────────────

function dist2(a: number[], b: number[]): number { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2; return s; }

export interface KmeansResult { assignments: number[]; centroids: number[][]; inertia: number }

export function kmeans(points: number[][], k: number, iters = 50, seed = 42): KmeansResult {
  const n = points.length;
  if (n === 0) return { assignments: [], centroids: [], inertia: 0 };
  k = Math.min(k, n);
  const rnd = lcg(seed);
  // k-means++ seeding
  const centroids: number[][] = [points[Math.floor(rnd() * n)]!.slice()];
  while (centroids.length < k) {
    const d2 = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const sum = d2.reduce((a, b) => a + b, 0) || 1;
    let r = rnd() * sum, idx = 0;
    for (let i = 0; i < n; i++) { r -= d2[i]!; if (r <= 0) { idx = i; break; } }
    centroids.push(points[idx]!.slice());
  }
  const assignments = Array(n).fill(0);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) { const d = dist2(points[i]!, centroids[c]!); if (d < bestD) { bestD = d; best = c; } }
      if (assignments[i] !== best) { assignments[i] = best; moved = true; }
    }
    const sums = centroids.map(() => Array(points[0]!.length).fill(0));
    const counts = Array(centroids.length).fill(0);
    for (let i = 0; i < n; i++) { const c = assignments[i]!; counts[c]++; for (let j = 0; j < points[i]!.length; j++) sums[c]![j]! += points[i]![j]!; }
    for (let c = 0; c < centroids.length; c++) if (counts[c] > 0) centroids[c] = sums[c]!.map((s) => s / counts[c]!);
    if (!moved && it > 0) break;
  }
  let inertia = 0;
  for (let i = 0; i < n; i++) inertia += dist2(points[i]!, centroids[assignments[i]!]!);
  return { assignments, centroids, inertia };
}

// ────────────────────────────────────────────────────────────────────────────
// Calibration — reliability-diagram binning + Brier decomposition
// ────────────────────────────────────────────────────────────────────────────

export interface CalBin { lo: number; hi: number; predMean: number; obsFreq: number; count: number }
export interface Calibration {
  bins: CalBin[];
  reliability: number;   // lower is better (calibration error, weighted MSE of bins)
  resolution: number;    // higher is better (how far bins move from the base rate)
  uncertainty: number;   // base-rate variance (irreducible)
  brier: number;         // = reliability - resolution + uncertainty
  base: number;          // overall observed frequency
  n: number;
}

/**
 * Murphy's Brier decomposition over `nBins` equal-width bins of predicted
 * probability. pairs = (predicted prob p, binary outcome y ∈ {0,1}).
 */
export function calibrationBins(pairs: { p: number; y: number }[], nBins = 10): Calibration {
  const n = pairs.length;
  const base = n ? pairs.reduce((s, x) => s + x.y, 0) / n : 0;
  const bins: CalBin[] = [];
  let reliability = 0, resolution = 0;
  for (let b = 0; b < nBins; b++) {
    const lo = b / nBins, hi = (b + 1) / nBins;
    const inBin = pairs.filter((x) => (b === nBins - 1 ? x.p >= lo && x.p <= hi : x.p >= lo && x.p < hi));
    const count = inBin.length;
    const predMean = count ? inBin.reduce((s, x) => s + x.p, 0) / count : (lo + hi) / 2;
    const obsFreq = count ? inBin.reduce((s, x) => s + x.y, 0) / count : 0;
    if (count) {
      reliability += (count / n) * (predMean - obsFreq) ** 2;
      resolution += (count / n) * (obsFreq - base) ** 2;
    }
    bins.push({ lo, hi, predMean, obsFreq, count });
  }
  const uncertainty = base * (1 - base);
  return { bins, reliability, resolution, uncertainty, brier: reliability - resolution + uncertainty, base, n };
}

// ────────────────────────────────────────────────────────────────────────────
// Shapley contributions — exact, over a small set of model "factors"
// ────────────────────────────────────────────────────────────────────────────

/**
 * Exact Shapley values for `factors`, given a value function v(activeSet) → number.
 * Averages each factor's marginal contribution over every ordering (all subsets),
 * so it's order-independent. Use for ≤ ~6 factors (2^n subsets). The contributions
 * sum to v(all) − v(none).
 */
export function shapleyContributions(factorKeys: string[], v: (active: Set<string>) => number): Record<string, number> {
  const m = factorKeys.length;
  const out: Record<string, number> = {};
  const fact = (k: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
  const weight = (s: number) => (fact(s) * fact(m - s - 1)) / fact(m); // |S|!(m-|S|-1)!/m!
  for (const f of factorKeys) {
    const others = factorKeys.filter((k) => k !== f);
    let phi = 0;
    for (let mask = 0; mask < (1 << others.length); mask++) {
      const S = new Set<string>();
      for (let i = 0; i < others.length; i++) if (mask & (1 << i)) S.add(others[i]!);
      const withF = new Set(S); withF.add(f);
      phi += weight(S.size) * (v(withF) - v(S));
    }
    out[f] = phi;
  }
  return out;
}
