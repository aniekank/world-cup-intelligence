import 'server-only';
import { TOURNAMENTS } from '@/data/tournaments';
import { loadTournamentSnapshot } from '@/data/loadTournament';

/**
 * Cross-tournament summary stats for the "Through the Years" narrative. Computed
 * once from the precomputed StatsBomb snapshots and memoized. The live edition is
 * excluded (it's in progress).
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
  topScorer: { name: string; goals: number } | null;
}

let cache: TournamentSummary[] | null = null;

export async function tournamentSummaries(): Promise<TournamentSummary[]> {
  if (cache) return cache;
  const full = TOURNAMENTS.filter((t) => t.source === 'statsbomb');
  const out: TournamentSummary[] = [];
  for (const t of full) {
    try {
      const snap = await loadTournamentSnapshot(t.id);
      const goals = snap.matches.reduce((s, m) => s + m.homeScore + m.awayScore, 0);
      const allShots = snap.matches.flatMap((m) => m.shots);
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
