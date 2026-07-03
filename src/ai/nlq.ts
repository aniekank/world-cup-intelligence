/**
 * Natural-language analytics engine (StatMuse-style).
 *
 * A deterministic intent parser over the typed dataset — works fully offline,
 * no API key required. It detects an intent (leaderboard, comparison, team
 * over/under-performance, breakout discovery, knockout path, forecasts, entity
 * lookup), extracts entities (metrics, positions, teams, players), and returns
 * a structured, evidence-backed answer the UI renders as text + table + chart.
 *
 * The same structured output is what would be fed to Claude for prose
 * narration when ANTHROPIC_API_KEY is configured (see ai/narratives.ts).
 */

import { getPlayerViews, getTeams, getTeam, getGroups, getMatches, getTeamMatches } from '@/data/store';
import { engine } from '@/analytics';
import { RUNS } from '@/analytics/simulate';
import { extractPlayers, extractTeam, bestPlayer } from '@/ai/query/resolver';
import { getClubKeyMap, clubMatchKeys, type ClubAffiliation } from '@/data/clubAffiliations';
import { tacticalProfile, tacticalBoard } from '@/server/tactics';
import type { NLQueryResult, PlayerView, Position, Confederation, MatchEvent, MatchStage, Match, BracketNode } from '@/domain/types';

