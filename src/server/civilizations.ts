import 'server-only';
import { getTeams, getMatches, getPlayerViews } from '@/data/store';
import { engine } from '@/analytics';
import type { Confederation, Team } from '@/domain/types';

/**
 * "Clash of the Civilizations" — how each region of the world is faring at the
 * World Cup. Aggregates every team by its confederation into a regional record
 * (results + model probabilities) and computes the inter-confederation
 * head-to-head matrix from finished cross-region fixtures (the literal clash).
 */

interface Meta { name: string; emoji: string; color: string }
export const CONF_META: Record<Confederation, Meta> = {
  UEFA: { name: 'Europe', emoji: '🇪🇺', color: '#3b82f6' },
  CONMEBOL: { name: 'South America', emoji: '🌎', color: '#eab308' },
  CAF: { name: 'Africa', emoji: '🌍', color: '#10b981' },
  AFC: { name: 'Asia', emoji: '🌏', color: '#ff2e9a' },
  CONCACAF: { name: 'N. & C. America', emoji: '🗺️', color: '#ff8a1e' },
  OFC: { name: 'Oceania', emoji: '🌊', color: '#8b5cf6' },
};
const CONF_ORDER: Confederation[] = ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'];

export interface RegionTeam { id: string; name: string; code: string; flag: string; winTitle: number; points: number; played: number; status: 'Q' | 'E' | 'T' | null }
export interface RegionScorer { id: string; name: string; code: string; flag: string; goals: number }
export interface RegionStat {
  conf: Confederation; name: string; emoji: string; color: string;
  teamCount: number; qualified: number; eliminated: number;
  played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number;
  points: number; ppg: number; winRate: number;
  titleProb: number; knockoutProb: number; avgElo: number;
  // Goal-rich aggregates
  goalsPerMatch: number; concededPerMatch: number; xgFor: number; finishing: number;
  cleanSheets: number; yellow: number; red: number; topScorer: RegionScorer | null;
  teams: RegionTeam[];
}
export interface RegionTiming { conf: Confederation; name: string; emoji: string; color: string; buckets: number[]; total: number }
export const GOAL_INTERVALS = ['1-15', '16-30', '31-45', '46-60', '61-75', '76+'];
function timingBucket(minute: number): number {
  if (minute <= 15) return 0;
  if (minute <= 30) return 1;
  if (minute <= 45) return 2;
  if (minute <= 60) return 3;
  if (minute <= 75) return 4;
  return 5;
}
export interface H2H { w: number; d: number; l: number; gf: number; ga: number; played: number }
export interface ClashResult {
  label: string; winnerConf: Confederation; loserConf: Confederation; score: string; margin: number;
}

