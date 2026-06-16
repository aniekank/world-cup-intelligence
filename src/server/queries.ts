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
import { generateInsights, generateDailyBriefing, generateMatchSummary, storylines } from '@/ai/narratives';
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
    .map((p) => getPlayerView(p.id)!)
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
    goldenBoot: eng.goldenBoot.slice(0, 20).map((g) => {
      const v = getPlayerViews().find((p) => p.id === g.playerId);
      return { ...g, player: v ?? null, team: v ? teamMap.get(v.teamId) ?? null : null };
    }),
  };
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
/** Lowercase + strip diacritics so "Mbappé" matches "mbappe". */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Surname-focused, accent-insensitive name match. Handles abbreviated feed
 * names ("T. Weah") and partial queries ("Tim Weah"): matches when the query's
 * surname token prefix-matches the player's surname (≥3 chars to avoid matching
 * single-letter initials), or the whole normalized query is a substring.
 */
function nameMatches(normName: string, normQ: string, qTokens: string[]): boolean {
  // Substring only for queries ≥4 chars, so short ones ("son") don't match mid-name ("Johansson")
  if (normQ.length >= 4 && normName.includes(normQ)) return true;
  const nameTokens = normName.split(/[\s.]+/).filter(Boolean);
  if (!nameTokens.length || !qTokens.length) return false;
  const surnameN = nameTokens[nameTokens.length - 1]!;
  const surnameQ = qTokens[qTokens.length - 1]!;
  return surnameQ.length >= 3 && (surnameN.startsWith(surnameQ) || surnameQ.startsWith(surnameN));
}

export function search(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { teams: [], players: [], matches: [] };
  const nq = norm(q);
  const qTokens = nq.split(/\s+/).filter((t) => t.length >= 2);
  const teams = getTeams()
    .filter((t) => norm(t.name).includes(nq) || t.code.toLowerCase().includes(q))
    .slice(0, 6);
  const playerHits = getPlayerViews()
    .filter((p) => nameMatches(norm(p.name), nq, qTokens))
    .sort((a, b) => b.stats.goals - a.stats.goals)
    .slice(0, 8);
  const matchHits = getMatches()
    .filter((m) => {
      const h = getTeam(m.homeTeamId)!;
      const a = getTeam(m.awayTeamId)!;
      return h.name.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    })
    .slice(0, 6)
    .map((m: Match) => ({ ...m, home: getTeam(m.homeTeamId)!, away: getTeam(m.awayTeamId)! }));
  return { teams, players: playerHits, matches: matchHits };
}

export type TeamWithForecast = Team & {
  forecast: ReturnType<typeof teamsWithForecast>[number]['forecast'];
};
