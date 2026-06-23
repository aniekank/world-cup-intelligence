import 'server-only';
import { TOURNAMENTS } from '@/data/tournaments';
import { loadTournamentSnapshot } from '@/data/loadTournament';

/**
 * Cross-tournament summary stats for the "Through the Years" narrative. Computed
 * once from the precomputed snapshots and memoized. The live edition is excluded
 * (it's in progress). Two tiers of source data:
 *   - StatsBomb (the 4 most recent men's/women's WCs): full shot-level data → xG.
 *   - datahub archive (every WC 1930–2015): results, scorers & champions, but no
 *     shot/xG data — `hasShots` is false, and shot-derived fields stay 0 so the
 *     UI can omit them rather than render a fabricated zero.
 */
export interface TournamentSummary {
  id: string;
  label: string;
  short: string;
  year: number;
  gender: 'men' | 'women';
  host: string;
  champion?: string;
  championFlag?: string;
  teams: number;
  matches: number;
  goals: number;
  goalsPerGame: number;
  shots: number;
  xgPerShot: number;
  conversion: number; // goals / shots %
  hasShots: boolean; // false for the datahub archive (no shot-level data)
  topScorer: { name: string; goals: number } | null;
}

let cache: TournamentSummary[] | null = null;

export async function tournamentSummaries(): Promise<TournamentSummary[]> {
  if (cache) return cache;
  // Every finished edition we hold real data for: the 4 StatsBomb tournaments
  // (with shot-level xG) plus the full datahub archive (1930–2015, results +
  // scorers, no xG). The live edition is in progress and excluded.
  const full = TOURNAMENTS.filter((t) => t.source === 'statsbomb' || t.source === 'datahub');
  const out: TournamentSummary[] = [];
  for (const t of full) {
    try {
      const snap = await loadTournamentSnapshot(t.id);
      const goals = snap.matches.reduce((s, m) => s + m.homeScore + m.awayScore, 0);
      const allShots = snap.matches.flatMap((m) => m.shots ?? []);
      const shots = allShots.length;
      const xg = allShots.reduce((s, sh) => s + sh.xG, 0);
      const scoredShots = allShots.filter((sh) => sh.outcome === 'goal' || sh.outcome === 'penalty_goal').length;
      const top = Object.values(snap.playerStats).sort((a, b) => b.goals - a.goals)[0];
      const topName = top ? snap.players.find((p) => p.id === top.playerId)?.name : null;
      out.push({
        id: t.id, label: t.label, short: t.short, year: t.year, gender: t.gender, host: t.host,
        champion: t.champion, championFlag: t.championFlag,
        teams: snap.teams.length, matches: snap.matches.length, goals,
        goalsPerGame: snap.matches.length ? goals / snap.matches.length : 0,
        shots, xgPerShot: shots ? xg / shots : 0,
        conversion: shots ? (scoredShots / shots) * 100 : 0,
        hasShots: shots > 0,
        topScorer: topName && top ? { name: topName, goals: top.goals } : null,
      });
    } catch {
      /* skip a tournament that fails to load */
    }
  }
  out.sort((a, b) => a.year - b.year);
  cache = out;
  return out;
}
