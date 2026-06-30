import { describe, it, expect } from 'vitest';
import { buildBracket } from './bracket';
import type { StandingRow, Team, Match, TeamForecast } from '@/domain/types';

const team = (id: string, elo: number): Team =>
  ({ id, name: id.toUpperCase(), code: id.toUpperCase(), flag: '🏳️', elo } as unknown as Team);

const row = (teamId: string, groupId: string, points: number): StandingRow =>
  ({ teamId, groupId, points, goalDifference: 0 } as unknown as StandingRow);

const m = (id: string, home: string, away: string, status: string, hs: number, as_: number, kickoff: string, pens?: [number, number]): Match =>
  ({ id, stage: 'SF', homeTeamId: home, awayTeamId: away, status, homeScore: hs, awayScore: as_, kickoff, ...(pens ? { penalties: { home: pens[0], away: pens[1] } } : {}) } as unknown as Match);

// 2 groups → a 4-team bracket whose first round is the Semi-finals. With both SF
// fixtures drawn, the bracket must reflect the REAL matchups + the played result,
// not a re-seeded projection. (Bug: knockout bracket showed projected ties during
// the real knockout stage.)
describe('buildBracket — seeds the first round from the real draw', () => {
  const teams = new Map([team('a1', 1900), team('a2', 1700), team('b1', 1800), team('b2', 1600)].map((t) => [t.id, t]));
  const standings: StandingRow[][] = [
    [row('a1', 'A', 6), row('a2', 'A', 3)],
    [row('b1', 'B', 6), row('b2', 'B', 3)],
  ];
  const forecasts = new Map<string, TeamForecast>();

  it('uses the actual fixtures and the real scoreline for a played tie', () => {
    const matches = [
      m('m-sf1', 'a1', 'b2', 'FINISHED', 2, 1, '2026-07-10T18:00:00Z'),
      m('m-sf2', 'a2', 'b1', 'SCHEDULED', 0, 0, '2026-07-10T21:00:00Z'),
    ];
    const nodes = buildBracket(standings, forecasts, teams, matches);
    const sf = nodes.filter((n) => n.stage === 'SF');
    expect(sf).toHaveLength(2);

    const played = sf.find((n) => n.matchId === 'm-sf1')!;
    expect(played.homeTeamId).toBe('a1');
    expect(played.awayTeamId).toBe('b2'); // the REAL matchup, not a re-seed
    expect(played.decided).toBe(true);
    expect(played.homeScore).toBe(2);
    expect(played.awayScore).toBe(1);
    expect(played.winnerTeamId).toBe('a1');
    expect(played.homeAdvanceProb).toBe(1); // decided, not a projection

    // The real winner propagates into the projected Final.
    const final = nodes.find((n) => n.stage === 'FINAL')!;
    expect([final.homeTeamId, final.awayTeamId]).toContain('a1');
  });

  it('decides a level tie by penalties', () => {
    const matches = [
      m('m-sf1', 'a1', 'b2', 'FINISHED', 1, 1, '2026-07-10T18:00:00Z', [3, 4]), // b2 wins on pens
      m('m-sf2', 'a2', 'b1', 'SCHEDULED', 0, 0, '2026-07-10T21:00:00Z'),
    ];
    const nodes = buildBracket(standings, forecasts, teams, matches);
    const played = nodes.find((n) => n.matchId === 'm-sf1')!;
    expect(played.winnerTeamId).toBe('b2');
    expect(played.penaltyWin).toBe(true);
  });

  it('falls back to a projected bracket when the round is not yet drawn', () => {
    const nodes = buildBracket(standings, forecasts, teams, []); // no real fixtures
    const sf = nodes.filter((n) => n.stage === 'SF');
    expect(sf).toHaveLength(2);
    expect(sf.every((n) => n.matchId === null)).toBe(true); // all projected
    expect(sf.every((n) => !n.decided)).toBe(true);
  });

  // Generalisation: EVERY drawn round renders from real fixtures, not just the
  // first — so as R16/QF/SF/Final get drawn, the bracket stays real round-by-round
  // with no per-round patching.
  it('uses real fixtures for a later round too (the Final), once it is drawn', () => {
    const sf = [
      m('m-sf1', 'a1', 'b2', 'FINISHED', 2, 0, '2026-07-10T18:00:00Z'),
      m('m-sf2', 'b1', 'a2', 'FINISHED', 1, 0, '2026-07-10T21:00:00Z'),
    ];
    // The real Final, played: a1 beat b1 3-1.
    const finalMatch = { ...m('m-final', 'a1', 'b1', 'FINISHED', 3, 1, '2026-07-14T18:00:00Z'), stage: 'FINAL' } as Match;
    const nodes = buildBracket(standings, forecasts, teams, [...sf, finalMatch]);

    const final = nodes.find((n) => n.stage === 'FINAL')!;
    expect(final.matchId).toBe('m-final'); // real fixture, not projected
    expect(final.homeTeamId).toBe('a1');
    expect(final.awayTeamId).toBe('b1'); // the REAL final pairing
    expect(final.decided).toBe(true);
    expect(final.homeScore).toBe(3);
    expect(final.winnerTeamId).toBe('a1');
  });
});