const METRICS: Record<string, { key: string; label: string; per90?: boolean; source: 'stat' | 'per90' }> = {
  xg: { key: 'xG', label: 'xG', source: 'stat' },
  'expected goals': { key: 'xG', label: 'xG', source: 'stat' },
  xa: { key: 'xA', label: 'xA', source: 'stat' },
  'expected assists': { key: 'xA', label: 'xA', source: 'stat' },
  goals: { key: 'goals', label: 'Goals', source: 'stat' },
  scored: { key: 'goals', label: 'Goals', source: 'stat' },
  scorers: { key: 'goals', label: 'Goals', source: 'stat' },
  goalscorers: { key: 'goals', label: 'Goals', source: 'stat' },
  'goal scorers': { key: 'goals', label: 'Goals', source: 'stat' },
  assists: { key: 'assists', label: 'Assists', source: 'stat' },
  playmaker: { key: 'assists', label: 'Assists', source: 'stat' },
  playmakers: { key: 'assists', label: 'Assists', source: 'stat' },
  shots: { key: 'shots', label: 'Shots', source: 'stat' },
  'shots on target': { key: 'shotsOnTarget', label: 'SoT', source: 'stat' },
  'key passes': { key: 'keyPasses', label: 'Key passes', source: 'stat' },
  'progressive passes': { key: 'progressivePasses', label: 'Prog. passes', source: 'stat' },
  'progressive carries': { key: 'progressiveCarries', label: 'Prog. carries', source: 'stat' },
  tackles: { key: 'tackles', label: 'Tackles', source: 'stat' },
  interceptions: { key: 'interceptions', label: 'Interceptions', source: 'stat' },
  'big chances created': { key: 'bigChancesCreated', label: 'Big chances created', source: 'stat' },
  minutes: { key: 'minutes', label: 'Minutes', source: 'stat' },
  saves: { key: 'saves', label: 'Saves', source: 'stat' },
  'clean sheets': { key: 'cleanSheets', label: 'Clean sheets', source: 'stat' },
  shutouts: { key: 'cleanSheets', label: 'Clean sheets', source: 'stat' },
  'yellow cards': { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  yellows: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  'red cards': { key: 'redCards', label: 'Red cards', source: 'stat' },
  bookings: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  booked: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  dirtiest: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  cards: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  fouls: { key: 'foulsCommitted', label: 'Fouls', source: 'stat' },
  'pass accuracy': { key: 'passAccuracy', label: 'Pass %', source: 'per90' },
  'shot conversion': { key: 'shotConversion', label: 'Conversion %', source: 'per90' },
};

const POSITIONS: Record<string, Position> = {
  midfielder: 'MF', midfielders: 'MF', midfield: 'MF', mids: 'MF',
  forward: 'FW', forwards: 'FW', striker: 'FW', strikers: 'FW', attacker: 'FW', attackers: 'FW', winger: 'FW', wingers: 'FW',
  defender: 'DF', defenders: 'DF', 'centre-back': 'DF', 'center-back': 'DF', 'centre backs': 'DF', 'center backs': 'DF',
  'full-back': 'DF', fullback: 'DF', fullbacks: 'DF', backs: 'DF',
  goalkeeper: 'GK', goalkeepers: 'GK', keeper: 'GK', goalie: 'GK',
};

function metricValue(p: PlayerView, m: { key: string; source: 'stat' | 'per90' }, per90: boolean): number {
  if (m.source === 'per90' || per90) {
    return (p.per90[m.key] as number) ?? (p.stats as unknown as Record<string, number>)[m.key] ?? 0;
  }
  return (p.stats as unknown as Record<string, number>)[m.key] ?? 0;
}

// ── Player-scope semantic maps ───────────────────────────────────────────────
// The leaderboard/extreme queries can filter a player pool, but the detector only
// knew team names, codes and a few noun aliases. These maps let a question scope
// the pool by nationality adjective, region/confederation, or club/league, so
// "which spanish player has the most goals" filters to Spain. (WC-059)

// Nationality adjective → the nation as the shared resolver knows it.
const DEMONYMS: Record<string, string> = {
  spanish: 'spain', brazilian: 'brazil', argentine: 'argentina', argentinian: 'argentina',
  german: 'germany', french: 'france', english: 'england', portuguese: 'portugal', italian: 'italy',
  dutch: 'netherlands', belgian: 'belgium', croatian: 'croatia', mexican: 'mexico', american: 'united states',
  japanese: 'japan', korean: 'south korea', 'south korean': 'south korea', moroccan: 'morocco',
  senegalese: 'senegal', ghanaian: 'ghana', nigerian: 'nigeria', egyptian: 'egypt', algerian: 'algeria',
  ivorian: 'ivory coast', cameroonian: 'cameroon', tunisian: 'tunisia', 'south african': 'south africa',
  uruguayan: 'uruguay', colombian: 'colombia', chilean: 'chile', ecuadorian: 'ecuador', peruvian: 'peru',
  paraguayan: 'paraguay', bolivian: 'bolivia', venezuelan: 'venezuela',
  swiss: 'switzerland', austrian: 'austria', polish: 'poland', danish: 'denmark', swedish: 'sweden',
  norwegian: 'norway', serbian: 'serbia', welsh: 'wales', scottish: 'scotland', irish: 'ireland',
  czech: 'czech republic', turkish: 'turkey', ukrainian: 'ukraine', greek: 'greece', russian: 'russia',
  australian: 'australia', canadian: 'canada', 'new zealander': 'new zealand',
  saudi: 'saudi arabia', qatari: 'qatar', iranian: 'iran', iraqi: 'iraq', jordanian: 'jordan', uzbek: 'uzbekistan',
  jamaican: 'jamaica', panamanian: 'panama', 'costa rican': 'costa rica', honduran: 'honduras',
  'cape verdean': 'cape verde', bosnian: 'bosnia', congolese: 'dr congo', curacaoan: 'curacao',
};

// Region / confederation words → confederation code.
const CONFEDERATIONS: Record<string, Confederation> = {
  european: 'UEFA', europe: 'UEFA', uefa: 'UEFA',
  'south american': 'CONMEBOL', 'south america': 'CONMEBOL', conmebol: 'CONMEBOL',
  african: 'CAF', africa: 'CAF', caf: 'CAF',
  asian: 'AFC', asia: 'AFC', afc: 'AFC',
  'north american': 'CONCACAF', 'central american': 'CONCACAF', concacaf: 'CONCACAF',
  oceanian: 'OFC', oceania: 'OFC', ofc: 'OFC',
};
const REGION_LABEL: Record<Confederation, string> = {
  UEFA: 'European', CONMEBOL: 'South American', CONCACAF: 'CONCACAF', CAF: 'African', AFC: 'Asian', OFC: 'Oceanian',
};

type Scope = { filter: (p: PlayerView) => boolean; label: string };

/** A player's club affiliation via the surname+dob crosswalk (live edition only). */
function playerClub(p: PlayerView, keyMap: Map<string, ClubAffiliation>): ClubAffiliation | undefined {
  for (const k of clubMatchKeys(p.fullName ?? p.name, p.birthDate)) { const a = keyMap.get(k); if (a) return a; }
  return undefined;
}

/** The club-affiliation map is loaded async + cached on globalThis. Read it
 *  synchronously (answerQuery is sync); if it isn't warm yet, kick off a load for
 *  next time and skip club scoping this call rather than block. */
function currentClubKeyMap(): Map<string, ClubAffiliation> | null {
  const g = globalThis as unknown as { __wcClubsByKey?: Map<string, ClubAffiliation> };
  if (g.__wcClubsByKey) return g.__wcClubsByKey;
  void getClubKeyMap().catch(() => {}); // warm for next time
  return null;
}

/** A club or league named in the query → a player filter. */
function detectClubScope(lower: string): Scope | null {
  const keyMap = currentClubKeyMap();
  if (!keyMap || !keyMap.size) return null;
  const clubs = new Set<string>();
  const leagues = new Set<string>();
  for (const a of keyMap.values()) { clubs.add(a.club); if (a.leagueShort) leagues.add(a.leagueShort); if (a.league) leagues.add(a.league); }
  const longest = (names: Set<string>): string | null => {
    let best: string | null = null;
    for (const n of names) { const ln = n.toLowerCase(); if (ln.length >= 4 && lower.includes(ln) && (!best || n.length > best.length)) best = n; }
    return best;
  };
  const club = longest(clubs);
  if (club) return { filter: (p) => playerClub(p, keyMap)?.club === club, label: `at ${club}` };
  const league = longest(leagues);
  if (league) return { filter: (p) => { const a = playerClub(p, keyMap); return a?.league === league || a?.leagueShort === league; }, label: `in the ${league}` };
  return null;
}

/** Resolve a player scope from the query: team (name/code/demonym), region/
 *  confederation, or club/league. Used to filter any player leaderboard. */
function detectScope(q: string): Scope | null {
  const lower = q.toLowerCase();
  const team = detectTeam(q);
  if (team) return { filter: (p) => p.teamId === team.id, label: `for ${team.name}` };
  for (const [adj, nation] of Object.entries(DEMONYMS)) {
    if (new RegExp(`\\b${adj}\\b`).test(lower)) { const t = extractTeam(nation); if (t) return { filter: (p) => p.teamId === t.id, label: `for ${t.name}` }; }
  }
  for (const [word, conf] of Object.entries(CONFEDERATIONS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      const ids = new Set(getTeams().filter((t) => t.confederation === conf).map((t) => t.id));
      if (ids.size) return { filter: (p) => ids.has(p.teamId), label: `among ${REGION_LABEL[conf]} teams` };
    }
  }
  return detectClubScope(lower);
}

// ── Stage-scoped, event-derived counting ─────────────────────────────────────
// "which players got red cards in the round of 32" needs two things the aggregate
// leaderboard can't do: filter by match STAGE, and read from the live event
// timeline (the per-player season aggregate lags/omits — e.g. Balogun's R32 red
// card is in the events but not yet his card tally). So for countable events
// (goals, cards, assists) with a stage in the query, we tally straight from the
// match events of that stage. (WC-060)
const KO_STAGES: MatchStage[] = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'];
function detectStage(lower: string): { stages: Set<MatchStage>; label: string } | null {
  if (/round of 32|last 32|\br32\b/.test(lower)) return { stages: new Set(['R32']), label: 'in the Round of 32' };
  if (/round of 16|last 16|\br16\b/.test(lower)) return { stages: new Set(['R16']), label: 'in the Round of 16' };
  if (/quarter[- ]?final|\bqf\b/.test(lower)) return { stages: new Set(['QF']), label: 'in the quarter-finals' };
  if (/semi[- ]?final|\bsf\b/.test(lower)) return { stages: new Set(['SF']), label: 'in the semi-finals' };
  if (/third[- ]?place/.test(lower)) return { stages: new Set(['THIRD_PLACE']), label: 'in the third-place play-off' };
  if (/knockout|playoff/.test(lower)) return { stages: new Set(KO_STAGES), label: 'in the knockouts' };
  if (/group stage|group phase|\bgroups\b/.test(lower)) return { stages: new Set(['GROUP']), label: 'in the group stage' };
  if (/\bfinal\b/.test(lower)) return { stages: new Set(['FINAL']), label: 'in the final' };
  return null;
}

// metric key → event predicate. Only these are countable from the timeline.
const EVENT_COUNT: Record<string, (e: MatchEvent) => boolean> = {
  goals: (e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') && e.minute <= 120,
  redCards: (e) => e.type === 'RED_CARD' || e.type === 'SECOND_YELLOW',
  yellowCards: (e) => e.type === 'YELLOW_CARD',
  assists: (e) => e.type === 'GOAL' || e.type === 'PENALTY_GOAL',
};

function stageEventLeaderboard(
  q: string,
  metric: { key: string; label: string },
  stage: { stages: Set<MatchStage>; label: string },
  scope: Scope | null,
  pos: Position | null,
): NLQueryResult {
  const counter = EVENT_COUNT[metric.key]!;
  const isAssist = metric.key === 'assists';
  const views = new Map(getPlayerViews().map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const m of getMatches()) {
    if (!stage.stages.has(m.stage)) continue;
    for (const e of m.events ?? []) {
      if (!counter(e)) continue;
      const pid = isAssist ? e.relatedPlayerId : e.playerId;
      if (pid) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
  }
  let ranked = [...counts.entries()]
    .map(([id, v]) => ({ p: views.get(id), v }))
    .filter((x): x is { p: PlayerView; v: number } => !!x.p);
  if (pos) ranked = ranked.filter((x) => x.p.position === pos);
  if (scope) ranked = ranked.filter((x) => scope.filter(x.p));
  ranked.sort((a, b) => b.v - a.v);
  const top = ranked.slice(0, 12);
  const scopeLabel = scope ? ` ${scope.label}` : '';
  const posLabel = pos ? ` ${posName(pos)}` : '';
  const answer = top[0]
    ? `${top[0].p.name} (${top[0].p.team.code}) leads${posLabel} ${metric.label} ${stage.label}${scopeLabel} with ${top[0].v}.`
    : `No ${metric.label.toLowerCase()} recorded ${stage.label}${scopeLabel} yet.`;
  return {
    query: q, intent: 'leaderboard', answer,
    columns: ['#', 'Player', 'Team', metric.label],
    rows: top.map((r, i) => [i + 1, r.p.name, r.p.team.code, r.v]),
    entityType: 'player', vizHint: 'bar',
    followUps: ['Who has the most goals?', 'Most yellow cards in the knockouts', 'Show under-the-radar breakout players'],
  };
}

// Entity detection delegates to the shared resolver (src/ai/query/resolver) — the
// same matcher the search box uses — so a name resolves identically whether it's
// typed into search or named inside a question.
function detectTeam(q: string): { id: string; name: string } | null {
  const t = extractTeam(q);
  return t ? { id: t.id, name: t.name } : null;
}

function detectPlayers(q: string): PlayerView[] {
  return extractPlayers(q, 4);
}

/** All teams named in the query, in order of first appearance (de-duped). */
function detectTeams(q: string): { id: string; name: string }[] {
  const lower = q.toLowerCase();
  const found = getTeams()
    .filter((t) => lower.includes(t.name.toLowerCase()))
    .map((t) => ({ id: t.id, name: t.name }));
  const uniq = [...new Map(found.map((f) => [f.id, f])).values()];
  uniq.sort((a, b) => lower.indexOf(a.name.toLowerCase()) - lower.indexOf(b.name.toLowerCase()));
  return uniq;
}

// Words that don't change a query from being an entity *lookup* ("Messi stats",
// "how is Spain doing"). If, after removing the entity name and these, more than
// one meaningful word remains, the query is really a question we didn't map — so
// fall through to the helpful fallback rather than return the entity's page.
const LOOKUP_FILLER = new Set(['stats', 'statistics', 'stat', 'info', 'information', 'about', 'tell', 'me', 'show', 'give', 'the', 'a', 'an', 'how', 'is', 'are', 'was', 'were', 'doing', 'playing', 'play', 'form', 'profile', 'player', 'team', 'overview', 'on', 'of', 'for', 's', 'this', 'tournament', 'wc', 'world', 'cup', 'please', 'rating', 'ratings', 'numbers', 'number', 'data', 'do', 'does', 'look', 'like', 'whats', 'what']);
function lookupResidual(q: string, name: string): number {
  const nameTokens = new Set(name.toLowerCase().split(/\s+/));
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !nameTokens.has(w) && !LOOKUP_FILLER.has(w)).length;
}

function playerStatQuery(q: string, p: PlayerView, metric: { key: string; label: string; source: 'stat' | 'per90' }): NLQueryResult {
  const lower = q.toLowerCase();
  const per90 = metric.source === 'per90' || lower.includes('per 90') || lower.includes('per90');
  const minMinutes = per90 ? 180 : 1;
  const val = metricValue(p, metric, per90);
  const pool = getPlayerViews().filter((x) => x.stats.minutes >= minMinutes);
  const ranked = [...pool].sort((a, b) => metricValue(b, metric, per90) - metricValue(a, metric, per90));
  const rank = ranked.findIndex((x) => x.id === p.id) + 1;
  const suffix = per90 ? ' per 90' : '';
  const rankClause = rank > 0 ? ` — ${rank === 1 ? 'the most' : `#${rank} of ${pool.length}`} at the tournament` : '';
  const cmp = ranked[0]?.id === p.id ? ranked[1] : ranked[0];
  return {
    query: q, intent: 'player-stat',
    answer: `${p.name} (${p.team.code}) has ${fmt(val)} ${metric.label}${suffix}${rankClause}.`,
    columns: ['Player', 'Team', metric.label + suffix, 'Rank', 'Mins'],
    rows: [[p.name, p.team.code, fmt(val), rank > 0 ? `#${rank}` : '—', p.stats.minutes]],
    entityType: 'player', vizHint: 'table',
    followUps: [`Highest ${metric.label}${suffix}`, cmp ? `Compare ${p.name} and ${cmp.name}` : `${p.name} stats`, `${p.name} stats`].filter((v, i, a) => a.indexOf(v) === i),
  };
}

function teamCompareQuery(q: string, a: { id: string; name: string }, b: { id: string; name: string }): NLQueryResult {
  const eng = engine();
  const pa = eng.powerRankings.find((r) => r.teamId === a.id);
  const pb = eng.powerRankings.find((r) => r.teamId === b.id);
  const fa = eng.forecasts.get(a.id);
  const fb = eng.forecasts.get(b.id);
  if (!pa || !pb || !fa || !fb) {
    return { query: q, intent: 'team-comparison', answer: `I can't compare ${a.name} and ${b.name} yet — one has no model rating.`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps: ['Who is most likely to win the tournament?'] };
  }
  const pctf = (n: number) => `${Math.round(n * 100)}%`;
  const edge = pa.powerRating >= pb.powerRating ? a : b;
  return {
    query: q, intent: 'team-comparison',
    answer: `${edge.name} grade higher on the model — power ${pa.powerRating} vs ${pb.powerRating}, title ${pctf(fa.winTitle)} vs ${pctf(fb.winTitle)}.`,
    columns: ['Metric', a.name, b.name],
    rows: [
      ['Power rating', pa.powerRating, pb.powerRating],
      ['Win title', pctf(fa.winTitle), pctf(fb.winTitle)],
      ['Reach final', pctf(fa.reachFinal), pctf(fb.reachFinal)],
      ['Offense', pa.offenseRating, pb.offenseRating],
      ['Defense', pa.defenseRating, pb.defenseRating],
      ['Momentum', signed(pa.momentum), signed(pb.momentum)],
    ],
    entityType: 'team', vizHint: 'table',
    followUps: [`${a.name}'s playing style`, `${b.name}'s playing style`, 'Who is most likely to win the tournament?'],
  };
}

function coachQuery(q: string, team: { id: string; name: string }): NLQueryResult {
  const t = getTeam(team.id);
  const name = t?.coach?.name ?? (t?.manager && t.manager !== '—' ? t.manager : null);
  const followUps = [`${team.name}'s playing style`, 'Who is most likely to win the tournament?'];
  if (!name) {
    return { query: q, intent: 'coach', answer: `The manager for ${team.name} isn't recorded in this edition's data.`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps };
  }
  const age = t?.coach?.age && t.coach.age > 0 ? `, age ${t.coach.age}` : '';
  return { query: q, intent: 'coach', answer: `${team.name} are managed by ${name}${age}.`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps };
}

function groupStandingsQuery(q: string): NLQueryResult {
  const lower = q.toLowerCase();
  const groups = getGroups();
  const m = lower.match(/group\s+([a-l])\b/);
  let group = m ? groups.find((g) => g.id.toLowerCase() === m[1]) : undefined;
  if (!group) { const tm = detectTeam(q); if (tm) group = groups.find((g) => g.teamIds.includes(tm.id)); }
  if (!group) {
    const last = groups.length ? groups[groups.length - 1]!.id : 'L';
    return { query: q, intent: 'group-standings', answer: `Which group? Try "Group B standings" — the field runs Groups A–${last}.`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps: ['Group A standings', 'Group B standings', 'Group C standings'] };
  }
  const rows = engine().standingsByGroup.find((rs) => rs[0]?.groupId === group!.id) ?? [];
  const top = rows[0] ? getTeam(rows[0].teamId) : undefined;
  return {
    query: q, intent: 'group-standings',
    answer: top && rows[0] ? `${top.name} ${knockoutsBegun() ? 'won' : 'top'} ${group.name} with ${rows[0].points} pts from ${rows[0].played}.` : `${group.name} hasn't kicked off yet.`,
    columns: ['#', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts', ''],
    rows: rows.map((r) => { const t = getTeam(r.teamId); return [r.rank, t ? `${t.flag} ${t.name}` : r.teamId, r.played, r.won, r.drawn, r.lost, signed(r.goalDifference), r.points, r.status ?? '']; }),
    entityType: 'team', vizHint: 'table',
    followUps: ['Who is most likely to win the tournament?', 'Which teams are outperforming expectations?'],
  };
}

function fixtureKick(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
function fixtureQuery(q: string): NLQueryResult {
  const lower = q.toLowerCase();
  const todayOnly = /\btoday\b|\btonight\b/.test(lower); // "who plays today" should mean today, not the next 8 (WC-065)
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (m: Match) => m.kickoff.slice(0, 10) === today;
  const upNext = (m: Match) => m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'HALFTIME';

  const team = detectTeam(q);
  if (team) {
    const next = getTeamMatches(team.id).filter(upNext).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
    if (todayOnly) {
      const answer = next && isToday(next)
        ? `Yes — ${team.name} play ${getTeam(next.homeTeamId === team.id ? next.awayTeamId : next.homeTeamId)?.name ?? '?'} today (${fixtureKick(next.kickoff)}).`
        : `${team.name} do not play today.`;
      return { query: q, intent: 'fixture', answer, columns: [], rows: [], entityType: 'match', vizHint: 'none', followUps: [`When does ${team.name} play next?`, 'Who plays today?'] };
    }
    if (!next) {
      return { query: q, intent: 'fixture', answer: `${team.name} have no upcoming fixtures in the data — their group games are done (knockout ties are drawn once the group stage finishes).`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps: [`${team.name}'s playing style`, 'Who is most likely to win the tournament?'] };
    }
    const opp = getTeam(next.homeTeamId === team.id ? next.awayTeamId : next.homeTeamId);
    const venue = next.venue && next.venue !== 'TBD' ? ` at ${next.venue}` : '';
    return { query: q, intent: 'fixture', answer: `${team.name} next play ${opp?.name ?? '?'} on ${fixtureKick(next.kickoff)}${venue}.`, columns: [], rows: [], entityType: 'match', vizHint: 'none', followUps: [`${team.name}'s playing style`, opp ? `${opp.name}'s playing style` : 'Who is most likely to win the tournament?'] };
  }
  let pool = getMatches().filter(upNext).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (todayOnly) pool = pool.filter(isToday);
  const upcoming = pool.slice(0, todayOnly ? 24 : 8);
  if (upcoming.length === 0) {
    return { query: q, intent: 'fixture', answer: todayOnly ? 'No matches are scheduled for today.' : 'No upcoming fixtures are scheduled in the data right now.', columns: [], rows: [], entityType: 'match', vizHint: 'none', followUps: ['Who is most likely to win the tournament?'] };
  }
  return {
    query: q, intent: 'fixture', answer: todayOnly ? `Today's ${upcoming.length} match${upcoming.length === 1 ? '' : 'es'}:` : `The next ${upcoming.length} fixtures:`,
    columns: ['Match', 'Kickoff', 'Stage'],
    rows: upcoming.map((mm) => { const h = getTeam(mm.homeTeamId), a = getTeam(mm.awayTeamId); return [`${h?.flag ?? ''} ${h?.name ?? '?'} v ${a?.name ?? '?'} ${a?.flag ?? ''}`.trim(), fixtureKick(mm.kickoff), mm.stage === 'GROUP' ? `MD${mm.matchday}` : mm.stage]; }),
    entityType: 'match', vizHint: 'table',
    followUps: ['When does Brazil play next?', 'Who is most likely to win the tournament?'],
  };
}

function extremeQuery(q: string, field: 'age' | 'heightCm', dir: 'min' | 'max'): NLQueryResult {
  const pos = findPosition(q.toLowerCase());
  const scope = detectScope(q);
  const valOf = (p: PlayerView) => (field === 'age' ? p.age : p.heightCm);
  const valid = (p: PlayerView) => (field === 'age' ? p.age >= 14 && p.age <= 55 : p.heightCm >= 140 && p.heightCm <= 220);
  let pool = getPlayerViews().filter((p) => valid(p) && p.stats.minutes >= 1);
  if (pos) pool = pool.filter((p) => p.position === pos);
  if (scope) pool = pool.filter(scope.filter);
  const intent = field === 'age' ? 'age' : 'height';
  if (pool.length === 0) {
    return { query: q, intent, answer: `Player ${field === 'age' ? 'ages' : 'heights'} aren't available for this edition.`, columns: [], rows: [], entityType: 'player', vizHint: 'none', followUps: ['Who has the most goals?', 'Show under-the-radar breakout players'] };
  }
  const sorted = [...pool].sort((a, b) => (dir === 'min' ? valOf(a) - valOf(b) : valOf(b) - valOf(a))).slice(0, 10);
  const lead = sorted[0]!;
  const word = field === 'age' ? (dir === 'min' ? 'youngest' : 'oldest') : (dir === 'min' ? 'shortest' : 'tallest');
  const show = (p: PlayerView) => (field === 'age' ? `${p.age}` : `${p.heightCm}cm`);
  return {
    query: q, intent,
    answer: `${lead.name} (${lead.team.code}) is the ${word}${pos ? ` ${posName(pos)}` : ''}${scope ? ` ${scope.label}` : ' on the pitch'} at ${show(lead)}.`,
    columns: ['#', 'Player', 'Team', field === 'age' ? 'Age' : 'Height'],
    rows: sorted.map((p, i) => [i + 1, p.name, p.team.code, show(p)]),
    entityType: 'player', vizHint: 'table',
    followUps: ['Who has the most goals?', 'Show under-the-radar breakout players'],
  };
}

export function answerQuery(rawQuery: string): NLQueryResult {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  // ── Comparison: "compare X and Y" / "X vs Y" ──
  const players = detectPlayers(q);
  if ((lower.includes('compare') || lower.includes(' vs ') || lower.includes(' versus ')) && players.length >= 2) {
    return comparePlayers(q, players.slice(0, 2));
  }

  // ── Team comparison: "Spain vs France", "is Brazil better than Argentina" ──
  if (lower.includes('compare') || lower.includes(' vs ') || lower.includes(' versus ') || lower.includes('better than') || lower.includes('stronger than') || lower.includes(' or ')) {
    const teams = detectTeams(q);
    if (teams.length >= 2) return teamCompareQuery(q, teams[0]!, teams[1]!);
  }

  // ── Team over/under-performance ──
  if (
    (lower.includes('outperform') || lower.includes('overperform') || lower.includes('exceeding') || lower.includes('above expectation')) ||
    (lower.includes('expectation') && !lower.includes('under'))
  ) {
    return teamPerformanceQuery(q, 'over');
  }
  if (lower.includes('underperform') || lower.includes('disappoint') || lower.includes('below expectation')) {
    return teamPerformanceQuery(q, 'under');
  }

  // ── Breakout / under-the-radar players ──
  if (lower.includes('breakout') || lower.includes('under-the-radar') || lower.includes('under the radar') || lower.includes('hidden gem') || lower.includes('rising')) {
    return breakoutQuery(q);
  }

  // ── Comebacks: teams that came from behind to win (WC-068) ──
  if (lower.includes('comeback') || lower.includes('came from behind') || lower.includes('come from behind') || lower.includes('came back to win') || lower.includes('fought back') || lower.includes('from behind')) {
    return comebackQuery(q);
  }

  // ── Won against the run of play / with less possession (before tactics, which
  //    owns the bare word "possession"). (WC-068) ──
  if (
    lower.includes('against the run of play') || lower.includes('run of play') || lower.includes('smash and grab') || lower.includes('without the ball') ||
    (lower.includes('possession') && (lower.includes('less') || lower.includes('least') || lower.includes('fewer') || lower.includes('disadvantage') || lower.includes('despite') || lower.includes('without') || lower.includes('minority')))
  ) {
    return possessionUpsetQuery(q);
  }

  // ── Easiest / hardest path (check HARDEST first — it also matches the generic
  //    "path"+"final" catch-all below, which would otherwise steal it). (WC-064) ──
  if (lower.includes('hardest path') || lower.includes('toughest path') || (lower.includes('path') && lower.includes('final') && (lower.includes('hard') || lower.includes('tough')))) {
    return pathQuery(q, 'hard');
  }
  if (lower.includes('easiest path') || lower.includes('easy path') || (lower.includes('path') && lower.includes('final'))) {
    return pathQuery(q, 'easy');
  }

  // ── Title / who will win (incl. "odds"/"chances to win") ──
  if (
    // "most likely to win the golden boot" is a scorer race, not the title. (WC-064)
    !lower.includes('golden boot') && !lower.includes('scorer') &&
    (
      (lower.includes('win') && (lower.includes('tournament') || lower.includes('world cup') || lower.includes('title') || lower.includes('trophy'))) ||
      lower.includes('favourite') || lower.includes('favorite') || lower.includes('most likely to win') ||
      ((lower.includes('odds') || lower.includes('chance')) && (lower.includes('win') || lower.includes('title') || lower.includes('trophy') || !!detectTeam(q)))
    )
  ) {
    return titleQuery(q);
  }

  // ── Strongest attack / defense ──
  if (lower.includes('strongest attack') || lower.includes('best attack') || lower.includes('best offense')) {
    return teamUnitQuery(q, 'offense');
  }
  if (lower.includes('strongest defense') || lower.includes('best defense') || lower.includes('best defence') || lower.includes('meanest defense')) {
    return teamUnitQuery(q, 'defense');
  }

  // ── Golden boot ──
  if (lower.includes('golden boot') || lower.includes('top scorer') || lower.includes('most goals')) {
    // A scoped or positional "most goals" ("which Spanish player…", "top scoring
    // midfielder") is a filtered goals leaderboard, not the global golden-boot
    // race. Route it to the leaderboard so the scope/position actually applies. (WC-059)
    if (detectScope(q) || findPosition(lower)) return leaderboardQuery(q, METRICS['goals']!);
    return goldenBootQuery(q);
  }

  // ── Group standings: "who tops group B", "Group A table" ──
  if ((/group\s+[a-l]\b/.test(lower)) || ((lower.includes('standing') || lower.includes('table') || lower.includes('group')) && (lower.includes('top') || lower.includes('lead') || lower.includes('standing') || lower.includes('table')))) {
    return groupStandingsQuery(q);
  }

  // ── Fixtures / schedule: "when does X play next", "next fixtures" ──
  if (lower.includes('next match') || lower.includes('next game') || lower.includes('next fixture') || lower.includes('fixtures') || lower.includes('schedule') || ((lower.includes('when') || lower.includes('next')) && lower.includes('play')) || ((lower.includes('today') || lower.includes('tonight')) && (lower.includes('play') || lower.includes('fixture') || lower.includes('match')))) {
    return fixtureQuery(q);
  }

  // ── Coach / manager of a team (before tactics, which owns the 'coach' word) ──
  if ((lower.includes('coach') || lower.includes('manager') || lower.includes('manages') || lower.includes('in charge')) ) {
    const team = detectTeam(q);
    if (team) return coachQuery(q, team);
  }

  // ── Tactics / playing style ──
  if (/tactic|playing style|style of play|\bstyle\b|\bpress\b|pressing|possession|formation|build-?up|counter-?attack|coach|manager/.test(lower)) {
    return tacticsQuery(q);
  }

  // ── Player extremes: youngest / oldest / tallest / shortest ──
  if (lower.includes('youngest')) return extremeQuery(q, 'age', 'min');
  if (lower.includes('oldest')) return extremeQuery(q, 'age', 'max');
  if (lower.includes('tallest')) return extremeQuery(q, 'heightCm', 'max');
  if (lower.includes('shortest')) return extremeQuery(q, 'heightCm', 'min');

  // ── Metric for a specific named player ("how many goals has Mbappe scored",
  //    "Messi xG") → that player's value + rank, not a leaderboard. ──
  const metric = findMetric(lower);
  if (metric) {
    const namedPlayer = bestPlayer(q);
    if (namedPlayer) return playerStatQuery(q, namedPlayer, metric);
    return leaderboardQuery(q, metric);
  }

  // ── A team's players at a position: "who is England's goalkeeper", "Belgium's
  //    strikers", "tell me about Congo's keeper". Team + position, no metric. ──
  {
    const teamForPos = detectTeam(q);
    const posForTeam = findPosition(lower);
    if (teamForPos && posForTeam) return teamPositionQuery(q, teamForPos.id, posForTeam);
  }

  // ── Topics we genuinely don't hold data for → say so, don't mis-route ──
  if (/injur|fitness|suspend|\bbanned\b|transfer|\bsigning\b|\bsold\b|salary|wage|contract|ticket|broadcast|kit\b|jersey/.test(lower)) {
    return {
      query: q, intent: 'unsupported',
      answer: "I don't track that here. I can answer analytics questions — metric leaderboards, team/player comparisons, forecasts and title odds, group standings, fixtures, tactical styles, and breakout players.",
      columns: [], rows: [], entityType: 'tournament', vizHint: 'none',
      followUps: ['Who is most likely to win the tournament?', 'Which teams press the highest?', 'Show under-the-radar breakout players'],
    };
  }

  // ── Entity lookups — only when the query is actually *about* that entity
  //    (mostly just the name), so an unhandled question that merely mentions a
  //    team/player falls through to the helpful fallback instead of a wrong page. ──
  const topPlayer = bestPlayer(q);
  if (topPlayer && lookupResidual(q, topPlayer.name) <= 1) return playerLookup(q, topPlayer);
  const team = detectTeam(q);
  if (team && lookupResidual(q, team.name) <= 1) return teamLookup(q, team.id);

  // ── Fallback ──
  return {
    query: q,
    intent: 'unknown',
    answer:
      "I couldn't map that to a specific analytic. Try asking about a metric leaderboard, a comparison, over/under-performing teams, breakout players, or knockout paths.",
    columns: [],
    rows: [],
    entityType: 'tournament',
    vizHint: 'none',
    followUps: [
      'Who has the highest xG among midfielders?',
      'Which teams are outperforming pre-tournament expectations?',
      'Show under-the-radar breakout players',
      'Which team has the easiest path to the final?',
    ],
  };
}

function findMetric(lower: string): { key: string; label: string; source: 'stat' | 'per90' } | null {
  // Prefer longer keys first (e.g. "expected goals" before "goals")
  const keys = Object.keys(METRICS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (lower.includes(k)) return METRICS[k]!;
  }
  return null;
}

function findPosition(lower: string): Position | null {
  for (const [k, v] of Object.entries(POSITIONS)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

function leaderboardQuery(q: string, metric: { key: string; label: string; source: 'stat' | 'per90' }): NLQueryResult {
  const lower = q.toLowerCase();
  const pos = findPosition(lower);
  const scope = detectScope(q);
  const asc = /\bfewest\b|\bleast\b|\blowest\b|\bbottom\b/.test(lower); // ascending sort (WC-059)
  const per90 = lower.includes('per 90') || lower.includes('per90');
  const minMinutes = per90 ? 180 : 1;

  // Stage-scoped countable events (goals / cards / assists "in the round of 32")
  // → tally straight from the timeline, which the season aggregate can't do. (WC-060)
  const stage = detectStage(lower);
  if (stage && EVENT_COUNT[metric.key] && !per90) return stageEventLeaderboard(q, metric, stage, scope, pos);

  let pool = getPlayerViews().filter((p) => p.stats.minutes >= minMinutes);
  if (pos) pool = pool.filter((p) => p.position === pos);
  if (scope) pool = pool.filter(scope.filter);

  const ranked = pool
    .map((p) => ({ p, v: metricValue(p, metric, per90) }))
    .sort((a, b) => (asc ? a.v - b.v : b.v - a.v))
    .slice(0, 10);

  const top = ranked[0];
  const noun = pos ? `${posName(pos)}s` : 'players';
  const scopeLabel = scope ? ` ${scope.label}` : '';
  // A descending leaderboard whose leader sits on 0 means nobody has any — say so
  // rather than crowning someone "with 0" (e.g. clean sheets not yet in the feed). (WC-064)
  const noData = !!top && !asc && top.v === 0;
  const answer = !top
    ? 'No players match that filter yet.'
    : noData
      ? `No ${metric.label.startsWith('x') ? metric.label : metric.label.toLowerCase()}${scopeLabel} recorded yet.`
      : asc
        ? `${top.p.name} (${top.p.team.code}) has the fewest ${metric.label}${scopeLabel} at ${fmt(top.v)}${per90 ? ' per 90' : ''}.`
        : `${top.p.name} (${top.p.team.code}) leads all ${noun}${scopeLabel} with ${fmt(top.v)} ${metric.label}${per90 ? ' per 90' : ''}.`;

  return {
    query: q,
    intent: 'leaderboard',
    answer,
    columns: ['#', 'Player', 'Team', metric.label + (per90 ? '/90' : ''), 'Mins'],
    rows: noData ? [] : ranked.map((r, i) => [i + 1, r.p.name, r.p.team.code, fmt(r.v), r.p.stats.minutes]),
    entityType: 'player',
    vizHint: 'bar',
    followUps: [
      `Compare ${ranked[0]?.p.name} and ${ranked[1]?.p.name}`,
      `Highest ${metric.label} per 90${pos ? ' among ' + posName(pos) + 's' : ''}`,
      'Show under-the-radar breakout players',
    ],
  };
}

function tacticsQuery(q: string): NLQueryResult {
  const lower = q.toLowerCase();
  const team = detectTeam(q);
  const followUps = ['Which teams press the highest?', 'Most possession-dominant teams', "Spain's playing style"];

  // ── A named team → that team's tactical identity ──
  if (team) {
    const p = tacticalProfile(team.id);
    const t = getTeam(team.id);
    const coach = t?.coach?.name ?? (t?.manager && t.manager !== '—' ? t.manager : undefined);
    if (!p.available || !p.label) {
      return {
        query: q, intent: 'tactics',
        answer: `No tactical read for ${team.name} yet — it needs a finished match carrying the underlying possession/passing data.`,
        columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps,
      };
    }
    const shape = p.formation ? ` Most-used shape: ${p.formation}.` : '';
    const who = coach ? `${team.name} (coach ${coach})` : team.name;
    const rows = (p.bars ?? []).map((b) => [b.label, `${Math.round(b.value)}${b.suffix ?? ''}`]);
    return {
      query: q, intent: 'tactics',
      answer: `${who}: ${p.label}. ${p.blurb}${shape}`,
      columns: rows.length ? ['Metric', 'Value'] : [],
      rows,
      entityType: 'team', vizHint: rows.length ? 'table' : 'none',
      followUps: [`How ${team.name} compare on pressing`, 'Tactical styles across the tournament', 'Most possession-dominant teams'],
    };
  }

  // ── Otherwise → a tactical-styles board across the field ──
  const board = tacticalBoard().filter((r) => r.possession !== null || r.press !== null);
  if (board.length === 0) {
    return {
      query: q, intent: 'tactics',
      answer: 'No team-level tactical data yet — playing styles surface once teams have finished matches with possession and pressing data.',
      columns: [], rows: [], entityType: 'team', vizHint: 'none',
      followUps: ['Who is most likely to win the tournament?', 'Strongest defense in the tournament'],
    };
  }
  const byPress = /\bpress\b|pressing/.test(lower);
  const byPoss = /possession|control the ball|dominant/.test(lower);
  let sorted = board;
  let lead: 'press' | 'possession' | 'mixed' = 'mixed';
  if (byPress) { sorted = board.filter((r) => r.press !== null).sort((a, b) => b.press! - a.press!); lead = 'press'; }
  else if (byPoss) { sorted = board.filter((r) => r.possession !== null).sort((a, b) => b.possession! - a.possession!); lead = 'possession'; }
  else { sorted = [...board].sort((a, b) => (b.press ?? 0) - (a.press ?? 0)); }

  const top = sorted[0];
  const topName = top ? getTeam(top.teamId)?.name ?? top.teamId : '';
  const answer = !top
    ? 'Tactical identities across the field:'
    : lead === 'possession'
      ? `${topName} are the most possession-dominant side (${top.possession}%), a ${top.style.toLowerCase()} team. Tactical identities across the field:`
      : lead === 'press'
        ? `${topName} press the highest (index ${top.press}/100), a ${top.style.toLowerCase()} side. Tactical identities across the field:`
        : `Tactical identities across the field — ${topName} lead the press (${top.press}/100):`;

  const rows = sorted.slice(0, 12).map((r, i) => {
    const t = getTeam(r.teamId);
    return [
      i + 1,
      t ? `${t.flag} ${t.name}` : r.teamId,
      r.style,
      r.possession !== null ? `${r.possession}%` : '—',
      r.press !== null ? String(r.press) : '—',
      r.formation ?? '—',
    ];
  });
  return {
    query: q, intent: 'tactics', answer,
    columns: ['#', 'Team', 'Style', 'Poss.', 'Press', 'Shape'],
    rows, entityType: 'team', vizHint: 'table',
    followUps: ['Which teams press the highest?', 'Most possession-dominant teams', "Brazil's playing style"],
  };
}

function comparePlayers(q: string, pair: PlayerView[]): NLQueryResult {
  const a = pair[0]!;
  const b = pair[1]!;
  const fields: { key: string; label: string; per90?: boolean }[] = [
    { key: 'goals', label: 'Goals' },
    { key: 'assists', label: 'Assists' },
    { key: 'xG', label: 'xG' },
    { key: 'xA', label: 'xA' },
    { key: 'shots', label: 'Shots' },
    { key: 'keyPasses', label: 'Key passes' },
    { key: 'progressivePasses', label: 'Prog. passes' },
    { key: 'minutes', label: 'Minutes' },
  ];
  const av = a.stats as unknown as Record<string, number>;
  const bv = b.stats as unknown as Record<string, number>;
  const rows = fields.map((f) => [f.label, fmt(av[f.key] ?? 0), fmt(bv[f.key] ?? 0)]);
  const aInv = a.stats.goals + a.stats.assists;
  const bInv = b.stats.goals + b.stats.assists;
  const edge = aInv >= bInv ? a : b;
  return {
    query: q,
    intent: 'comparison',
    answer: `${a.name} vs ${b.name}: ${edge.name} has the greater direct goal involvement so far (${edge.stats.goals}G ${edge.stats.assists}A).`,
    columns: ['Metric', a.team.code + ' ' + a.name.split(' ').slice(-1), b.team.code + ' ' + b.name.split(' ').slice(-1)],
    rows,
    entityType: 'player',
    vizHint: 'table',
    followUps: [`${a.name} radar profile`, `${b.name} scouting report`, 'Highest xG among forwards'],
  };
}

function teamPerformanceQuery(q: string, dir: 'over' | 'under'): NLQueryResult {
  const eng = engine();
  const teams = getTeams()
    .map((t) => ({ t, f: eng.forecasts.get(t.id)! }))
    .filter((x) => x.f)
    .sort((a, b) => (dir === 'over' ? b.f.titleProbabilityDelta - a.f.titleProbabilityDelta : a.f.titleProbabilityDelta - b.f.titleProbabilityDelta))
    .slice(0, 8);
  const lead = teams[0]!;
  return {
    query: q,
    intent: dir === 'over' ? 'overperformance' : 'underperformance',
    answer:
      dir === 'over'
        ? `${lead.t.name} are the tournament's biggest overachievers — their title probability has risen ${pct(lead.f.titleProbabilityDelta)} above the pre-tournament market.`
        : `${lead.t.name} are underperforming most — title probability down ${pct(-lead.f.titleProbabilityDelta)} from pre-tournament expectations.`,
    columns: ['Team', 'Pre-WC title%', 'Now title%', 'Δ', 'Reach SF%'],
    rows: teams.map((x) => [
      `${x.t.flag} ${x.t.name}`,
      pct(x.t.preTournamentTitleOdds),
      pct(x.f.winTitle),
      (x.f.titleProbabilityDelta >= 0 ? '+' : '') + pct(x.f.titleProbabilityDelta),
      pct(x.f.reachSF),
    ]),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Which team has the easiest path to the final?', 'Strongest attack in the tournament', 'Who is most likely to win the tournament?'],
  };
}

function breakoutQuery(q: string): NLQueryResult {
  const pool = getPlayerViews().filter((p) => p.age >= 17 && p.age <= 23 && p.position !== 'GK' && p.stats.minutes >= 90);
  const ranked = pool
    .map((p) => ({
      p,
      score: (p.stats.goals * 3 + p.stats.assists * 2 + p.stats.xG + p.stats.xA) / Math.max(p.marketValueEur, 5) + p.stats.formIndex / 50,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const lead = ranked[0]?.p;
  // Market value is only populated on the seeded edition — drop the clause and
  // the column on live/historical rather than showing "€0m". (WC-026)
  const hasVal = ranked.some((r) => r.p.marketValueEur > 0);
  return {
    query: q,
    intent: 'breakout',
    answer: lead
      ? `${lead.name} (${lead.team.code}, age ${lead.age}) is the standout breakout — ${lead.stats.goals}G ${lead.stats.assists}A${hasVal ? ` on a €${lead.marketValueEur}m valuation` : ''} with a ${lead.stats.formIndex} form index.`
      : 'No breakout candidates yet.',
    columns: ['Player', 'Team', 'Age', 'G', 'A', 'xG+xA', 'Form', ...(hasVal ? ['€m'] : [])],
    rows: ranked.map((r) => [
      r.p.name,
      r.p.team.code,
      r.p.age,
      r.p.stats.goals,
      r.p.stats.assists,
      fmt(r.p.stats.xG + r.p.stats.xA),
      r.p.stats.formIndex,
      ...(hasVal ? [r.p.marketValueEur] : []),
    ]),
    entityType: 'player',
    vizHint: 'scatter',
    followUps: ['Highest xG among forwards', 'Compare the top two breakout players', 'Golden Boot projection'],
  };
}

// Did the winner come from behind? Uses the goal timeline when present (was the
// winner ever behind on the running score?), else falls back to the halftime
// score (trailed at the break). Shootout kicks (minute>120) excluded; own goals
// credit the other side. Returns the overturned deficit, or null. (WC-068)
function trailedThenWon(m: Match): { winnerId: string; deficit: number } | null {
  const hWon = m.homeScore > m.awayScore, aWon = m.awayScore > m.homeScore;
  if (!hWon && !aWon) return null; // level (incl. penalty-decided ties) — not a from-behind *win*
  const winnerHome = hWon;
  const winnerId = winnerHome ? m.homeTeamId : m.awayTeamId;
  const goals = (m.events ?? [])
    .filter((e) => (e.type === 'GOAL' || e.type === 'PENALTY_GOAL' || e.type === 'OWN_GOAL') && e.minute <= 120)
    .sort((a, b) => a.minute - b.minute);
  if (goals.length) {
    let h = 0, a = 0, deficit = 0, behind = false;
    for (const e of goals) {
      const scorer = e.type === 'OWN_GOAL' ? (e.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId) : e.teamId;
      if (scorer === m.homeTeamId) h++; else a++;
      const ws = winnerHome ? h : a, os = winnerHome ? a : h;
      if (ws < os) { behind = true; deficit = Math.max(deficit, os - ws); }
    }
    return behind ? { winnerId, deficit } : null;
  }
  const wHT = winnerHome ? m.homeScoreHT : m.awayScoreHT;
  const oHT = winnerHome ? m.awayScoreHT : m.homeScoreHT;
  return wHT < oHT ? { winnerId, deficit: oHT - wHT } : null;
}

const stageCell = (s: MatchStage) => (s === 'GROUP' ? 'Group' : STAGE_LABEL[s]);

function comebackQuery(q: string): NLQueryResult {
  const rows: { name: string; cell: string; opp: string; ht: string; ft: string; stage: MatchStage; deficit: number; kickoff: string }[] = [];
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const c = trailedThenWon(m);
    if (!c) continue;
    const winnerHome = c.winnerId === m.homeTeamId;
    const w = getTeam(c.winnerId), opp = getTeam(winnerHome ? m.awayTeamId : m.homeTeamId);
    // Scores from the winner's perspective so "won 2-1" always reads as a win. (WC-068)
    const wFT = winnerHome ? m.homeScore : m.awayScore, oFT = winnerHome ? m.awayScore : m.homeScore;
    const wHT = winnerHome ? m.homeScoreHT : m.awayScoreHT, oHT = winnerHome ? m.awayScoreHT : m.homeScoreHT;
    rows.push({
      name: w?.name ?? c.winnerId, cell: w ? `${w.flag} ${w.name}` : c.winnerId, opp: opp?.name ?? '?',
      ht: `${wHT}-${oHT}`, ft: `${wFT}-${oFT}`,
      stage: m.stage, deficit: c.deficit, kickoff: m.kickoff,
    });
  }
  rows.sort((a, b) => b.deficit - a.deficit || b.kickoff.localeCompare(a.kickoff));
  const top = rows[0];
  return {
    query: q, intent: 'comebacks',
    answer: top
      ? `${rows.length} side${rows.length === 1 ? '' : 's'} have come from behind to win. The biggest: ${top.name} overturned a ${top.deficit}-goal deficit to win ${top.ft} against ${top.opp} in the ${stageCell(top.stage).toLowerCase() === 'group' ? 'group stage' : STAGE_LABEL[top.stage]}.`
      : 'No come-from-behind wins recorded yet.',
    columns: ['Winner', 'Opponent', 'HT', 'FT', 'Stage'],
    rows: rows.slice(0, 12).map((r) => [r.cell, r.opp, r.ht, r.ft, stageCell(r.stage)]),
    entityType: 'match', vizHint: 'table',
    followUps: ['Who won with less possession?', 'Which team has the easiest path to the final?', 'Who is most likely to win the tournament?'],
  };
}

function possessionUpsetQuery(q: string): NLQueryResult {
  const possOf = (m: Match, id: string): number | null => m.teamStats?.[id]?.possession ?? null;
  const rows: { name: string; cell: string; opp: string; poss: number; ft: string; stage: MatchStage }[] = [];
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const winnerId = m.homeScore > m.awayScore ? m.homeTeamId : m.awayScore > m.homeScore ? m.awayTeamId : null;
    if (!winnerId) continue;
    const pw = possOf(m, winnerId);
    if (pw === null || pw >= 50) continue; // won with a minority of the ball
    const winnerHome = winnerId === m.homeTeamId;
    const w = getTeam(winnerId), opp = getTeam(winnerHome ? m.awayTeamId : m.homeTeamId);
    const wFT = winnerHome ? m.homeScore : m.awayScore, oFT = winnerHome ? m.awayScore : m.homeScore; // winner-perspective (WC-068)
    rows.push({ name: w?.name ?? winnerId, cell: w ? `${w.flag} ${w.name}` : winnerId, opp: opp?.name ?? '?', poss: pw, ft: `${wFT}-${oFT}`, stage: m.stage });
  }
  rows.sort((a, b) => a.poss - b.poss);
  const top = rows[0];
  return {
    query: q, intent: 'possession-upsets',
    answer: top
      ? `${rows.length} side${rows.length === 1 ? '' : 's'} won with a minority of the ball. The starkest: ${top.name} won ${top.ft} against ${top.opp} with just ${top.poss}% possession in the ${top.stage === 'GROUP' ? 'group stage' : STAGE_LABEL[top.stage]}.`
      : 'No against-the-run-of-play wins found (possession data may be missing for these matches).',
    columns: ['Winner', 'Opponent', 'Poss%', 'Score', 'Stage'],
    rows: rows.slice(0, 12).map((r) => [r.cell, r.opp, `${r.poss}%`, r.ft, stageCell(r.stage)]),
    entityType: 'match', vizHint: 'bar',
    followUps: ['Which teams came from behind to win?', 'Most possession-dominant teams', 'Who is most likely to win the tournament?'],
  };
}

function pathQuery(q: string, mode: 'easy' | 'hard'): NLQueryResult {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  const eloOf = (id: string | null) => (id ? teamMap.get(id)?.elo ?? 1700 : 1700);
  const ranked = getTeams()
    .map((t) => {
      const route = routeToFinal(eng.bracket, t.id, eloOf);
      if (!route || !route.length) return null; // eliminated or never qualified — no path to rank
      const avgOpp = route.reduce((s, r) => s + r.oppElo, 0) / route.length;
      const f = eng.forecasts.get(t.id);
      return { t, f, avgOpp, rounds: route.length, reachFinal: f?.reachFinal ?? 0 };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (mode === 'easy' ? a.avgOpp - b.avgOpp : b.avgOpp - a.avgOpp))
    .slice(0, 8);
  const lead = ranked[0];
  return {
    query: q,
    intent: mode === 'easy' ? 'easiest-path' : 'hardest-path',
    answer: lead
      ? `${lead.t.name} have the ${mode === 'easy' ? 'easiest' : 'toughest'} remaining route to the final — ${lead.rounds} game${lead.rounds > 1 ? 's' : ''} to go, average projected opponent ELO ${Math.round(lead.avgOpp)}, reaching the final ${pct(lead.reachFinal)} of simulations.`
      : 'The knockout bracket is not set yet.',
    columns: ['Team', 'Games left', 'Avg opp ELO', 'Reach final%', 'Win title%'],
    rows: ranked.map((x) => [`${x.t.flag} ${x.t.name}`, x.rounds, Math.round(x.avgOpp), pct(x.reachFinal), pct(x.f?.winTitle ?? 0)]),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Who is most likely to win the tournament?', 'Which teams are outperforming expectations?', 'Show the bracket'],
  };
}

// The projected opponents a STILL-ALIVE team would face from its current
// position all the way to the final — one per remaining round, each taken from
// the sibling sub-bracket's projected winner. Returns null if the team is out
// or never made the bracket, so an eliminated (or non-qualifying) side can't be
// crowned with an "easy path". This replaces the old measure, which averaged
// opponent ELO only over the rounds a team actually appeared in — so a side
// projected to lose in the R32 had a one-game "path" and looked easiest of all,
// exactly backwards. (WC-064)
function routeToFinal(bracket: BracketNode[], teamId: string, eloOf: (id: string | null) => number): { stage: MatchStage; oppElo: number }[] | null {
  const rank: Record<MatchStage, number> = { GROUP: -1, R32: 0, R16: 1, QF: 2, SF: 3, FINAL: 4, THIRD_PLACE: 5 };
  const mine = bracket
    .filter((n) => n.homeTeamId === teamId || n.awayTeamId === teamId)
    .sort((a, b) => rank[a.stage] - rank[b.stage]);
  if (!mine.length) return null; // never made the bracket
  if (mine.some((n) => n.decided && n.winnerTeamId && n.winnerTeamId !== teamId)) return null; // lost a real tie → out

  const bySlot = new Map(bracket.map((n) => [n.slot, n]));
  const kidsOf = new Map<string, BracketNode[]>();
  for (const n of bracket) if (n.feedsInto) { const a = kidsOf.get(n.feedsInto) ?? []; a.push(n); kidsOf.set(n.feedsInto, a); }

  // Entry = the earliest node that isn't already a decided win (their next test).
  let node = mine.find((n) => !(n.decided && n.winnerTeamId === teamId)) ?? mine[mine.length - 1]!;
  const out: { stage: MatchStage; oppElo: number }[] = [];
  out.push({ stage: node.stage, oppElo: eloOf(node.homeTeamId === teamId ? node.awayTeamId : node.homeTeamId) });
  let branch = node.slot;
  while (node.feedsInto) {
    const parent = bySlot.get(node.feedsInto);
    if (!parent) break;
    const sibling = (kidsOf.get(parent.slot) ?? []).find((k) => k.slot !== branch);
    out.push({ stage: parent.stage, oppElo: eloOf(sibling?.winnerTeamId ?? null) }); // projected winner of the other sub-bracket
    branch = parent.slot;
    node = parent;
  }
  return out;
}

function titleQuery(q: string): NLQueryResult {
  const eng = engine();
  const ranked = getTeams()
    .map((t) => ({ t, f: eng.forecasts.get(t.id)! }))
    .filter((x) => x.f)
    .sort((a, b) => b.f.winTitle - a.f.winTitle)
    .slice(0, 10);
  const lead = ranked[0]!;
  return {
    query: q,
    intent: 'title-odds',
    answer: `${lead.t.name} are the most likely champions at ${pct(lead.f.winTitle)}, ahead of ${ranked[1]?.t.name} (${pct(ranked[1]?.f.winTitle ?? 0)}). Based on ${eng.forecasts.size} teams across ${RUNS.toLocaleString()} simulations.`,
    columns: ['#', 'Team', 'Win title%', 'Reach final%', 'Power'],
    rows: ranked.map((x, i) => [i + 1, `${x.t.flag} ${x.t.name}`, pct(x.f.winTitle), pct(x.f.reachFinal), x.f.powerRating]),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Which team has the easiest path to the final?', 'Strongest defense in the tournament', 'Which teams are overperforming?'],
  };
}

function teamUnitQuery(q: string, unit: 'offense' | 'defense'): NLQueryResult {
  const eng = engine();
  // The raw offense/defense ratings feed the Poisson model, but they land on
  // different effective scales when xG data is sparse (offense compresses low,
  // defense inflates high) — so "strongest attack rated 34/100" read weirdly next
  // to a 100/100 defense. Rescale to a field-relative 0-100 for DISPLAY ONLY, so
  // both units share one scale and the leader reads as 100. (WC-065)
  const offs = eng.powerRankings.map((r) => r.offenseRating);
  const defs = eng.powerRankings.map((r) => r.defenseRating);
  const scale = (v: number, arr: number[]) => {
    const mn = Math.min(...arr), mx = Math.max(...arr);
    return mx > mn ? Math.round(((v - mn) / (mx - mn)) * 100) : 50;
  };
  const ranked = [...eng.powerRankings]
    .sort((a, b) => (unit === 'offense' ? b.offenseRating - a.offenseRating : b.defenseRating - a.defenseRating))
    .slice(0, 10);
  const lead = ranked[0]!;
  const leadTeam = getTeam(lead.teamId)!;
  return {
    query: q,
    intent: unit === 'offense' ? 'best-attack' : 'best-defense',
    answer: `${leadTeam.name} have the tournament's strongest ${unit}, rated ${scale(unit === 'offense' ? lead.offenseRating : lead.defenseRating, unit === 'offense' ? offs : defs)}/100.`,
    columns: ['Team', 'Offense', 'Defense', 'Power', 'Momentum'],
    rows: ranked.map((r) => {
      const t = getTeam(r.teamId)!;
      return [`${t.flag} ${t.name}`, scale(r.offenseRating, offs), scale(r.defenseRating, defs), r.powerRating, signed(r.momentum)];
    }),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Who is most likely to win the tournament?', 'Strongest defense in the tournament', 'Highest xG among forwards'],
  };
}

function goldenBootQuery(q: string): NLQueryResult {
  const eng = engine();
  const views = new Map(getPlayerViews().map((p) => [p.id, p]));
  const ranked = eng.goldenBoot.slice(0, 12);
  const hasXg = ranked.some((r) => r.currentXG > 0); // player xG absent on the live feed → hide the column (WC-066)
  const leadView = ranked[0] ? views.get(ranked[0].playerId) : undefined;
  return {
    query: q,
    intent: 'golden-boot',
    answer: leadView
      ? `${leadView.name} (${leadView.team.code}) leads the Golden Boot race with ${ranked[0]!.currentGoals} goals, projected to finish on ${ranked[0]!.projectedGoals} (${pct(ranked[0]!.winProbability)} to win it).`
      : 'No scorers yet.',
    // Player xG isn't in the API-Football feed (0 for everyone), so drop the
    // column rather than show a 6-goal striker with "0 xG". The projection is
    // pace-based, not xG-based, so it's unaffected. (WC-066)
    columns: hasXg ? ['#', 'Player', 'Team', 'Goals', 'xG', 'Proj.', 'Win%'] : ['#', 'Player', 'Team', 'Goals', 'Proj.', 'Win%'],
    rows: ranked.map((r, i) => {
      const v = views.get(r.playerId);
      const base = [i + 1, v?.name ?? r.playerId, v?.team.code ?? '', r.currentGoals];
      return hasXg ? [...base, r.currentXG, r.projectedGoals, pct(r.winProbability)] : [...base, r.projectedGoals, pct(r.winProbability)];
    }),
    entityType: 'player',
    vizHint: 'bar',
    followUps: ['Highest xG among forwards', 'Show under-the-radar breakout players', 'Who is most likely to win the tournament?'],
  };
}

function playerLookup(q: string, p: PlayerView): NLQueryResult {
  const s = p.stats;
  return {
    query: q,
    intent: 'player-lookup',
    // xG is absent on the live feed (0), so only mention/show it when real. (WC-066)
    answer: `${p.name} — ${posName(p.position)} for ${p.team.name}. ${s.goals}G ${s.assists}A${s.xG > 0 ? `, ${fmt(s.xG)} xG` : ''} in ${s.minutes} minutes. Form index ${s.formIndex}.`,
    columns: ['Metric', 'Value', 'Percentile (pos)'],
    rows: [
      ['Goals', s.goals, p.percentiles.goals ?? '—'],
      ['Assists', s.assists, p.percentiles.assists ?? '—'],
      ...(s.xG > 0 ? [['xG', fmt(s.xG), p.percentiles.xG ?? '—'] as (string | number)[]] : []),
      ...(s.xA > 0 ? [['xA', fmt(s.xA), p.percentiles.xA ?? '—'] as (string | number)[]] : []),
      ['Shots', s.shots, p.percentiles.shots ?? '—'],
      ['Key passes', s.keyPasses, p.percentiles.keyPasses ?? '—'],
      ['Prog. passes', s.progressivePasses, p.percentiles.progressivePasses ?? '—'],
    ],
    entityType: 'player',
    vizHint: 'table',
    followUps: [`${p.name} scouting report`, `Compare ${p.name} and another player`, 'Highest xG among ' + posName(p.position).toLowerCase() + 's'],
  };
}

const KO_ORDER: MatchStage[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
const STAGE_LABEL: Record<MatchStage, string> = {
  GROUP: 'group stage', R32: 'round of 32', R16: 'round of 16', QF: 'quarter-finals',
  SF: 'semi-finals', FINAL: 'final', THIRD_PLACE: 'third-place play-off',
};

// Did `teamId` win this finished match (goals, then penalties for a KO draw)?
function teamWonMatch(m: Match, teamId: string): boolean | null {
  if (m.status !== 'FINISHED') return null;
  const home = m.homeTeamId === teamId;
  const gf = home ? m.homeScore : m.awayScore;
  const ga = home ? m.awayScore : m.homeScore;
  if (gf !== ga) return gf > ga;
  if (m.penalties) return (home ? m.penalties.home : m.penalties.away) > (home ? m.penalties.away : m.penalties.home);
  return null;
}

/**
 * A present-tense-correct status line for a team. During the group phase this is
 * the live group standing; once any knockout match has kicked off, the group
 * table is final (history) and the team's actual status is its knockout run —
 * so "Currently 1st in Group H" during the R16 was just wrong. (WC-062)
 */
// True once any knockout match has kicked off — at which point the group tables
// are final history, not live standings, so present-tense phrasing goes stale. (WC-062/WC-067)
function knockoutsBegun(): boolean {
  return getMatches().some((m) => m.stage !== 'GROUP' && m.status !== 'SCHEDULED');
}

function teamStatusLine(teamId: string, s: { rank: number; groupId: string; points: number } | undefined): string {
  const koStarted = knockoutsBegun();
  if (!koStarted) {
    return s ? `Currently ${ordinal(s.rank)} in Group ${s.groupId} with ${s.points} pts.` : '';
  }
  const groupFinish = s ? `Finished ${ordinal(s.rank)} in Group ${s.groupId}` : 'Out of the group stage';
  const ko = getTeamMatches(teamId).filter((m) => m.stage !== 'GROUP' && m.stage !== 'THIRD_PLACE');
  if (!ko.length) return `${groupFinish} — eliminated at the group stage.`;

  const liveM = ko.find((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  if (liveM) return `${groupFinish}; playing their ${STAGE_LABEL[liveM.stage]} tie right now.`;
  const upcoming = ko.find((m) => m.status === 'SCHEDULED');
  if (upcoming) return `${groupFinish}; into the ${STAGE_LABEL[upcoming.stage]}.`;

  const last = ko[ko.length - 1]!;
  const won = teamWonMatch(last, teamId);
  if (won === false) return `${groupFinish}; eliminated in the ${STAGE_LABEL[last.stage]}.`;
  if (won === true) {
    if (last.stage === 'FINAL') return `${groupFinish}; World Cup champions.`;
    const next = KO_ORDER[KO_ORDER.indexOf(last.stage) + 1];
    return next ? `${groupFinish}; through to the ${STAGE_LABEL[next]}.` : `${groupFinish}; won their ${STAGE_LABEL[last.stage]} tie.`;
  }
  return `${groupFinish}; in the knockout rounds.`;
}

// "Who is England's goalkeeper" / "Belgium's strikers" — a team's players at a
// position, ordered by minutes so the first-choice (most-used) name leads. (WC-063)
function teamPositionQuery(q: string, teamId: string, pos: Position): NLQueryResult {
  const t = getTeam(teamId)!;
  const squad = getPlayerViews()
    .filter((p) => p.teamId === teamId && p.position === pos)
    .sort((a, b) => b.stats.minutes - a.stats.minutes);
  const label = posName(pos).toLowerCase();
  if (!squad.length) {
    return {
      query: q, intent: 'team-position',
      answer: `I don't have any ${label} listed for ${t.name}.`,
      columns: [], rows: [], entityType: 'team', vizHint: 'none',
      followUps: [`${t.name} path to the final`, 'Who is most likely to win the tournament?', 'Strongest attack in the tournament'],
    };
  }
  const isGK = pos === 'GK';
  const starter = squad[0]!;
  const others = squad.length - 1;
  const answer = isGK
    ? `${starter.name} is ${t.name}'s first-choice goalkeeper (${starter.stats.minutes} min this tournament)${others > 0 ? `, ahead of ${others} other keeper${others > 1 ? 's' : ''} in the squad` : ''}.`
    : `${t.name}'s ${label}s by minutes played: ${squad.slice(0, 3).map((p) => p.name).join(', ')}${squad.length > 3 ? `, +${squad.length - 3} more` : ''}.`;
  const columns = isGK ? ['Goalkeeper', 'Mins', 'Saves', 'Clean sheets'] : [posName(pos), 'Mins', 'Goals', 'Assists'];
  const rows = squad.map((p): (string | number)[] => (isGK
    ? [p.name, p.stats.minutes, p.stats.saves, p.stats.cleanSheets]
    : [p.name, p.stats.minutes, p.stats.goals, p.stats.assists]));
  return {
    query: q, intent: 'team-position',
    answer, columns, rows,
    entityType: 'player', vizHint: 'table',
    followUps: [`${t.name} path to the final`, isGK ? 'Who has kept the most clean sheets?' : `Top scorer for ${t.name}`, 'Who is most likely to win the tournament?'],
  };
}

function teamLookup(q: string, teamId: string): NLQueryResult {
  const eng = engine();
  const t = getTeam(teamId)!;
  const f = eng.forecasts.get(teamId);
  const s = eng.standingsByTeam.get(teamId);
  const pr = eng.powerRankings.find((r) => r.teamId === teamId);
  const status = teamStatusLine(teamId, s);
  return {
    query: q,
    intent: 'team-lookup',
    answer: `${t.name} — power rank #${pr?.rank ?? '—'}, ${f ? pct(f.winTitle) + ' to win the title' : ''}. ${status}`,
    columns: ['Metric', 'Value'],
    rows: [
      ['Status', status || '—'],
      ['Group finish', s ? `${ordinal(s.rank)} (Group ${s.groupId})` : '—'],
      ['Points', s?.points ?? '—'],
      ['Power rating', pr?.powerRating ?? '—'],
      ['Momentum', pr ? signed(pr.momentum) : '—'],
      ['Win title %', f ? pct(f.winTitle) : '—'],
      ['Reach final %', f ? pct(f.reachFinal) : '—'],
      ['ELO', t.elo],
    ],
    entityType: 'team',
    vizHint: 'table',
    followUps: [`${t.name} path to the final`, 'Who is most likely to win the tournament?', 'Strongest attack in the tournament'],
  };
}

// ── formatting helpers ──
const posNames: Record<Position, string> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };
const posName = (p: Position) => posNames[p];
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const signed = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n] ?? 'th'}`;
