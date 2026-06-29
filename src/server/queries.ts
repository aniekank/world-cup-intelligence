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
  getPlayer,
  getPlayerViews,
  getPlayerView,
  getSquad,
  getLiveMatches,
  dataset,
  getActiveTournamentId,
  getActiveSource,
} from '@/data/store';
import { engine } from '@/analytics';
import { rankPlayers, rankTeams } from '@/ai/query/resolver';
import { generateInsights, generateDailyBriefing, generateBriefingDeck, generateMatchSummary, storylines } from '@/ai/narratives';
import { criticalMatches, matchPreview } from '@/ai/previews';
import type { Team, TeamView, Match } from '@/domain/types';

/**
 * Lightweight freshness probe for the client auto-refresher + freshness pill.
 * Reads only the cached in-memory snapshot (no provider call), so it's cheap to
 * poll. `generatedAt` is bumped on every live refresh, so the client can show
 * "updated Ns ago" and decide how often to pull fresh page content.
 */
export function liveStatus() {
  const live = getLiveMatches();
  const g = globalThis as unknown as { __wcLiveLoading?: boolean };
  return {
    generatedAt: dataset().generatedAt,
    tournamentId: getActiveTournamentId(),
    source: getActiveSource(),
    isLive: live.length > 0,
    liveCount: live.length,
    // True while the live snapshot is still loading at boot (the app is serving
    // the placeholder simulation until it swaps in).
    loading: !!g.__wcLiveLoading,
  };
}

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

/**
 * Finished matches, newest first, each with its AI recap and goal scorers —
 * powers the Results tab so you can read what happened without opening every game.
 */
export function resultsFeed() {
  return getMatches()
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .map((m) => {
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) return null;
      const scorers = m.events
        .filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_GOAL')
        .sort((a, b) => a.minute - b.minute)
        .map((e) => ({
          name: (e.playerId ? getPlayer(e.playerId)?.name : null) ?? 'Goal',
          minute: e.minute,
          teamId: e.teamId,
          pen: e.type === 'PENALTY_GOAL',
        }));
      let summary = '';
      try {
        summary = generateMatchSummary(m.id);
      } catch {
        /* one bad recap shouldn't drop the whole feed */
      }
      return {
        id: m.id,
        kickoff: m.kickoff,
        stage: m.stage,
        groupId: m.groupId,
        home: { id: home.id, name: home.name, flag: home.flag, code: home.code },
        away: { id: away.id, name: away.name, flag: away.flag, code: away.code },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        penalties: m.penalties,
        scorers,
        summary,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
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
  const matches = getMatches();
  // Real, SETTLED qualification: once the group stage is over and the R32 draw
  // exists, a team is through iff it actually appears in an R32 fixture. Before
  // that, qualification is still a (model) probability. `settled` lets the UI
  // swap the predicted "Q%" for a real "Through / Out" status.
  const groupGames = matches.filter((m) => m.stage === 'GROUP');
  const groupStageComplete = groupGames.length > 0 && groupGames.every((m) => m.status === 'FINISHED');
  const qualifiedIds = new Set<string>();
  for (const m of matches) {
    if (m.stage !== 'GROUP') {
      if (m.homeTeamId) qualifiedIds.add(m.homeTeamId);
      if (m.awayTeamId) qualifiedIds.add(m.awayTeamId);
    }
  }
  const settled = groupStageComplete && qualifiedIds.size > 0;

  return {
    settled,
    groups: getGroups().map((g) => ({
      group: g,
      rows: (eng.standingsByGroup.find((s) => s[0]?.groupId === g.id) ?? [])
        .map((r) => ({ ...r, team: teamMap.get(r.teamId), qualified: qualifiedIds.has(r.teamId) }))
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
/**
 * Sub-heading for the Daily Briefing panel: today's date + where the tournament
 * actually is right now, both derived from the fixtures (not a hardcoded date).
 * "Now" = a live match if one is in play, else the next scheduled match, else
 * the last one played. Only the live edition gets a calendar date — a historical
 * edition just shows its phase.
 */
export function briefingMeta(): { subtitle: string } {
  const matches = getMatches();
  const live = matches.filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  const scheduled = [...matches.filter((m) => m.status === 'SCHEDULED')].sort((a, b) =>
    a.kickoff.localeCompare(b.kickoff),
  );
  const finished = matches.filter((m) => m.status === 'FINISHED');
  const ref = live[0] ?? scheduled[0] ?? finished[finished.length - 1];
  // Once the group stage is over there are no scheduled/live group fixtures left
  // (knockout fixtures are TBD and simulated via the bracket, not in `matches`),
  // so don't keep reporting the last group matchday — call it the knockout stage.
  const groupDone = !live.length && !scheduled.length && finished.length > 0;
  const period = groupDone ? 'Knockout stage' : ref ? stageLabel(ref) : 'Tournament';
  if (getActiveTournamentId() === 'live-2026') {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return { subtitle: `${today} · ${period}` };
  }
  return { subtitle: period };
}

function stageLabel(m: Match): string {
  if (m.stage === 'GROUP') return `Matchday ${m.matchday}`;
  const names: Record<string, string> = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-finals',
    SF: 'Semi-finals',
    THIRD_PLACE: 'Third-place play-off',
    FINAL: 'Final',
  };
  return names[m.stage] ?? 'Knockout stage';
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
  // No single panel's narrative may take down the whole home page — degrade each
  // to an empty/neutral default and log, rather than throw. (WC-040)
  const safe = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (e) {
      console.error('[homeData] panel failed; serving fallback.', e);
      return fallback;
    }
  };
  return {
    competition: getCompetition(),
    briefing: safe(generateDailyBriefing, { headline: 'Tournament briefing', body: 'The live briefing is updating.', bullets: [] }),
    briefingDeck: safe(generateBriefingDeck, []),
    criticalMatches: safe(() => criticalMatchesView(4), []),
    favorites,
    live,
    upcoming,
    topScorers,
    powerTop: eng.powerRankings
      .map((r) => ({ ...r, team: teamMap.get(r.teamId) }))
      .filter((r): r is typeof r & { team: Team } => Boolean(r.team))
      .slice(0, 5),
    insights: safe(() => generateInsights().slice(0, 4), []),
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