export function civilizationsView() {
  const eng = engine();
  const teams = getTeams();
  const byConf = new Map<Confederation, Team[]>();
  for (const t of teams) {
    const arr = byConf.get(t.confederation) ?? [];
    arr.push(t); byConf.set(t.confederation, arr);
  }

  const confOf = new Map(teams.map((t) => [t.id, t.confederation]));

  // ── Per-region player aggregates (xG, top scorer, discipline) ──
  interface PAgg { xg: number; yellow: number; red: number; topScorer: RegionScorer | null }
  const pAgg = new Map<Confederation, PAgg>();
  for (const conf of CONF_ORDER) pAgg.set(conf, { xg: 0, yellow: 0, red: 0, topScorer: null });
  for (const p of getPlayerViews()) {
    const conf = confOf.get(p.teamId);
    if (!conf) continue;
    const agg = pAgg.get(conf)!;
    agg.xg += p.stats.xG;
    agg.yellow += p.stats.yellowCards;
    agg.red += p.stats.redCards;
    if (p.stats.goals > 0 && (!agg.topScorer || p.stats.goals > agg.topScorer.goals)) {
      agg.topScorer = { id: p.id, name: p.name, code: p.team.code, flag: p.team.flag, goals: p.stats.goals };
    }
  }

  // ── Clean sheets per region (from finished matches) ──
  const csByConf = new Map<Confederation, number>();
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const ch = confOf.get(m.homeTeamId), ca = confOf.get(m.awayTeamId);
    if (ch && m.awayScore === 0) csByConf.set(ch, (csByConf.get(ch) ?? 0) + 1);
    if (ca && m.homeScore === 0) csByConf.set(ca, (csByConf.get(ca) ?? 0) + 1);
  }

  // Real, SETTLED qualification: a team is "through" once it actually appears in a
  // knockout (R32+) fixture. This counts best-third qualifiers too — the group
  // `status` only flags top-2 finishers, so it was undercounting (e.g. it missed
  // most of the 9-of-10 CAF teams that reached the Round of 32).
  const qualifiedIds = new Set<string>();
  for (const m of getMatches()) {
    if (m.stage !== 'GROUP') {
      if (m.homeTeamId) qualifiedIds.add(m.homeTeamId);
      if (m.awayTeamId) qualifiedIds.add(m.awayTeamId);
    }
  }
  const settled = qualifiedIds.size > 0;

  // ── Per-region aggregate ──
  const regions: RegionStat[] = [];
  for (const conf of CONF_ORDER) {
    const members = byConf.get(conf);
    if (!members || members.length === 0) continue;
    const meta = CONF_META[conf];
    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0, titleProb = 0, knockoutProb = 0, eloSum = 0;
    let qualified = 0, eliminated = 0;
    const teamRows: RegionTeam[] = [];
    for (const t of members) {
      const s = eng.standingsByTeam.get(t.id);
      const f = eng.forecasts.get(t.id);
      eloSum += t.elo;
      if (s) {
        played += s.played; won += s.won; drawn += s.drawn; lost += s.lost;
        gf += s.goalsFor; ga += s.goalsAgainst; points += s.points;
      }
      // Real qualification once the knockout draw exists; provisional group status before it.
      if (settled) {
        if (qualifiedIds.has(t.id)) qualified++; else eliminated++;
      } else if (s?.status === 'Q') qualified++;
      else if (s?.status === 'E') eliminated++;
      titleProb += f?.winTitle ?? 0;
      knockoutProb += f?.reachR16 ?? 0;
      teamRows.push({ id: t.id, name: t.name, code: t.code, flag: t.flag, winTitle: f?.winTitle ?? 0, points: s?.points ?? 0, played: s?.played ?? 0, status: s?.status ?? null });
    }
    teamRows.sort((a, b) => b.winTitle - a.winTitle || b.points - a.points);
    const agg = pAgg.get(conf)!;
    regions.push({
      conf, name: meta.name, emoji: meta.emoji, color: meta.color,
      teamCount: members.length, qualified, eliminated,
      played, won, drawn, lost, goalsFor: gf, goalsAgainst: ga, points,
      ppg: played ? points / played : 0, winRate: played ? won / played : 0,
      titleProb, knockoutProb, avgElo: Math.round(eloSum / members.length),
      goalsPerMatch: played ? gf / played : 0, concededPerMatch: played ? ga / played : 0,
      xgFor: agg.xg, finishing: gf - agg.xg, cleanSheets: csByConf.get(conf) ?? 0,
      yellow: agg.yellow, red: agg.red, topScorer: agg.topScorer,
      teams: teamRows,
    });
  }

  // ── Goal timing by region (from match events, GOAL + PENALTY_GOAL) ──
  const timingMap = new Map<Confederation, number[]>();
  for (const conf of CONF_ORDER) timingMap.set(conf, [0, 0, 0, 0, 0, 0]);
  for (const m of getMatches()) {
    for (const ev of m.events) {
      if (ev.type !== 'GOAL' && ev.type !== 'PENALTY_GOAL') continue;
      const conf = confOf.get(ev.teamId);
      if (!conf) continue;
      timingMap.get(conf)![timingBucket(ev.minute)]! += 1;
    }
  }
  const goalTiming: RegionTiming[] = CONF_ORDER
    .filter((c) => byConf.get(c)?.length)
    .map((c) => {
      const buckets = timingMap.get(c)!;
      return { conf: c, name: CONF_META[c].name, emoji: CONF_META[c].emoji, color: CONF_META[c].color, buckets, total: buckets.reduce((a, b) => a + b, 0) };
    });
  // Rank by title probability, then knockout reach, then ELO.
  regions.sort((a, b) => b.titleProb - a.titleProb || b.knockoutProb - a.knockoutProb || b.avgElo - a.avgElo);

  // ── Inter-confederation head-to-head ──
  const blank = (): H2H => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 });
  const matrix: Record<string, Record<string, H2H>> = {};
  for (const a of CONF_ORDER) { matrix[a] = {}; for (const b of CONF_ORDER) matrix[a]![b] = blank(); }
  const clashes: ClashResult[] = [];
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const ca = confOf.get(m.homeTeamId), cb = confOf.get(m.awayTeamId);
    if (!ca || !cb || ca === cb) continue;
    const home = matrix[ca]![cb]!, away = matrix[cb]![ca]!;
    home.played++; away.played++;
    home.gf += m.homeScore; home.ga += m.awayScore; away.gf += m.awayScore; away.ga += m.homeScore;
    // A level knockout tie is decided on penalties — credit the shootout winner.
    const homeWon = m.homeScore > m.awayScore || (m.homeScore === m.awayScore && !!m.penalties && m.penalties.home > m.penalties.away);
    const awayWon = m.awayScore > m.homeScore || (m.homeScore === m.awayScore && !!m.penalties && m.penalties.away > m.penalties.home);
    if (homeWon) { home.w++; away.l++; }
    else if (awayWon) { home.l++; away.w++; }
    else { home.d++; away.d++; }
    const margin = Math.abs(m.homeScore - m.awayScore);
    if (margin >= 1 || homeWon || awayWon) {
      const winnerConf = homeWon ? ca : cb;
      const loserConf = homeWon ? cb : ca;
      const tH = teams.find((t) => t.id === m.homeTeamId), tA = teams.find((t) => t.id === m.awayTeamId);
      const penTag = m.penalties && margin === 0 ? ` (${Math.max(m.penalties.home, m.penalties.away)}–${Math.min(m.penalties.home, m.penalties.away)} pens)` : '';
      if (tH && tA) clashes.push({ label: `${tH.name} ${m.homeScore}–${m.awayScore}${penTag} ${tA.name}`, winnerConf, loserConf, score: `${m.homeScore}-${m.awayScore}`, margin });
    }
  }

  // Cross-region record per confederation (row totals of the matrix).
  const crossRecord: Record<string, H2H> = {};
  for (const a of CONF_ORDER) {
    const tot = blank();
    for (const b of CONF_ORDER) { const c = matrix[a]![b]!; tot.w += c.w; tot.d += c.d; tot.l += c.l; tot.gf += c.gf; tot.ga += c.ga; tot.played += c.played; }
    crossRecord[a] = tot;
  }

  // Highlights: most lopsided cross-region results.
  clashes.sort((a, b) => b.margin - a.margin);
  const topClashes = clashes.slice(0, 5);

  const totalTitle = regions.reduce((s, r) => s + r.titleProb, 0) || 1;
  const presentConfs = CONF_ORDER.filter((c) => regions.some((r) => r.conf === c));

  return { regions, goalTiming, matrix, crossRecord, topClashes, totalTitle, presentConfs, settled, meta: CONF_META };
}

export type CivilizationsData = ReturnType<typeof civilizationsView>;
