import 'server-only';
import { getTeams, getPlayerViews, getMatches, datasetMeta } from '@/data/store';
import { rankingsView } from '@/server/queries';
import type { PlayerView } from '@/domain/types';

/**
 * Data for the Analytics page. The guiding rule is the project's no-fabrication
 * contract: only surface a metric that has real data on the ACTIVE source, and
 * prefer the level at which the number actually exists.
 *
 * The load-bearing fact: per-PLAYER xG is unavailable on the live feed (neither
 * API-Football nor the frozen SportMonks capture carries it — it reads 0 for
 * every player, WC-066). But per-TEAM xG IS available (the API-Football overlay
 * writes it to `m.teamStats[id].xG`). So all xG-driven views here are computed at
 * the TEAM level, where the data is real, instead of showing empty player charts.
 */

export interface Scatter { x: number; y: number; label: string; z: number }
export interface Bar { label: string; value: number; color?: string }

function statOf(p: PlayerView, key: string): number {
  return (p.stats as unknown as Record<string, number>)[key] ?? 0;
}

export function analyticsView() {
  const teams = getTeams();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const pv = getPlayerViews();
  const matches = getMatches();
  const finished = matches.filter((m) => m.status === 'FINISHED');

  // ── Availability flags (drive graceful degradation, never show 0-as-data) ──
  const hasPlayerXg = pv.some((p) => p.stats.xG > 0);
  const hasXa = pv.some((p) => p.stats.xA > 0);
  const hasProg = pv.some((p) => p.stats.progressivePasses > 0);
  const hasPressures = pv.some((p) => p.stats.pressuresApplied > 0);
  const hasBigChances = pv.some((p) => p.stats.bigChancesCreated > 0);
  const hasShotData = datasetMeta().hasShotData;

  // ── Team-level goals / xG / shots from finished matches (xG is real here) ──
  interface TAgg { goals: number; xg: number; shots: number; played: number }
  const tAgg = new Map<string, TAgg>();
  const bump = (id: string, goals: number, xg: number, shots: number) => {
    const a = tAgg.get(id) ?? { goals: 0, xg: 0, shots: 0, played: 0 };
    a.goals += goals; a.xg += xg; a.shots += shots; a.played += 1;
    tAgg.set(id, a);
  };
  for (const m of finished) {
    const ts = m.teamStats ?? {};
    bump(m.homeTeamId, m.homeScore, ts[m.homeTeamId]?.xG ?? 0, ts[m.homeTeamId]?.shots ?? 0);
    bump(m.awayTeamId, m.awayScore, ts[m.awayTeamId]?.xG ?? 0, ts[m.awayTeamId]?.shots ?? 0);
  }
  const teamXG = [...tAgg.values()].reduce((s, a) => s + a.xg, 0);
  const hasTeamXg = teamXG > 0.5;

  // ── Tournament shooting aggregates (player shots + all goals) ──
  const totalShots = pv.reduce((s, p) => s + p.stats.shots, 0);
  const goals = pv.reduce((s, p) => s + p.stats.goals, 0);
  const bigChances = Math.round(pv.reduce((s, p) => s + p.stats.bigChancesCreated, 0));
  const conversion = totalShots ? (goals / totalShots) * 100 : 0;
  // xG per shot uses tournament totals on both sides (team xG, all shots) — a
  // sound aggregate ratio even though the two come from different feeds.
  const xgPerShot = hasTeamXg && totalShots ? teamXG / totalShots : 0;

  // ── Set-piece xG share — shot-level on BOTH sides of the ratio (scope-consistent). ──
  const allShots = finished.flatMap((m) => m.shots);
  const totalShotXg = allShots.reduce((s, sh) => s + sh.xG, 0);
  const setPieceXG = allShots
    .filter((s) => s.situation === 'corner' || s.situation === 'set_piece' || s.situation === 'free_kick' || s.situation === 'direct_free_kick')
    .reduce((s, sh) => s + sh.xG, 0);
  const setPieceShare = totalShotXg ? (setPieceXG / totalShotXg) * 100 : 0;

  // ── Team profile: offense vs defense rating (always available) ──
  const teamProfile: Scatter[] = rankingsView().map((r) => ({ x: r.offenseRating, y: r.defenseRating, label: r.team.code, z: r.powerRating }));

  // ── Team finishing: xG (x) vs goals (y) — real data, replaces the empty player chart ──
  const teamFinishing: Scatter[] = [...tAgg.entries()]
    .filter(([, a]) => a.xg > 0.3)
    .map(([id, a]) => ({ x: Math.round(a.xg * 10) / 10, y: a.goals, label: teamMap.get(id)?.code ?? id, z: a.shots || a.played }))
    .sort((p, q) => q.y - p.y);

  // ── Team xG leaders ──
  const xgLeaders: Bar[] = [...tAgg.entries()]
    .filter(([, a]) => a.xg > 0)
    .sort((p, q) => q[1].xg - p[1].xg)
    .slice(0, 10)
    .map(([id, a]) => ({ label: teamMap.get(id)?.code ?? id, value: Math.round(a.xg * 10) / 10, color: teamMap.get(id)?.primaryColor }));

  // ── Player creativity (xA vs assists) — only when xA is real ──
  const sortedByXa = [...pv].sort((a, b) => b.stats.xA - a.stats.xA);
  const creativity: Scatter[] = hasXa
    ? sortedByXa
        .filter((p) => p.stats.minutes >= 90 && (p.stats.xA > 0.4 || p.stats.assists > 0))
        .slice(0, 120)
        .map((p) => ({ x: Math.round(p.stats.xA * 10) / 10, y: p.stats.assists, label: p.name, z: p.stats.keyPasses }))
    : [];

  // ── Player leaders for progressive / tackles / pressing ──
  const leaders = (key: string, n = 10): Bar[] =>
    [...pv]
      .sort((a, b) => statOf(b, key) - statOf(a, key))
      .filter((p) => statOf(p, key) > 0)
      .slice(0, n)
      .map((p) => ({ label: `${p.team.code} ${p.name.split(' ').slice(-1)[0]}`, value: Math.round(statOf(p, key) * 10) / 10, color: teamMap.get(p.teamId)?.primaryColor }));

  return {
    flags: { hasPlayerXg, hasTeamXg, hasXa, hasProg, hasPressures, hasBigChances, hasShotData },
    stats: { xgPerShot, conversion, bigChances, teamXG, goals, totalShots, setPieceShare },
    teamProfile,
    teamFinishing,
    xgLeaders,
    creativity,
    progressive: hasProg ? leaders('progressivePasses') : [],
    tacklers: leaders('tackles'),
    pressing: hasPressures ? leaders('pressuresApplied') : [],
  };
}

export type AnalyticsData = ReturnType<typeof analyticsView>;
