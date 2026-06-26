import { describe, it, expect } from 'vitest';
import { reconcileForecastsWithResults } from './knockoutResults';
import type { Match, Team, TeamForecast, MatchStage, MatchStatus } from '@/domain/types';

// Minimal builders — the reconciler only reads a handful of fields.
function fc(teamId: string, over: Partial<TeamForecast> = {}): TeamForecast {
  return {
    teamId,
    reachR32: 0.5, reachR16: 0.4, reachQF: 0.3, reachSF: 0.2, reachFinal: 0.1,
    winTitle: 0.05, groupWin: 0.3, expectedFinish: 10, titleProbabilityDelta: 0,
    powerRating: 50, powerRank: 10, ...over,
  };
}
function ko(
  stage: MatchStage,
  home: string,
  away: string,
  opts: { status?: MatchStatus; hs?: number; as?: number; pens?: { home: number; away: number } } = {},
): Match {
  return {
    id: `m-${home}-${away}-${stage}`, competitionId: 'wc-2026', stage, groupId: null, matchday: 1,
    kickoff: '2026-07-03T18:00:00Z', venue: '', city: '', status: opts.status ?? 'SCHEDULED', minute: 0,
    homeTeamId: home, awayTeamId: away, homeScore: opts.hs ?? 0, awayScore: opts.as ?? 0,
    homeScoreHT: 0, awayScoreHT: 0, penalties: opts.pens ?? null, teamStats: {}, events: [], shots: [],
    bracketSlot: null,
  } as Match;
}
const team = (id: string): Team => ({ id }) as Team;
const map = (...fs: TeamForecast[]) => new Map(fs.map((f) => [f.teamId, f]));

describe('reconcileForecastsWithResults', () => {
  it('is a no-op before any real knockout fixtures exist', () => {
    const f = map(fc('a'), fc('b'));
    const before = JSON.stringify([...f.values()]);
    reconcileForecastsWithResults(f, [ko('GROUP' as MatchStage, 'a', 'b')], [team('a'), team('b')]);
    expect(JSON.stringify([...f.values()])).toBe(before);
  });

  it('zeroes a team that did not qualify (groups done, not in any R32 tie)', () => {
    const f = map(fc('a'), fc('b'), fc('z'));
    // a vs b is a real R32 tie; z is nowhere in the bracket.
    reconcileForecastsWithResults(f, [ko('R32', 'a', 'b')], [team('a'), team('b'), team('z')]);
    const z = f.get('z')!;
    expect([z.reachR32, z.reachR16, z.reachQF, z.reachSF, z.reachFinal, z.winTitle]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('does NOT zero a still-qualifying team while group games remain (WC-038)', () => {
    // The real-world incident: SportMonks draws a few R32 ties early (clinched
    // teams) while the group stage is still being played. A dominant favourite
    // with a game in hand must keep its forecast, not get zeroed.
    const f = map(fc('arg', { winTitle: 0.25, reachR32: 0.99, reachFinal: 0.4 }), fc('bra'), fc('jpn'));
    const matches = [
      ko('GROUP', 'arg', 'jor', { status: 'SCHEDULED' }), // group stage not finished
      ko('R32', 'bra', 'jpn', { status: 'SCHEDULED' }), // an early-drawn knockout tie
    ];
    reconcileForecastsWithResults(f, matches, [team('arg'), team('bra'), team('jpn'), team('jor')]);
    const arg = f.get('arg')!;
    expect([arg.winTitle, arg.reachR32, arg.reachFinal]).toEqual([0.25, 0.99, 0.4]); // untouched
    expect(f.get('bra')!.reachR32).toBe(1); // bra is in a real R32 tie → confirmed through
  });

  it('eliminates the loser of a finished R32 tie and confirms the winner into R16', () => {
    const f = map(fc('a'), fc('b'));
    reconcileForecastsWithResults(f, [ko('R32', 'a', 'b', { status: 'FINISHED', hs: 2, as: 0 })], [team('a'), team('b')]);
    const a = f.get('a')!, b = f.get('b')!;
    expect(a.reachR32).toBe(1);
    expect(a.reachR16).toBe(1); // won R32 → reached R16
    expect(a.reachQF).toBe(0.3); // still open → simulated value preserved
    expect(b.reachR32).toBe(1); // b did reach the R32 (it played there)
    expect(b.reachR16).toBe(0); // eliminated
    expect(b.winTitle).toBe(0);
  });

  it('records a team eliminated in the quarter-finals as reaching the QF but no further', () => {
    const f = map(fc('a'), fc('b'), fc('c'), fc('d'));
    const matches = [
      ko('R32', 'a', 'x1', { status: 'FINISHED', hs: 1, as: 0 }), // a qualifies + advances
      ko('R32', 'b', 'x2', { status: 'FINISHED', hs: 1, as: 0 }),
      ko('QF', 'a', 'b', { status: 'FINISHED', hs: 0, as: 2 }), // b beats a in the QF
    ];
    reconcileForecastsWithResults(f, matches, [team('a'), team('b'), team('x1'), team('x2')]);
    const a = f.get('a')!;
    expect([a.reachR32, a.reachR16, a.reachQF]).toEqual([1, 1, 1]); // reached the QF
    expect([a.reachSF, a.reachFinal, a.winTitle]).toEqual([0, 0, 0]); // out at the QF
  });

  it('resolves a level tie by penalties', () => {
    const f = map(fc('a'), fc('b'));
    const matches = [ko('R32', 'a', 'b', { status: 'FINISHED', hs: 1, as: 1, pens: { home: 4, away: 5 } })];
    reconcileForecastsWithResults(f, matches, [team('a'), team('b')]);
    expect(f.get('b')!.reachR16).toBe(1); // away won the shootout → advances
    expect(f.get('a')!.reachR16).toBe(0); // home eliminated
  });

  it('confirms a team that has reached a round via a scheduled (resolved) fixture', () => {
    const f = map(fc('a'), fc('b'));
    const matches = [
      ko('R32', 'a', 'b', { status: 'FINISHED', hs: 2, as: 1 }), // a qualifies, advances
      ko('R16', 'a', 'c', { status: 'SCHEDULED' }), // a is named in a real, resolved R16 tie
    ];
    reconcileForecastsWithResults(f, matches, [team('a'), team('b'), team('c')]);
    const a = f.get('a')!;
    expect(a.reachR16).toBe(1); // appears in the R16 → has reached it
    expect(a.reachQF).toBe(0.3); // QF still open → simulated value preserved
  });

  it('marks the champion (won the final) and the runner-up correctly', () => {
    const f = map(fc('a'), fc('b'));
    const matches = [
      ko('R32', 'a', 'p', { status: 'FINISHED', hs: 1, as: 0 }),
      ko('R32', 'b', 'q', { status: 'FINISHED', hs: 1, as: 0 }),
      ko('FINAL', 'a', 'b', { status: 'FINISHED', hs: 3, as: 1 }),
    ];
    reconcileForecastsWithResults(f, matches, [team('a'), team('b'), team('p'), team('q')]);
    const a = f.get('a')!, b = f.get('b')!;
    expect([a.reachFinal, a.winTitle]).toEqual([1, 1]); // champion
    expect([b.reachFinal, b.winTitle]).toEqual([1, 0]); // reached the final, lost it
  });
});
