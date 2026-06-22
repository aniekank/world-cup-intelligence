import { describe, it, expect } from 'vitest';
import {
  lcg, poissonPmf, bivariatePoissonGrid, samplePoisson, sampleBivariatePoisson, winProbFromState,
  standardizeColumns, correlationMatrix, pca, kmeans, calibrationBins, shapleyContributions,
} from './labMath';

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

describe('lcg (seeded PRNG)', () => {
  it('is deterministic for a given seed and stays in [0,1)', () => {
    const a = lcg(123), b = lcg(123);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('diverges for different seeds', () => {
    expect(lcg(1)()).not.toBe(lcg(2)());
  });
});

describe('Poisson', () => {
  it('poissonPmf sums to ~1 over a wide support', () => {
    let s = 0;
    for (let k = 0; k < 40; k++) s += poissonPmf(k, 3.2);
    expect(s).toBeCloseTo(1, 5);
  });
  it('poissonPmf peaks near the mean', () => {
    const lambda = 4;
    let best = 0, bestK = 0;
    for (let k = 0; k < 20; k++) { const p = poissonPmf(k, lambda); if (p > best) { best = p; bestK = k; } }
    expect(bestK).toBeGreaterThanOrEqual(3);
    expect(bestK).toBeLessThanOrEqual(4);
  });
});

describe('bivariatePoissonGrid', () => {
  it('is a normalized distribution and the outcome split sums to 1', () => {
    const g = bivariatePoissonGrid(1.6, 1.1);
    expect(sum(g.grid.flat())).toBeCloseTo(1, 6);
    expect(g.homeWin + g.draw + g.awayWin).toBeCloseTo(1, 6);
  });
  it('is symmetric when both rates are equal', () => {
    const g = bivariatePoissonGrid(1.4, 1.4, 0.12);
    expect(g.homeWin).toBeCloseTo(g.awayWin, 6);
  });
  it('favours the side with the higher goal rate', () => {
    const g = bivariatePoissonGrid(2.2, 0.8);
    expect(g.homeWin).toBeGreaterThan(g.awayWin);
  });
});

describe('Monte Carlo samplers match the analytic model', () => {
  it('samplePoisson has the right mean', () => {
    const rng = lcg(7);
    const N = 40000, lambda = 2.5;
    let total = 0;
    for (let i = 0; i < N; i++) total += samplePoisson(rng, lambda);
    expect(total / N).toBeCloseTo(lambda, 1);
  });
  it('sampleBivariatePoisson W/D/L converges to the grid (law of large numbers)', () => {
    const lh = 1.7, la = 1.0;
    const truth = bivariatePoissonGrid(lh, la);
    const rng = lcg(99);
    const N = 40000;
    let h = 0, d = 0, a = 0;
    for (let i = 0; i < N; i++) {
      const r = sampleBivariatePoisson(rng, lh, la);
      if (r.home > r.away) h++; else if (r.home === r.away) d++; else a++;
    }
    expect(h / N).toBeCloseTo(truth.homeWin, 1);
    expect(d / N).toBeCloseTo(truth.draw, 1);
    expect(a / N).toBeCloseTo(truth.awayWin, 1);
  });
});

describe('winProbFromState', () => {
  it('sums to 1', () => {
    const w = winProbFromState(1, 0, 0.8, 0.9);
    expect(w.home + w.draw + w.away).toBeCloseTo(1, 6);
  });
  it('a two-goal lead with almost no time left is nearly certain', () => {
    const w = winProbFromState(2, 0, 0.001, 0.001);
    expect(w.home).toBeGreaterThan(0.95);
  });
  it('0-0 with equal rates is symmetric', () => {
    const w = winProbFromState(0, 0, 1.2, 1.2);
    expect(w.home).toBeCloseTo(w.away, 6);
  });
});

describe('standardizeColumns', () => {
  it('produces zero-mean, unit-variance columns', () => {
    const rows = [[1, 10], [2, 20], [3, 30], [4, 40]];
    const { z } = standardizeColumns(rows);
    for (let j = 0; j < 2; j++) {
      const col = z.map((r) => r[j]!);
      expect(sum(col) / col.length).toBeCloseTo(0, 6);
      const variance = sum(col.map((x) => x * x)) / col.length;
      expect(variance).toBeCloseTo(1, 6);
    }
  });
});

describe('correlationMatrix', () => {
  const rows = [[1, 2, 5], [2, 4, 4], [3, 6, 3], [4, 8, 2], [5, 10, 1]];
  const C = correlationMatrix(rows);
  it('has a unit diagonal and is symmetric', () => {
    for (let i = 0; i < 3; i++) expect(C[i]![i]!).toBeCloseTo(1, 6);
    expect(C[0]![1]!).toBeCloseTo(C[1]![0]!, 6);
  });
  it('detects perfect positive and negative correlation', () => {
    expect(C[0]![1]!).toBeCloseTo(1, 6);   // col1 = 2*col0
    expect(C[0]![2]!).toBeCloseTo(-1, 6);  // col2 decreases linearly
  });
  it('keeps every value in [-1, 1]', () => {
    for (const row of C) for (const r of row) { expect(r).toBeGreaterThanOrEqual(-1.0001); expect(r).toBeLessThanOrEqual(1.0001); }
  });
});

describe('pca', () => {
  it('explained variance is in [0,1] and ordered, components are unit-norm', () => {
    const rows = Array.from({ length: 30 }, (_, i) => [i, i * 2 + (i % 3), -i + (i % 5), i % 7]);
    const { z } = standardizeColumns(rows);
    const { coords, components, explained } = pca(z, 2);
    expect(coords).toHaveLength(30);
    expect(explained[0]!).toBeGreaterThanOrEqual(explained[1]!);
    for (const e of explained) { expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1.0001); }
    for (const pc of components) expect(Math.sqrt(sum(pc.map((x) => x * x)))).toBeCloseTo(1, 4);
  });
});

describe('kmeans', () => {
  // two well-separated blobs
  const blob = (cx: number, cy: number, n: number, seed: number) => {
    const r = lcg(seed);
    return Array.from({ length: n }, () => [cx + (r() - 0.5), cy + (r() - 0.5)]);
  };
  const pts = [...blob(0, 0, 20, 1), ...blob(10, 10, 20, 2)];
  it('is deterministic for a fixed seed', () => {
    expect(kmeans(pts, 2, 50, 42).assignments).toEqual(kmeans(pts, 2, 50, 42).assignments);
  });
  it('separates two well-separated clusters', () => {
    const { assignments } = kmeans(pts, 2, 50, 42);
    const first = new Set(assignments.slice(0, 20));
    const second = new Set(assignments.slice(20));
    expect(first.size).toBe(1);
    expect(second.size).toBe(1);
    expect([...first][0]).not.toBe([...second][0]);
  });
});

describe('calibrationBins', () => {
  it('satisfies the Murphy decomposition Brier = reliability - resolution + uncertainty', () => {
    const rng = lcg(5);
    const pairs = Array.from({ length: 500 }, () => {
      const p = rng();
      return { p, y: rng() < p ? 1 : 0 }; // perfectly calibrated by construction
    });
    const c = calibrationBins(pairs, 10);
    expect(c.brier).toBeCloseTo(c.reliability - c.resolution + c.uncertainty, 6);
    expect(c.reliability).toBeLessThan(0.02); // well-calibrated → tiny reliability term
  });
});

describe('shapleyContributions', () => {
  it('contributions sum to v(all) - v(none)', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const v = (S: Set<string>) => [...S].reduce((s, k) => s + (k.charCodeAt(0)), 0); // additive
    const phi = shapleyContributions(keys, v);
    const total = sum(Object.values(phi));
    expect(total).toBeCloseTo(v(new Set(keys)) - v(new Set()), 6);
  });
  it('gives symmetric factors equal credit', () => {
    const keys = ['x', 'y', 'z'];
    const v = (S: Set<string>) => S.size; // every factor identical & additive
    const phi = shapleyContributions(keys, v);
    expect(phi.x).toBeCloseTo(1, 6);
    expect(phi.x).toBeCloseTo(phi.y!, 6);
    expect(phi.y).toBeCloseTo(phi.z!, 6);
  });
});
