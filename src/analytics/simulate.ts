/**
 * Monte Carlo tournament simulator.
 *
 * From the current tournament state (finished results locked in, live matches
 * extrapolated, scheduled matches open) we simulate the remainder of the
 * competition thousands of times. Each run:
 *   1. completes the group stage by sampling remaining fixtures (Poisson),
 *   2. resolves final group tables and the 8 best third-placed teams,
 *   3. seeds the 32 qualifiers into a single-elimination bracket,
 *   4. plays out R32 → Final via ELO win expectancy.
 * Aggregating across runs yields qualification, group-win, stage-reach, title
 * and expected-finish probabilities for every team.
 */

import { Rng } from '@/data/prng';
import { eloExpectation } from './elo';
import type { Match, Team, Group, TeamForecast } from '@/domain/types';

// 8,000 Monte Carlo runs — forecast probabilities stable to a few tenths of a
// percent across the meaningful range. The run count is NOT a latency lever: a
// full engine rebuild at 8,000 is ~0.5s (measured; 3,000 vs 8,000 is ~80ms), and
// it only fires on a match STATUS flip, not routine score ticks (store.setDataset).
// (The historical "13-18s renders / 502s" were the live DATA fetch on the request
// path, not the sim — the earlier drop to 3,000 was treating the wrong cause.)
export const RUNS = 8000;

interface GroupState {
  groupId: string;
  teamIds: string[];
  base: Map<string, { pts: number; gf: number; ga: number }>;
  remaining: { home: string; away: string; liveHome: number; liveAway: number; remainShare: number }[];
}

interface Tally {
  qualify: number; // reached R32
  groupWin: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  title: number;
  finishSum: number; // for expected finishing position
}

function emptyTally(): Tally {
  return { qualify: 0, groupWin: 0, r16: 0, qf: 0, sf: 0, final: 0, title: 0, finishSum: 0 };
}

export interface SimulationOutput {
  forecasts: Map<string, TeamForecast>;
  runs: number;
}

function buildGroupStates(groups: Group[], matches: Match[]): GroupState[] {
  return groups.map((g) => {
    const base = new Map<string, { pts: number; gf: number; ga: number }>();
    g.teamIds.forEach((id) => base.set(id, { pts: 0, gf: 0, ga: 0 }));
    const remaining: GroupState['remaining'] = [];
    for (const m of matches.filter((mm) => mm.groupId === g.id)) {
      if (m.status === 'FINISHED') {
        const h = base.get(m.homeTeamId);
        const a = base.get(m.awayTeamId);
        if (!h || !a) continue; // a team isn't in this group's base — skip rather than crash
        h.gf += m.homeScore; h.ga += m.awayScore;
        a.gf += m.awayScore; a.ga += m.homeScore;
        if (m.homeScore > m.awayScore) h.pts += 3;
        else if (m.homeScore < m.awayScore) a.pts += 3;
        else { h.pts++; a.pts++; }
      } else {
        const live = m.status === 'LIVE' || m.status === 'HALFTIME';
        remaining.push({
          home: m.homeTeamId,
          away: m.awayTeamId,
          liveHome: live ? m.homeScore : 0,
          liveAway: live ? m.awayScore : 0,
          remainShare: live ? Math.max(0.1, (90 - m.minute) / 90) : 1,
        });
      }
    }
    return { groupId: g.id, teamIds: g.teamIds, base, remaining };
  });
}

function samplePoisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng.next(); } while (p > L);
  return k - 1;
}

const LEAGUE_AVG = 1.35;
function lambdaFor(attacker: Team, defender: Team, isHome: boolean): number {
  const atk = attacker.attackRating / 75;
  const def = defender.defenseRating / 75;
  return Math.max(0.18, LEAGUE_AVG * atk * (2 - def) * (isHome ? 1.12 : 0.94));
}

/** Standard seeding order: returns seed numbers (1..n) in bracket-slot order. */
function seedOrder(n: number): number[] {
  let rounds = [1, 2];
  while (rounds.length < n) {
    const next: number[] = [];
    const sum = rounds.length * 2 + 1;
    for (const s of rounds) {
      next.push(s);
      next.push(sum - s);
    }
    rounds = next;
  }
  return rounds;
}

function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}
function nextPow2(n: number): number {
  return 1 << Math.ceil(Math.log2(n));
}
/** Knockout bracket size for the format: top-2-per-group + best thirds to a power of 2. */
function bracketSizeFor(numGroups: number): number {
  const base = numGroups * 2;
  if (isPow2(base)) return base; // 8 groups → 16, 16 groups → 32
  const n = nextPow2(base); // 12 groups → 24 → 32
  return n - base <= numGroups ? n : (1 << Math.floor(Math.log2(base)));
}

// Alive-set size → the forecast round it represents.
const SIZE_FIELD: Record<number, keyof Tally> = { 16: 'r16', 8: 'qf', 4: 'sf', 2: 'final', 1: 'title' };

