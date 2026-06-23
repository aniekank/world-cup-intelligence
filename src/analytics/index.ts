/**
 * Analytics engine entry point. Composes the individual models into a single
 * memoized snapshot consumed by the API and pages. In production these
 * computations run in a background worker and land in the materialized tables;
 * here they run once per process and are cached in module scope.
 */

import {
  getCompetition,
  getTeams,
  getGroups,
  getMatches,
  getPlayerViews,
} from '@/data/store';
import { computeGroupStandings, rankBestThirds } from './standings';
import { runSimulation } from './simulate';
import { reconcileForecastsWithResults } from './knockoutResults';
import { buildPowerRankings } from './power';
import { buildBracket } from './bracket';
import { projectGoldenBoot } from './goldenboot';
import { predictMatch } from './poisson';
import type {
  StandingRow,
  TeamForecast,
  PowerRankingRow,
  BracketNode,
  GoldenBootProjection,
  MatchPrediction,
  Team,
} from '@/domain/types';

export interface EngineSnapshot {
  standingsByGroup: StandingRow[][];
  standingsByTeam: Map<string, StandingRow>;
  bestThirds: StandingRow[];
  forecasts: Map<string, TeamForecast>;
  powerRankings: PowerRankingRow[];
  bracket: BracketNode[];
  goldenBoot: GoldenBootProjection[];
  predictions: Map<string, MatchPrediction>;
  generatedAt: string;
}

// Cached on globalThis (not a module variable) so it survives Next's module
// duplication AND is cleared by store.setDataset when the data source swaps in.
const G = globalThis as unknown as { __wcEngine?: EngineSnapshot };

export function engine(): EngineSnapshot {
  if (G.__wcEngine) return G.__wcEngine;

  const teams = getTeams();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const groups = getGroups();
  const matches = getMatches();

  // 1. Monte Carlo forecasts, then reconcile with any real knockout results so a
  //    team that's already been eliminated can't still show a reach probability
  //    (no-op until real knockout fixtures exist).
  const { forecasts } = runSimulation(teams, groups, matches);
  reconcileForecastsWithResults(forecasts, matches, teams);

  // 2. Standings (inject qualification probability from the simulation)
  const matchMap = matches;
  const standingsByGroup = groups.map((g) => {
    const rows = computeGroupStandings(g, matchMap, teamMap);
    return rows.map((r) => ({
      ...r,
      qualificationProbability: forecasts.get(r.teamId)?.reachR32 ?? 0,
    }));
  });
  const standingsByTeam = new Map<string, StandingRow>();
  standingsByGroup.flat().forEach((r) => standingsByTeam.set(r.teamId, r));
  const bestThirds = rankBestThirds(standingsByGroup);

  // 3. Power rankings
  const powerRankings = buildPowerRankings(teams, matches, forecasts);

  // 4. Projected bracket
  const bracket = buildBracket(standingsByGroup, forecasts, teamMap);

  // 5. Golden Boot projection
  const groupGamesLeftByTeam = computeGroupGamesLeft(teams, matches);
  const goldenBoot = projectGoldenBoot(getPlayerViews(), forecasts, groupGamesLeftByTeam);

  // 6. Match predictions for non-finished matches
  const predictions = new Map<string, MatchPrediction>();
  for (const m of matches) {
    if (m.status === 'FINISHED') continue;
    const home = teamMap.get(m.homeTeamId);
    const away = teamMap.get(m.awayTeamId);
    if (!home || !away) continue;
    predictions.set(m.id, { ...predictMatch(home, away), matchId: m.id });
  }

  G.__wcEngine = {
    standingsByGroup,
    standingsByTeam,
    bestThirds,
    forecasts,
    powerRankings,
    bracket,
    goldenBoot,
    predictions,
    generatedAt: getCompetition().startDate,
  };
  return G.__wcEngine;
}

function computeGroupGamesLeft(teams: Team[], matches: ReturnType<typeof getMatches>): Map<string, number> {
  const left = new Map<string, number>();
  teams.forEach((t) => left.set(t.id, 0));
  for (const m of matches) {
    if (m.groupId && m.status !== 'FINISHED') {
      left.set(m.homeTeamId, (left.get(m.homeTeamId) ?? 0) + 1);
      left.set(m.awayTeamId, (left.get(m.awayTeamId) ?? 0) + 1);
    }
  }
  return left;
}

// Convenience selectors over the snapshot
export const getForecast = (teamId: string) => engine().forecasts.get(teamId) ?? null;
export const getStandingForTeam = (teamId: string) => engine().standingsByTeam.get(teamId) ?? null;
export const getPowerRanking = (teamId: string) => engine().powerRankings.find((r) => r.teamId === teamId) ?? null;
export const getPrediction = (matchId: string) => engine().predictions.get(matchId) ?? null;
