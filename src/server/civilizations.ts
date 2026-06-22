import 'server-only';
import { getTeams, getMatches } from '@/data/store';
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
export interface RegionStat {
  conf: Confederation; name: string; emoji: string; color: string;
  teamCount: number; qualified: number; eliminated: number;
  played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number;
  points: number; ppg: number; winRate: number;
  titleProb: number; knockoutProb: number; avgElo: number;
  teams: RegionTeam[];
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
        if (s.status === 'Q') qualified++; if (s.status === 'E') eliminated++;
      }
      titleProb += f?.winTitle ?? 0;
      knockoutProb += f?.reachR16 ?? 0;
      teamRows.push({ id: t.id, name: t.name, code: t.code, flag: t.flag, winTitle: f?.winTitle ?? 0, points: s?.points ?? 0, played: s?.played ?? 0, status: s?.status ?? null });
    }
    teamRows.sort((a, b) => b.winTitle - a.winTitle || b.points - a.points);
    regions.push({
      conf, name: meta.name, emoji: meta.emoji, color: meta.color,
      teamCount: members.length, qualified, eliminated,
      played, won, drawn, lost, goalsFor: gf, goalsAgainst: ga, points,
      ppg: played ? points / played : 0, winRate: played ? won / played : 0,
      titleProb, knockoutProb, avgElo: Math.round(eloSum / members.length),
      teams: teamRows,
    });
  }
  // Rank by title probability, then knockout reach, then ELO.
  regions.sort((a, b) => b.titleProb - a.titleProb || b.knockoutProb - a.knockoutProb || b.avgElo - a.avgElo);

  // ── Inter-confederation head-to-head ──
  const confOf = new Map(teams.map((t) => [t.id, t.confederation]));
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
    if (m.homeScore > m.awayScore) { home.w++; away.l++; }
    else if (m.homeScore < m.awayScore) { home.l++; away.w++; }
    else { home.d++; away.d++; }
    const margin = Math.abs(m.homeScore - m.awayScore);
    if (margin >= 1) {
      const winnerConf = m.homeScore > m.awayScore ? ca : cb;
      const loserConf = m.homeScore > m.awayScore ? cb : ca;
      const tH = teams.find((t) => t.id === m.homeTeamId), tA = teams.find((t) => t.id === m.awayTeamId);
      if (tH && tA) clashes.push({ label: `${tH.name} ${m.homeScore}–${m.awayScore} ${tA.name}`, winnerConf, loserConf, score: `${m.homeScore}-${m.awayScore}`, margin });
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

  return { regions, matrix, crossRecord, topClashes, totalTitle, presentConfs, meta: CONF_META };
}

export type CivilizationsData = ReturnType<typeof civilizationsView>;
