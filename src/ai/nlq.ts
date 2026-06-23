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
import { extractPlayers, extractTeam, bestPlayer } from '@/ai/query/resolver';
import { tacticalProfile, tacticalBoard } from '@/server/tactics';
import type { NLQueryResult, PlayerView, Position } from '@/domain/types';

const METRICS: Record<string, { key: string; label: string; per90?: boolean; source: 'stat' | 'per90' }> = {
  xg: { key: 'xG', label: 'xG', source: 'stat' },
  'expected goals': { key: 'xG', label: 'xG', source: 'stat' },
  xa: { key: 'xA', label: 'xA', source: 'stat' },
  'expected assists': { key: 'xA', label: 'xA', source: 'stat' },
  goals: { key: 'goals', label: 'Goals', source: 'stat' },
  assists: { key: 'assists', label: 'Assists', source: 'stat' },
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
  'yellow cards': { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  yellows: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  'red cards': { key: 'redCards', label: 'Red cards', source: 'stat' },
  bookings: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  cards: { key: 'yellowCards', label: 'Yellow cards', source: 'stat' },
  fouls: { key: 'foulsCommitted', label: 'Fouls', source: 'stat' },
  'pass accuracy': { key: 'passAccuracy', label: 'Pass %', source: 'per90' },
  'shot conversion': { key: 'shotConversion', label: 'Conversion %', source: 'per90' },
};

const POSITIONS: Record<string, Position> = {
  midfielder: 'MF', midfielders: 'MF', midfield: 'MF',
  forward: 'FW', forwards: 'FW', striker: 'FW', strikers: 'FW', attacker: 'FW', attackers: 'FW', winger: 'FW', wingers: 'FW',
  defender: 'DF', defenders: 'DF', 'centre-back': 'DF', 'center-back': 'DF', 'full-back': 'DF',
  goalkeeper: 'GK', goalkeepers: 'GK', keeper: 'GK', goalie: 'GK',
};

function metricValue(p: PlayerView, m: { key: string; source: 'stat' | 'per90' }, per90: boolean): number {
  if (m.source === 'per90' || per90) {
    return (p.per90[m.key] as number) ?? (p.stats as unknown as Record<string, number>)[m.key] ?? 0;
  }
  return (p.stats as unknown as Record<string, number>)[m.key] ?? 0;
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
    answer: top && rows[0] ? `${top.name} top ${group.name} with ${rows[0].points} pts from ${rows[0].played}.` : `${group.name} hasn't kicked off yet.`,
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
  const team = detectTeam(q);
  if (team) {
    const next = getTeamMatches(team.id).filter((mm) => mm.status === 'SCHEDULED').sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
    if (!next) {
      return { query: q, intent: 'fixture', answer: `${team.name} have no upcoming fixtures in the data — their group games are done (knockout ties are drawn once the group stage finishes).`, columns: [], rows: [], entityType: 'team', vizHint: 'none', followUps: [`${team.name}'s playing style`, 'Who is most likely to win the tournament?'] };
    }
    const opp = getTeam(next.homeTeamId === team.id ? next.awayTeamId : next.homeTeamId);
    const venue = next.venue && next.venue !== 'TBD' ? ` at ${next.venue}` : '';
    return { query: q, intent: 'fixture', answer: `${team.name} next play ${opp?.name ?? '?'} on ${fixtureKick(next.kickoff)}${venue}.`, columns: [], rows: [], entityType: 'match', vizHint: 'none', followUps: [`${team.name}'s playing style`, opp ? `${opp.name}'s playing style` : 'Who is most likely to win the tournament?'] };
  }
  const upcoming = getMatches().filter((mm) => mm.status === 'SCHEDULED').sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 8);
  if (upcoming.length === 0) {
    return { query: q, intent: 'fixture', answer: 'No upcoming fixtures are scheduled in the data right now.', columns: [], rows: [], entityType: 'match', vizHint: 'none', followUps: ['Who is most likely to win the tournament?'] };
  }
  return {
    query: q, intent: 'fixture', answer: `The next ${upcoming.length} fixtures:`,
    columns: ['Match', 'Kickoff', 'Stage'],
    rows: upcoming.map((mm) => { const h = getTeam(mm.homeTeamId), a = getTeam(mm.awayTeamId); return [`${h?.flag ?? ''} ${h?.name ?? '?'} v ${a?.name ?? '?'} ${a?.flag ?? ''}`.trim(), fixtureKick(mm.kickoff), mm.stage === 'GROUP' ? `MD${mm.matchday}` : mm.stage]; }),
    entityType: 'match', vizHint: 'table',
    followUps: ['When does Brazil play next?', 'Who is most likely to win the tournament?'],
  };
}

