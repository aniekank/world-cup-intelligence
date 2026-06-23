/**
 * Tournament Power Rating, Team Momentum Index, and the live power ranking.
 *
 * Power rating blends three signals: live ELO, Monte Carlo deep-run equity
 * (how often a team reaches the latter stages), and underlying performance
 * (xG differential per game). Momentum measures recent over/under-performance
 * versus ELO expectation — the "are they heating up?" signal.
 */

import { eloExpectation } from './elo';
import type { Match, Team, TeamForecast, PowerRankingRow } from '@/domain/types';

export function teamMomentum(team: Team, matches: Match[], allTeams: Map<string, Team>): number {
  const played = matches
    .filter((m) => (m.homeTeamId === team.id || m.awayTeamId === team.id) && m.status === 'FINISHED')
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!played.length) return 0;

  let momentum = 0;
  let weight = 0;
  played.forEach((m, i) => {
    const isHome = m.homeTeamId === team.id;
    const oppId = isHome ? m.awayTeamId : m.homeTeamId;
    const opp = allTeams.get(oppId);
    if (!opp) return;
    const gf = isHome ? m.homeScore : m.awayScore;
    const ga = isHome ? m.awayScore : m.homeScore;
    const result = gf > ga ? 1 : gf === ga ? 0.5 : 0;
    const expected = eloExpectation(team.elo, opp.elo, isHome ? 60 : -60);
    const xgFor = m.teamStats[team.id]?.xG ?? gf;
    const xgAgainst = m.teamStats[oppId]?.xG ?? ga;
    // Recency weight: most recent match counts most
    const w = i + 1;
    const performance = (result - expected) * 60 + (gf - ga) * 6 + (xgFor - xgAgainst) * 8;
    momentum += performance * w;
    weight += w;
  });
  return Math.round(clamp(momentum / Math.max(weight, 1), -100, 100));
}

export function buildPowerRankings(
  teams: Team[],
  matches: Match[],
  forecasts: Map<string, TeamForecast>,
  previous?: Map<string, number>,
): PowerRankingRow[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const rows = teams.map((t) => {
    const f = forecasts.get(t.id);
    const played = matches.filter(
      (m) => (m.homeTeamId === t.id || m.awayTeamId === t.id) && m.status === 'FINISHED',
    );
    let xgFor = 0;
    let xgAgainst = 0;
    played.forEach((m) => {
      const oppId = m.homeTeamId === t.id ? m.awayTeamId : m.homeTeamId;
      xgFor += m.teamStats[t.id]?.xG ?? 0;
      xgAgainst += m.teamStats[oppId]?.xG ?? 0;
    });
    const games = Math.max(played.length, 1);
    const xgDiffPerGame = (xgFor - xgAgainst) / games;

    // Power rating: ELO-tier (0..100) + deep-run equity + xG signal
    const eloTier = ((t.elo - 1580) / (2120 - 1580)) * 100;
    const deepRun = f ? (f.winTitle * 220 + f.reachSF * 40 + f.reachQF * 12) : 0;
    // Keep the raw (pre-clamp) score for sorting: several elite teams saturate
    // the 0..100 display ceiling, and ranking by the clamped value leaves their
    // order to be decided by array position — which isn't stable across engine
    // rebuilds, so the very top would reshuffle on every live status flip.
    const rawScore = eloTier * 0.55 + deepRun + xgDiffPerGame * 6;
    const powerRating = round1(clamp(rawScore, 0, 100));

    return {
      teamId: t.id,
      rawScore,
      powerRating,
      offenseRating: round1(clamp(50 + (xgFor / games - 1.3) * 28 + (t.attackRating - 75) * 1.4, 0, 100)),
      defenseRating: round1(clamp(50 + (1.3 - xgAgainst / games) * 28 + (t.defenseRating - 75) * 1.4, 0, 100)),
      elo: t.elo,
      momentum: teamMomentum(t, matches, teamMap),
    };
  });

  // Sort by the un-clamped score, then ELO as a deterministic final tie-break,
  // so the order is identical every rebuild (and identical on every page that
  // reads it — home panel and the full /rankings table).
  rows.sort((a, b) => b.rawScore - a.rawScore || b.elo - a.elo || a.teamId.localeCompare(b.teamId));

  return rows.map(({ rawScore: _rawScore, ...r }, i) => {
    const rank = i + 1;
    const prev = previous?.get(r.teamId) ?? rank;
    const trend: PowerRankingRow['trend'] = rank < prev ? 'up' : rank > prev ? 'down' : 'flat';
    return { ...r, rank, previousRank: prev, trend };
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
const round1 = (v: number) => Math.round(v * 10) / 10;
