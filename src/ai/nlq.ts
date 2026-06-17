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

import { getPlayerViews, getTeams, getTeam } from '@/data/store';
import { engine } from '@/analytics';
import { extractPlayers, extractTeam } from '@/ai/query/resolver';
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

export function answerQuery(rawQuery: string): NLQueryResult {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  // ── Comparison: "compare X and Y" / "X vs Y" ──
  const players = detectPlayers(q);
  if ((lower.includes('compare') || lower.includes(' vs ') || lower.includes(' versus ')) && players.length >= 2) {
    return comparePlayers(q, players.slice(0, 2));
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

  // ── Title / who will win ──
  if ((lower.includes('win') && (lower.includes('tournament') || lower.includes('world cup') || lower.includes('title') || lower.includes('trophy'))) || lower.includes('favourite') || lower.includes('favorite') || lower.includes('most likely to win')) {
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

  // ── Metric leaderboard (default for "highest/most X") ──
  const metric = findMetric(lower);
  if (metric) {
    return leaderboardQuery(q, metric);
  }

  // ── Entity lookups ──
  if (players.length === 1) return playerLookup(q, players[0]!);
  const team = detectTeam(q);
  if (team) return teamLookup(q, team.id);

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
  return {
    query: q,
    intent: 'breakout',
    answer: lead
      ? `${lead.name} (${lead.team.code}, age ${lead.age}) is the standout breakout — ${lead.stats.goals}G ${lead.stats.assists}A on a €${lead.marketValueEur}m valuation with a ${lead.stats.formIndex} form index.`
      : 'No breakout candidates yet.',
    columns: ['Player', 'Team', 'Age', 'G', 'A', 'xG+xA', 'Form', '€m'],
    rows: ranked.map((r) => [
      r.p.name,
      r.p.team.code,
      r.p.age,
      r.p.stats.goals,
      r.p.stats.assists,
      fmt(r.p.stats.xG + r.p.stats.xA),
      r.p.stats.formIndex,
      r.p.marketValueEur,
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
