/**
 * Server query layer. Composes the repository (src/data), analytics engine
 * (src/analytics) and AI layer (src/ai) into denormalized view models consumed
 * by both the API route handlers and React Server Components. Centralizing the
 * joins here keeps pages thin and the cache keys consistent.
 */

import 'server-only';
import {
  getCompetition,
  getTeams,
  getTeam,
  getGroups,
  getMatches,
  getMatch,
  getTeamMatches,
  getPlayerViews,
  getPlayerView,
  getSquad,
  getLiveMatches,
} from '@/data/store';
import { engine } from '@/analytics';
import { rankPlayers, rankTeams } from '@/ai/query/resolver';
import { generateInsights, generateDailyBriefing, generateBriefingDeck, generateMatchSummary, storylines } from '@/ai/narratives';
import { criticalMatches, matchPreview } from '@/ai/previews';
import type { Team, TeamView, Match } from '@/domain/types';

export function competition() {
  return getCompetition();
}

// ── Teams ────────────────────────────────────────────────────
export function teamsWithForecast() {
  const eng = engine();
  return getTeams()
    .map((t) => ({
      ...t,
      forecast: eng.forecasts.get(t.id) ?? null,
      standing: eng.standingsByTeam.get(t.id) ?? null,
      powerRanking: eng.powerRankings.find((r) => r.teamId === t.id) ?? null,
    }))
    .sort((a, b) => (b.forecast?.winTitle ?? 0) - (a.forecast?.winTitle ?? 0));
}

export function teamView(id: string): (TeamView & { summary: string }) | null {
  const team = getTeam(id);
  if (!team) return null;
  const eng = engine();
  const group = getGroups().find((g) => g.id === team.groupId) ?? null;
  const recent = getTeamMatches(id);
  return {
    ...team,
    group,
    standing: eng.standingsByTeam.get(id) ?? null,
    forecast: eng.forecasts.get(id) ?? null,
    powerRanking: eng.powerRankings.find((r) => r.teamId === id) ?? null,
    recentMatches: recent,
    summary: `${team.name} — managed by ${team.manager}. FIFA #${team.fifaRanking}, ELO ${team.elo}.`,
  };
}

