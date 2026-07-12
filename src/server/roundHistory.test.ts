import { describe, it, expect } from 'vitest';
import { buildRoundHistory, type EditionInput } from './roundHistory';
import type { Match, MatchStage, Team } from '@/domain/types';

const team = (id: string, name: string, flag = '🏳️'): Team => ({ id, name, flag }) as Team;
const sf = (home: string, away: string, hs: number, as: number, pens?: { home: number; away: number }): Match =>
  ({
    id: `m-${home}-${away}`, stage: 'SF' as MatchStage, status: 'FINISHED',
    homeTeamId: home, awayTeamId: away, homeScore: hs, awayScore: as,
    penalties: pens ?? null, events: [], shots: [], teamStats: {},
  }) as unknown as Match;

// A miniature "last two Cups" archive.
const editions: EditionInput[] = [
  {
    year: 2022, label: 'Qatar 2022',
    teams: [team('arg', 'Argentina', '🇦🇷'), team('cro', 'Croatia'), team('fra', 'France', '🇫🇷'), team('mar', 'Morocco')],
    matches: [sf('arg', 'cro', 3, 0), sf('fra', 'mar', 2, 0)],
  },
  {
    year: 2014, label: 'Brazil 2014',
    teams: [team('bra', 'Brazil'), team('deu', 'Germany'), team('ned', 'Netherlands'), team('arg2', 'Argentina', '🇦🇷')],
    matches: [sf('bra', 'deu', 1, 7), sf('ned', 'arg2', 0, 0, { home: 2, away: 4 })],
  },
];

describe('buildRoundHistory (ENH-6)', () => {
  const data = buildRoundHistory(editions, 'SF', [
    { name: 'France', flag: '🇫🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Spain', flag: '🇪🇸' },
  ]);

  it('aggregates games, goals and shootouts across editions', () => {
    expect(data.games).toBe(4);
    expect(data.goals).toBe(3 + 2 + 8 + 0);
    expect(data.goalsPerGame).toBe(3.25);
    expect(data.shootouts).toBe(1);
  });

  it('finds the biggest win and orders editions newest first', () => {
    expect(data.biggest).toEqual({ desc: 'Germany 7–1 Brazil', year: 2014 });
    expect(data.editions.map((e) => e.year)).toEqual([2022, 2014]);
  });

  it('marks shootout winners and regulation winners correctly', () => {
    const m2014 = data.editions[1]!.matches;
    expect(m2014[0]!.winnerName).toBe('Germany');
    expect(m2014[1]!.winnerName).toBe('Argentina'); // via penalties
  });

  it('tracks which current teams were at this round before — across differing team ids', () => {
    const by = new Map(data.presence.map((p) => [p.name, p.years]));
    expect(by.get('Argentina')).toEqual([2014, 2022]); // 'arg' and 'arg2' join by canonical name
    expect(by.get('France')).toEqual([2022]);
    expect(by.get('Spain')).toEqual([]); // not there in this span
  });
});