export function runSimulation(teamsArr: Team[], groups: Group[], matches: Match[]): SimulationOutput {
  const teams = new Map(teamsArr.map((t) => [t.id, t]));
  const groupStates = buildGroupStates(groups, matches);
  const tallies = new Map<string, Tally>();
  teamsArr.forEach((t) => tallies.set(t.id, emptyTally()));

  const numGroups = groups.length;
  const bracketSize = Math.max(2, bracketSizeFor(numGroups));
  const thirdsNeeded = Math.max(0, bracketSize - numGroups * 2);
  const seedOrderArr = seedOrder(bracketSize);
  const rng = new Rng(424242);

  for (let run = 0; run < RUNS; run++) {
    // 1 & 2: complete groups → ranked tables
    const groupRanked: { teamId: string; rank: number; pts: number; gd: number; gf: number }[][] = [];
    const thirds: { teamId: string; pts: number; gd: number; gf: number; elo: number }[] = [];

    for (const gs of groupStates) {
      const tbl = new Map(
        gs.teamIds.map((id) => {
          const b = gs.base.get(id)!;
          return [id, { pts: b.pts, gf: b.gf, ga: b.ga }];
        }),
      );
      for (const fx of gs.remaining) {
        const home = teams.get(fx.home)!;
        const away = teams.get(fx.away)!;
        const hg = fx.liveHome + samplePoisson(rng, lambdaFor(home, away, true) * fx.remainShare);
        const ag = fx.liveAway + samplePoisson(rng, lambdaFor(away, home, false) * fx.remainShare);
        const h = tbl.get(fx.home)!;
        const a = tbl.get(fx.away)!;
        h.gf += hg; h.ga += ag;
        a.gf += ag; a.ga += hg;
        if (hg > ag) h.pts += 3;
        else if (hg < ag) a.pts += 3;
        else { h.pts++; a.pts++; }
      }
      const ranked = [...tbl.entries()]
        .map(([teamId, v]) => ({ teamId, pts: v.pts, gd: v.gf - v.ga, gf: v.gf, elo: teams.get(teamId)!.elo }))
        .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.elo - x.elo)
        .map((r, i) => ({ ...r, rank: i + 1 }));
      groupRanked.push(ranked);
      tallies.get(ranked[0]!.teamId)!.groupWin++;
      if (ranked[2]) thirds.push({ ...ranked[2] });
    }

    // Best thirds needed to fill the bracket (0 when 2×groups is already a power of 2)
    const bestThirdSet = new Set(
      thirds
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.elo - a.elo)
        .slice(0, thirdsNeeded)
        .map((t) => t.teamId),
    );

    // Qualifiers with a seed score (lower = stronger)
    const qualifiers: { teamId: string; seedScore: number }[] = [];
    groupRanked.forEach((g) => {
      const w = g[0];
      const r = g[1];
      if (w) qualifiers.push({ teamId: w.teamId, seedScore: 0 - w.pts * 100 - w.gd * 10 - teams.get(w.teamId)!.elo / 100 });
      if (r) qualifiers.push({ teamId: r.teamId, seedScore: 1000 - r.pts * 100 - r.gd * 10 - teams.get(r.teamId)!.elo / 100 });
    });
    thirds.forEach((t) => {
      if (bestThirdSet.has(t.teamId)) {
        qualifiers.push({ teamId: t.teamId, seedScore: 2000 - t.pts * 100 - t.gd * 10 - teams.get(t.teamId)!.elo / 100 });
      }
    });

    // Made the knockout bracket
    qualifiers.forEach((q) => (tallies.get(q.teamId)!.qualify++));

    // Seed into bracket slots (size adapts to the format)
    const bySeed = qualifiers.sort((a, b) => a.seedScore - b.seedScore);
    let alive: string[] = seedOrderArr.map((seedNo) => bySeed[seedNo - 1]?.teamId ?? '');

    // Mark everyone present at each round size (incl. the initial bracket)
    const markSize = (set: string[]) => {
      const field = SIZE_FIELD[set.length];
      if (field) set.forEach((id) => { if (id) tallies.get(id)![field]++; });
    };
    markSize(alive);

    // Single elimination — byes (empty slots) auto-advance the present side
    while (alive.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        const aId = alive[i] ?? '';
        const bId = alive[i + 1] ?? '';
        let winner: string;
        if (!aId) winner = bId;
        else if (!bId) winner = aId;
        else winner = rng.next() < eloExpectation(teams.get(aId)!.elo, teams.get(bId)!.elo, 0) ? aId : bId;
        next.push(winner);
      }
      alive = next;
      markSize(alive);
    }
  }

  // Aggregate → forecasts
  const forecasts = new Map<string, TeamForecast>();
  // First pass: power rating proxy from reach probabilities + elo for ranking
  const scored: { teamId: string; score: number }[] = [];
  teamsArr.forEach((t) => {
    const tal = tallies.get(t.id)!;
    const score = tal.title / RUNS * 100 + tal.final / RUNS * 30 + tal.sf / RUNS * 12 + t.elo / 40;
    scored.push({ teamId: t.id, score });
  });
  const powerRank = new Map(
    scored.sort((a, b) => b.score - a.score).map((s, i) => [s.teamId, i + 1]),
  );

  teamsArr.forEach((t) => {
    const tal = tallies.get(t.id)!;
    const p = (n: number) => Math.round((n / RUNS) * 1000) / 1000;
    const winTitle = tal.title / RUNS;
    forecasts.set(t.id, {
      teamId: t.id,
      reachR32: p(tal.qualify),
      reachR16: p(tal.r16),
      reachQF: p(tal.qf),
      reachSF: p(tal.sf),
      reachFinal: p(tal.final),
      winTitle: p(tal.title),
      groupWin: p(tal.groupWin),
      expectedFinish: Math.round((49 - powerRank.get(t.id)!) / 1) || 1,
      titleProbabilityDelta: Math.round((winTitle - t.preTournamentTitleOdds) * 1000) / 1000,
      powerRating: Math.round((winTitle * 100 + tal.final / RUNS * 30 + t.elo / 30) * 10) / 10,
      powerRank: powerRank.get(t.id)!,
    });
  });

  return { forecasts, runs: RUNS };
}