export function squadViews(teamId: string) {
  return getSquad(teamId)
    .map((p) => getPlayerView(p.id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((a, b) => b.rating.overall - a.rating.overall);
}

// ── Players ──────────────────────────────────────────────────
export function players(opts?: { position?: string; teamId?: string; sort?: string; limit?: number }) {
  let pool = getPlayerViews();
  if (opts?.position) pool = pool.filter((p) => p.position === opts.position);
  if (opts?.teamId) pool = pool.filter((p) => p.teamId === opts.teamId);
  const sortKey = opts?.sort ?? 'goals';
  pool = pool.sort((a, b) => {
    const av = (a.stats as unknown as Record<string, number>)[sortKey] ?? a.rating.overall;
    const bv = (b.stats as unknown as Record<string, number>)[sortKey] ?? b.rating.overall;
    if (bv !== av) return bv - av;
    // Tie-breakers so the list stays sensible when the metric is sparse/zero
    // (e.g. early in a live tournament): goals → assists → minutes → rating → name
    if (b.stats.goals !== a.stats.goals) return b.stats.goals - a.stats.goals;
    if (b.stats.assists !== a.stats.assists) return b.stats.assists - a.stats.assists;
    if (b.stats.minutes !== a.stats.minutes) return b.stats.minutes - a.stats.minutes;
    if (b.rating.overall !== a.rating.overall) return b.rating.overall - a.rating.overall;
    return a.name.localeCompare(b.name);
  });
  return opts?.limit ? pool.slice(0, opts.limit) : pool;
}

export function playerDetail(id: string) {
  const view = getPlayerView(id);
  if (!view) return null;
  return view;
}

// ── Matches ──────────────────────────────────────────────────
export function matchesView(opts?: { status?: string; stage?: string; groupId?: string }) {
  const eng = engine();
  let pool = getMatches();
  if (opts?.status) pool = pool.filter((m) => m.status === opts.status);
  if (opts?.stage) pool = pool.filter((m) => m.stage === opts.stage);
  if (opts?.groupId) pool = pool.filter((m) => m.groupId === opts.groupId);
  return pool
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => ({ ...m, prediction: eng.predictions.get(m.id) ?? null }));
}

export function matchDetail(id: string) {
  const m = getMatch(id);
  if (!m) return null;
  const home = getTeam(m.homeTeamId);
  const away = getTeam(m.awayTeamId);
  if (!home || !away) return null; // TBD knockout fixture — no detail to show yet
  const eng = engine();
  return {
    match: m,
    home,
    away,
    prediction: eng.predictions.get(id) ?? null,
    summary: generateMatchSummary(id),
    preview: m.status === 'SCHEDULED' ? matchPreview(id) : null,
  };
}

export function liveMatches() {
  return getLiveMatches()
    .map((m) => ({ ...m, home: getTeam(m.homeTeamId), away: getTeam(m.awayTeamId) }))
    .filter((m): m is typeof m & { home: Team; away: Team } => Boolean(m.home && m.away));
}

// ── Standings / bracket / rankings ───────────────────────────
export function standingsView() {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  return {
    groups: getGroups().map((g) => ({
      group: g,
      rows: (eng.standingsByGroup.find((s) => s[0]?.groupId === g.id) ?? [])
        .map((r) => ({ ...r, team: teamMap.get(r.teamId) }))
        .filter((r): r is typeof r & { team: Team } => Boolean(r.team)),
    })),
    bestThirds: eng.bestThirds
      .map((r) => ({ ...r, team: teamMap.get(r.teamId) }))
      .filter((r): r is typeof r & { team: Team } => Boolean(r.team)),
  };
}

export function bracketView() {
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  return engine().bracket.map((n) => ({
    ...n,
    home: n.homeTeamId ? teamMap.get(n.homeTeamId) ?? null : null,
    away: n.awayTeamId ? teamMap.get(n.awayTeamId) ?? null : null,
  }));
}

export function rankingsView() {
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  return engine()
    .powerRankings.map((r) => ({ ...r, team: teamMap.get(r.teamId) }))
    .filter((r): r is typeof r & { team: Team } => Boolean(r.team));
}

export function predictionsView() {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  return {
    forecasts: getTeams()
      .map((t) => ({ team: t, forecast: eng.forecasts.get(t.id)! }))
      .filter((x) => x.forecast)
      .sort((a, b) => b.forecast.winTitle - a.forecast.winTitle),
    // Deeper list so the region filter on the golden-boot board has enough names.
    goldenBoot: eng.goldenBoot.slice(0, 80).map((g) => {
      const v = getPlayerViews().find((p) => p.id === g.playerId);
      return { ...g, player: v ?? null, team: v ? teamMap.get(v.teamId) ?? null : null };
    }),
  };
}

// ── Critical match previews ──────────────────────────────────
export function criticalMatchesView(limit = 4) {
  const eng = engine();
  return criticalMatches(limit)
    .map((p) => {
      const m = getMatch(p.matchId);
      const home = m ? getTeam(m.homeTeamId) : undefined;
      const away = m ? getTeam(m.awayTeamId) : undefined;
      return { ...p, home, away, prediction: eng.predictions.get(p.matchId) ?? null };
    })
    .filter((x): x is typeof x & { home: Team; away: Team } => Boolean(x.home && x.away));
}

// ── Insights / briefing ──────────────────────────────────────
export function insights() {
  return generateInsights();
}
export function dailyBriefing() {
  return generateDailyBriefing();
}
export function watchStorylines() {
  return storylines();
}

// ── Home dashboard ───────────────────────────────────────────
export function homeData() {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  const favorites = teamsWithForecast().slice(0, 6);
  const live = liveMatches();
  const upcoming = matchesView({ status: 'SCHEDULED' }).slice(0, 6);
  const topScorers = players({ sort: 'goals', limit: 5 });
  return {
    competition: getCompetition(),
    briefing: generateDailyBriefing(),
    briefingDeck: generateBriefingDeck(),
    criticalMatches: criticalMatchesView(4),
    favorites,
    live,
    upcoming,
    topScorers,
    powerTop: eng.powerRankings
      .map((r) => ({ ...r, team: teamMap.get(r.teamId) }))
      .filter((r): r is typeof r & { team: Team } => Boolean(r.team))
      .slice(0, 5),
    insights: generateInsights().slice(0, 4),
    goldenBoot: eng.goldenBoot.slice(0, 5).map((g) => {
      const v = getPlayerViews().find((p) => p.id === g.playerId);
      return { ...g, player: v ?? null };
    }),
  };
}

// ── Global search ────────────────────────────────────────────
// Both player/team matching go through the shared resolver (src/ai/query/resolver)
// — the same brain the natural-language engine uses — so "lionel messi", "messi",
// "l messi", a typo, or a team alias all resolve identically here and in the AI.
export function search(query: string) {
  const q = query.trim();
  if (!q) return { teams: [], players: [], matches: [] };
  const teams = rankTeams(q, 6);
  const players = rankPlayers(q, 8);
  // Matches: any fixture involving a team the query resolves to. Resolve both
  // sides and drop fixtures with an unresolved side (TBD knockout slots / hollow
  // live feed) so /api/search can never crash on an undefined team.
  const teamIds = new Set(rankTeams(q, 16).map((t) => t.id));
  const matches = getMatches()
    .filter((m) => teamIds.has(m.homeTeamId) || teamIds.has(m.awayTeamId))
    .map((m) => ({ m, home: getTeam(m.homeTeamId), away: getTeam(m.awayTeamId) }))
    .filter((x): x is { m: Match; home: Team; away: Team } => Boolean(x.home && x.away))
    .slice(0, 6)
    .map(({ m, home, away }) => ({ ...m, home, away }));
  return { teams, players, matches };
}

export type TeamWithForecast = Team & {
  forecast: ReturnType<typeof teamsWithForecast>[number]['forecast'];
};