function extremeQuery(q: string, field: 'age' | 'heightCm', dir: 'min' | 'max'): NLQueryResult {
  const pos = findPosition(q.toLowerCase());
  const valOf = (p: PlayerView) => (field === 'age' ? p.age : p.heightCm);
  const valid = (p: PlayerView) => (field === 'age' ? p.age >= 14 && p.age <= 55 : p.heightCm >= 140 && p.heightCm <= 220);
  let pool = getPlayerViews().filter((p) => valid(p) && p.stats.minutes >= 1);
  if (pos) pool = pool.filter((p) => p.position === pos);
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
    answer: `${lead.name} (${lead.team.code}) is the ${word}${pos ? ` ${posName(pos)}` : ''} on the pitch at ${show(lead)}.`,
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

  // ── Easiest / hardest path ──
  if (lower.includes('easiest path') || lower.includes('easy path') || (lower.includes('path') && lower.includes('final'))) {
    return pathQuery(q, 'easy');
  }
  if (lower.includes('hardest path') || lower.includes('toughest path')) {
    return pathQuery(q, 'hard');
  }

  // ── Title / who will win (incl. "odds"/"chances to win") ──
  if (
    (lower.includes('win') && (lower.includes('tournament') || lower.includes('world cup') || lower.includes('title') || lower.includes('trophy'))) ||
    lower.includes('favourite') || lower.includes('favorite') || lower.includes('most likely to win') ||
    ((lower.includes('odds') || lower.includes('chance')) && (lower.includes('win') || lower.includes('title') || lower.includes('trophy') || !!detectTeam(q)))
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
    return goldenBootQuery(q);
  }

  // ── Group standings: "who tops group B", "Group A table" ──
  if ((/group\s+[a-l]\b/.test(lower)) || ((lower.includes('standing') || lower.includes('table') || lower.includes('group')) && (lower.includes('top') || lower.includes('lead') || lower.includes('standing') || lower.includes('table')))) {
    return groupStandingsQuery(q);
  }

  // ── Fixtures / schedule: "when does X play next", "next fixtures" ──
  if (lower.includes('next match') || lower.includes('next game') || lower.includes('next fixture') || lower.includes('fixtures') || lower.includes('schedule') || ((lower.includes('when') || lower.includes('next')) && lower.includes('play')) || (lower.includes('who plays') && lower.includes('today'))) {
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

  // ── Metric leaderboard (default for "highest/most X") ──
  const metric = findMetric(lower);
  if (metric) {
    return leaderboardQuery(q, metric);
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
  const team = detectTeam(q);
  const per90 = lower.includes('per 90') || lower.includes('per90');
  const minMinutes = per90 ? 180 : 1;

  let pool = getPlayerViews().filter((p) => p.stats.minutes >= minMinutes);
  if (pos) pool = pool.filter((p) => p.position === pos);
  if (team) pool = pool.filter((p) => p.teamId === team.id);

  const ranked = pool
    .map((p) => ({ p, v: metricValue(p, metric, per90) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);

  const top = ranked[0];
  const posLabel = pos ? ` ${posName(pos)}` : '';
  const teamLabel = team ? ` for ${team.name}` : '';
  const answer = top
    ? `${top.p.name} (${top.p.team.code}) leads all${posLabel}s${teamLabel} with ${fmt(top.v)} ${metric.label}${per90 ? ' per 90' : ''}.`
    : 'No players match that filter yet.';

  return {
    query: q,
    intent: 'leaderboard',
    answer,
    columns: ['#', 'Player', 'Team', metric.label + (per90 ? '/90' : ''), 'Mins'],
    rows: ranked.map((r, i) => [i + 1, r.p.name, r.p.team.code, fmt(r.v), r.p.stats.minutes]),
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

function pathQuery(q: string, mode: 'easy' | 'hard'): NLQueryResult {
  const eng = engine();
  const teamMap = new Map(getTeams().map((t) => [t.id, t]));
  // Path difficulty = expected aggregate ELO of projected opponents to the final
  const difficulty = new Map<string, { opponents: number; sumElo: number }>();
  for (const node of eng.bracket) {
    if (node.homeTeamId) addPath(difficulty, node.homeTeamId, node.awayTeamId, teamMap);
    if (node.awayTeamId) addPath(difficulty, node.awayTeamId, node.homeTeamId, teamMap);
  }
  const ranked = getTeams()
    .map((t) => {
      const f = eng.forecasts.get(t.id);
      const d = difficulty.get(t.id);
      const avgOpp = d && d.opponents ? d.sumElo / d.opponents : 1700;
      return { t, f, avgOpp, reachFinal: f?.reachFinal ?? 0 };
    })
    .filter((x) => x.reachFinal > 0.01)
    .sort((a, b) => (mode === 'easy' ? a.avgOpp - b.avgOpp : b.avgOpp - a.avgOpp))
    .slice(0, 8);
  const lead = ranked[0];
  return {
    query: q,
    intent: mode === 'easy' ? 'easiest-path' : 'hardest-path',
    answer: lead
      ? `${lead.t.name} have the ${mode === 'easy' ? 'easiest' : 'toughest'} projected route — average projected knockout opponent ELO of ${Math.round(lead.avgOpp)}, reaching the final ${pct(lead.reachFinal)} of simulations.`
      : 'Bracket not yet determined.',
    columns: ['Team', 'Avg opp ELO', 'Reach final%', 'Win title%'],
    rows: ranked.map((x) => [`${x.t.flag} ${x.t.name}`, Math.round(x.avgOpp), pct(x.reachFinal), pct(x.f?.winTitle ?? 0)]),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Who is most likely to win the tournament?', 'Which teams are outperforming expectations?', 'Show the bracket'],
  };
}

function addPath(map: Map<string, { opponents: number; sumElo: number }>, teamId: string, oppId: string | null, teams: Map<string, { elo: number }>): void {
  if (!oppId) return;
  const entry = map.get(teamId) ?? { opponents: 0, sumElo: 0 };
  entry.opponents++;
  entry.sumElo += teams.get(oppId)?.elo ?? 1700;
  map.set(teamId, entry);
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
    answer: `${lead.t.name} are the most likely champions at ${pct(lead.f.winTitle)}, ahead of ${ranked[1]?.t.name} (${pct(ranked[1]?.f.winTitle ?? 0)}). Based on ${eng.forecasts.size} teams across ${(8000).toLocaleString()} simulations.`,
    columns: ['#', 'Team', 'Win title%', 'Reach final%', 'Power'],
    rows: ranked.map((x, i) => [i + 1, `${x.t.flag} ${x.t.name}`, pct(x.f.winTitle), pct(x.f.reachFinal), x.f.powerRating]),
    entityType: 'team',
    vizHint: 'bar',
    followUps: ['Which team has the easiest path to the final?', 'Strongest defense in the tournament', 'Which teams are overperforming?'],
  };
}

function teamUnitQuery(q: string, unit: 'offense' | 'defense'): NLQueryResult {
  const eng = engine();
  const ranked = [...eng.powerRankings]
    .sort((a, b) => (unit === 'offense' ? b.offenseRating - a.offenseRating : b.defenseRating - a.defenseRating))
    .slice(0, 10);
  const lead = ranked[0]!;
  const leadTeam = getTeam(lead.teamId)!;
  return {
    query: q,
    intent: unit === 'offense' ? 'best-attack' : 'best-defense',
    answer: `${leadTeam.name} have the tournament's strongest ${unit}, rated ${unit === 'offense' ? lead.offenseRating : lead.defenseRating}/100.`,
    columns: ['Team', 'Offense', 'Defense', 'Power', 'Momentum'],
    rows: ranked.map((r) => {
      const t = getTeam(r.teamId)!;
      return [`${t.flag} ${t.name}`, r.offenseRating, r.defenseRating, r.powerRating, signed(r.momentum)];
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
  const leadView = ranked[0] ? views.get(ranked[0].playerId) : undefined;
  return {
    query: q,
    intent: 'golden-boot',
    answer: leadView
      ? `${leadView.name} (${leadView.team.code}) leads the Golden Boot race with ${ranked[0]!.currentGoals} goals, projected to finish on ${ranked[0]!.projectedGoals} (${pct(ranked[0]!.winProbability)} to win it).`
      : 'No scorers yet.',
    columns: ['#', 'Player', 'Team', 'Goals', 'xG', 'Proj.', 'Win%'],
    rows: ranked.map((r, i) => {
      const v = views.get(r.playerId);
      return [i + 1, v?.name ?? r.playerId, v?.team.code ?? '', r.currentGoals, r.currentXG, r.projectedGoals, pct(r.winProbability)];
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
    answer: `${p.name} — ${posName(p.position)} for ${p.team.name}. ${s.goals}G ${s.assists}A, ${fmt(s.xG)} xG in ${s.minutes} minutes. Form index ${s.formIndex}.`,
    columns: ['Metric', 'Value', 'Percentile (pos)'],
    rows: [
      ['Goals', s.goals, p.percentiles.goals ?? '—'],
      ['Assists', s.assists, p.percentiles.assists ?? '—'],
      ['xG', fmt(s.xG), p.percentiles.xG ?? '—'],
      ['xA', fmt(s.xA), p.percentiles.xA ?? '—'],
      ['Shots', s.shots, p.percentiles.shots ?? '—'],
      ['Key passes', s.keyPasses, p.percentiles.keyPasses ?? '—'],
      ['Prog. passes', s.progressivePasses, p.percentiles.progressivePasses ?? '—'],
    ],
    entityType: 'player',
    vizHint: 'table',
    followUps: [`${p.name} scouting report`, `Compare ${p.name} and another player`, 'Highest xG among ' + posName(p.position).toLowerCase() + 's'],
  };
}

function teamLookup(q: string, teamId: string): NLQueryResult {
  const eng = engine();
  const t = getTeam(teamId)!;
  const f = eng.forecasts.get(teamId);
  const s = eng.standingsByTeam.get(teamId);
  const pr = eng.powerRankings.find((r) => r.teamId === teamId);
  return {
    query: q,
    intent: 'team-lookup',
    answer: `${t.name} — power rank #${pr?.rank ?? '—'}, ${f ? pct(f.winTitle) + ' to win the title' : ''}. ${
      s ? `Currently ${ordinal(s.rank)} in Group ${s.groupId} with ${s.points} pts.` : ''
    }`,
    columns: ['Metric', 'Value'],
    rows: [
      ['Group position', s ? `${ordinal(s.rank)} (Group ${s.groupId})` : '—'],
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
