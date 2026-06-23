import { describe, it, expect } from 'vitest';
import { generateDataset } from '@/data/generate';
import { dataset, getPlayerViews, getTeams } from '@/data/store';
import { engine } from '@/analytics';
import { predictMatch, scoreMatrix } from '@/analytics/poisson';
import { eloExpectation, eloOutcomeProbabilities } from '@/analytics/elo';
import { answerQuery } from '@/ai/nlq';
import { generateInsights, generateMatchSummary, generateScoutingReport } from '@/ai/narratives';

describe('data generation', () => {
  const ds = generateDataset();

  it('produces 48 teams in 12 groups', () => {
    expect(ds.teams).toHaveLength(48);
    expect(ds.groups).toHaveLength(12);
    ds.groups.forEach((g) => expect(g.teamIds).toHaveLength(4));
  });

  it('produces a 26-man squad per team', () => {
    ds.teams.forEach((t) => {
      const squad = ds.players.filter((p) => p.teamId === t.id);
      expect(squad).toHaveLength(26);
      expect(squad.filter((p) => p.position === 'GK').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('is deterministic across runs', () => {
    const a = generateDataset();
    const b = generateDataset();
    expect(a.teams[0]!.elo).toBe(b.teams[0]!.elo);
    expect(Object.values(a.playerStats).reduce((s, p) => s + p.goals, 0)).toBe(
      Object.values(b.playerStats).reduce((s, p) => s + p.goals, 0),
    );
  });

  it('goals reconcile with scored events', () => {
    const finished = ds.matches.filter((m) => m.status === 'FINISHED');
    expect(finished.length).toBeGreaterThan(0);
    for (const m of finished) {
      const homeGoals = m.events.filter((e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') && e.teamId === m.homeTeamId).length;
      expect(homeGoals).toBe(m.homeScore);
    }
  });

  it('player xG is non-negative and goals never wildly exceed shots', () => {
    Object.values(ds.playerStats).forEach((s) => {
      expect(s.xG).toBeGreaterThanOrEqual(0);
      expect(s.goals).toBeLessThanOrEqual(s.shots + 1);
    });
  });
});

describe('probability models', () => {
  it('score matrix sums to ~1', () => {
    const total = scoreMatrix(1.6, 1.1).flat().reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('match prediction probabilities sum to ~1', () => {
    const teams = getTeams();
    const p = predictMatch(teams[0]!, teams[1]!);
    expect(p.homeWin + p.draw + p.awayWin).toBeCloseTo(1, 2);
    expect(p.expectedGoals.home).toBeGreaterThan(0);
  });

  it('ELO expectation favours the stronger side', () => {
    expect(eloExpectation(2000, 1700, 0)).toBeGreaterThan(0.5);
    const o = eloOutcomeProbabilities(1850, 1850, 0);
    expect(o.win + o.draw + o.loss).toBeCloseTo(1, 3);
  });
});

describe('analytics engine', () => {
  const eng = engine();

  it('every team has a forecast with valid probabilities', () => {
    getTeams().forEach((t) => {
      const f = eng.forecasts.get(t.id)!;
      expect(f).toBeTruthy();
      expect(f.winTitle).toBeGreaterThanOrEqual(0);
      expect(f.winTitle).toBeLessThanOrEqual(1);
      expect(f.reachR16).toBeLessThanOrEqual(f.reachR32 + 1e-9);
    });
  });

  it('title probabilities across all teams sum to ~1', () => {
    const total = [...eng.forecasts.values()].reduce((s, f) => s + f.winTitle, 0);
    expect(total).toBeGreaterThan(0.9);
    expect(total).toBeLessThan(1.1);
  });

  it('produces 12 group tables of 4', () => {
    expect(eng.standingsByGroup).toHaveLength(12);
    eng.standingsByGroup.forEach((g) => expect(g).toHaveLength(4));
  });

  it('produces a 31-node knockout bracket', () => {
    expect(eng.bracket).toHaveLength(31); // 16+8+4+2+1
  });

  it('ranks the power table 1..48', () => {
    expect(eng.powerRankings).toHaveLength(48);
    expect(eng.powerRankings[0]!.rank).toBe(1);
  });

  it('golden boot race ranks by goals actually scored (projection rides alongside)', () => {
    const gb = eng.goldenBoot;
    expect(gb.length).toBeGreaterThan(0);
    expect(gb[0]!.currentGoals).toBeGreaterThanOrEqual(gb[1]!.currentGoals);
  });
});

describe('AI layer', () => {
  it('answers a metric leaderboard query', () => {
    const r = answerQuery('Who has the highest xG among midfielders?');
    expect(r.intent).toBe('leaderboard');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers an over-performance query', () => {
    const r = answerQuery('Which teams are outperforming pre-tournament expectations?');
    expect(r.intent).toBe('overperformance');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('answers a breakout query', () => {
    const r = answerQuery('Show under-the-radar breakout players');
    expect(r.intent).toBe('breakout');
  });

  it('answers an easiest-path query', () => {
    const r = answerQuery('Which team has the easiest path to the final?');
    expect(r.intent).toBe('easiest-path');
  });

  it('generates insights, a match summary and a scouting report', () => {
    expect(generateInsights().length).toBeGreaterThan(0);
    const m = dataset().matches.find((x) => x.status === 'FINISHED')!;
    expect(generateMatchSummary(m.id).length).toBeGreaterThan(20);
    const pv = getPlayerViews().sort((a, b) => b.stats.goals - a.stats.goals)[0]!;
    expect(generateScoutingReport(pv.id).summary.length).toBeGreaterThan(20);
  });
});
