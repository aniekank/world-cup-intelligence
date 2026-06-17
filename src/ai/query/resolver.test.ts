import { describe, it, expect, beforeAll } from 'vitest';
import { generateDataset } from '@/data/generate';
import { setDataset, getPlayerViews, getTeams } from '@/data/store';
import { rankPlayers, rankTeams, extractPlayers, extractTeam, normalize } from './resolver';

beforeAll(() => setDataset(generateDataset(), 'simulation', 'simulation'));

const surnameTokens = (name: string) => normalize(name).split(' ');
const oneCharTypo = (s: string) => (s.length >= 6 ? s.slice(0, -2) + s.slice(-1) : s);

/**
 * Identifying forms — carry enough info (first AND last) to pin the exact player.
 * These must resolve the specific player in the top results.
 */
function identifyingVariants(name: string): string[] {
  const t = normalize(name).split(' ').filter(Boolean);
  const first = t[0] ?? '';
  const last = t[t.length - 1] ?? '';
  return Array.from(
    new Set([
      normalize(name), // full, folded
      name.toLowerCase(), // full, with accents
      `${last} ${first}`, // flipped order
      `${first[0]} ${last}`, // "F. Last" abbreviated (how the live feed stores names)
    ]),
  ).filter((s) => s.trim().split(' ').filter(Boolean).length >= 2);
}

/**
 * Ambiguous forms — a surname / prefix / typo can legitimately resolve a
 * *different* same-name player. Success = the query resolves to SOME player who
 * genuinely carries that surname token, not the exact one we happened to sample.
 */
function ambiguousVariants(name: string): { q: string; target: string }[] {
  const last = surnameTokens(name).slice(-1)[0] ?? '';
  if (last.length < 4) return [];
  return [
    { q: last, target: last }, // surname only
    { q: last.slice(0, 4), target: last }, // surname prefix
    { q: oneCharTypo(last), target: last }, // surname with a one-char typo
  ];
}

describe('resolver — search-box coverage over the full roster', () => {
  it('resolves the exact player from identifying name forms (top-5)', () => {
    const players = getPlayerViews();
    let pass = 0;
    let fail = 0;
    const misses: string[] = [];
    for (const p of players) {
      for (const q of identifyingVariants(p.name)) {
        if (rankPlayers(q, 5).some((h) => h.id === p.id)) pass++;
        else {
          fail++;
          if (misses.length < 25) misses.push(`"${q}" ⇏ ${p.name}`);
        }
      }
    }
    const cov = pass / (pass + fail);
    // eslint-disable-next-line no-console
    console.log(`identifying coverage: ${(cov * 100).toFixed(1)}% (${pass}/${pass + fail})`, misses.length ? { misses } : '');
    expect(cov).toBeGreaterThan(0.98);
  });

  it('ambiguous forms (surname / prefix / typo) resolve a genuine same-name match', () => {
    const players = getPlayerViews();
    let pass = 0;
    let fail = 0;
    const misses: string[] = [];
    for (const p of players) {
      for (const { q, target } of ambiguousVariants(p.name)) {
        const hits = rankPlayers(q, 10);
        const ok = hits.some((h) =>
          surnameTokens(h.name).some((tok) => tok === target || tok.startsWith(q) || tok.includes(q)),
        );
        if (ok) pass++;
        else {
          fail++;
          if (misses.length < 25) misses.push(`"${q}" (→${target})`);
        }
      }
    }
    const cov = pass / (pass + fail);
    // eslint-disable-next-line no-console
    console.log(`ambiguous coverage: ${(cov * 100).toFixed(1)}% (${pass}/${pass + fail})`, misses.length ? { misses } : '');
    expect(cov).toBeGreaterThan(0.97);
  });

  it('finds teams by name / code / partial (top-3)', () => {
    let pass = 0;
    let fail = 0;
    for (const t of getTeams()) {
      const variants = [normalize(t.name), t.name.toLowerCase(), t.code.toLowerCase(), normalize(t.name).slice(0, 4)];
      for (const q of variants) if (rankTeams(q, 3).some((h) => h.id === t.id)) pass++; else fail++;
    }
    const cov = pass / (pass + fail);
    // eslint-disable-next-line no-console
    console.log(`team coverage: ${(cov * 100).toFixed(1)}% (${pass}/${pass + fail})`);
    expect(cov).toBeGreaterThan(0.98);
  });

  it('country aliases resolve (USA / Holland / Korea)', () => {
    // Only assert when the alias's real country is actually in this dataset.
    const byName = (n: string) => getTeams().find((t) => normalize(t.name) === n);
    for (const [alias, name] of [
      ['usa', 'united states'],
      ['holland', 'netherlands'],
      ['korea', 'south korea'],
    ] as const) {
      const team = byName(name);
      if (team) expect(rankTeams(alias, 3).some((t) => t.id === team.id)).toBe(true);
    }
  });

  it('"First Last" ranks the exact player first', () => {
    const p = getPlayerViews().find((x) => x.stats.minutes > 0) ?? getPlayerViews()[0]!;
    const t = normalize(p.name).split(' ');
    expect(rankPlayers(`${t[0]} ${t[t.length - 1]}`, 1)[0]?.id).toBe(p.id);
  });
});

describe('resolver — NLQ mention extraction inside sentences', () => {
  it('pulls a team out of a question', () => {
    const t = getTeams()[0]!;
    expect(extractTeam(`what is ${t.name}'s easiest path to the final`)?.id).toBe(t.id);
  });

  it('pulls both players out of a comparison by surname', () => {
    const a = surnameTokens(getPlayerViews()[0]!.name).slice(-1)[0]!;
    const b = surnameTokens(getPlayerViews().find((p) => !surnameTokens(p.name).includes(a))!.name).slice(-1)[0]!;
    const found = extractPlayers(`compare ${a} and ${b}`, 8);
    expect(found.some((p) => surnameTokens(p.name).includes(a))).toBe(true);
    expect(found.some((p) => surnameTokens(p.name).includes(b))).toBe(true);
  });

  it('does not hallucinate entities from ordinary words', () => {
    expect(extractPlayers('who has the highest expected goals this tournament', 4)).toHaveLength(0);
    expect(extractTeam('show me the strongest defense in the tournament')).toBeNull();
  });
});
