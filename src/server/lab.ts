import 'server-only';
import { getTeams, getMatches, getPlayerViews } from '@/data/store';
import { engine } from '@/analytics';
import { expectedGoals } from '@/analytics/poisson';
import { trackRecord } from '@/server/trackRecord';
import type { Team } from '@/domain/types';

/**
 * Data assembly for the Model Lab. Everything heavy/interactive (PCA, k-means,
 * the Poisson grid, Shapley) is recomputed in the browser from these payloads so
 * the user can drag controls and watch the math move; the server just prepares
 * the inputs. The live Monte Carlo re-simulation is the one exception — it reuses
 * the real engine and lives behind /api/lab/simulate.
 */

export interface LabTeam {
  id: string; name: string; code: string; flag: string; color: string;
  confederation: string; attack: number; defense: number; elo: number; fifaRanking: number;
}
export interface LabEvent { minute: number; kind: 'goal' | 'red'; side: 'home' | 'away' }
export interface LabMatch {
  id: string; label: string; stage: string; kickoff: string; status: string;
  home: LabTeam; away: LabTeam;
  homeScore: number; awayScore: number; events: LabEvent[];
}
export interface Residual { pred: number; actual: number; label: string; side: 'home' | 'away' }
export interface EmbeddingDim { key: string; label: string }
export interface EmbeddingTeam { id: string; name: string; code: string; flag: string; color: string; confederation: string; elo: number; vector: number[] }
export interface CalPair { p: number; y: number; cls: 'H' | 'D' | 'A' }

function toLabTeam(t: Team): LabTeam {
  return {
    id: t.id, name: t.name, code: t.code, flag: t.flag, color: t.primaryColor,
    confederation: t.confederation, attack: t.attackRating, defense: t.defenseRating,
    elo: Math.round(t.elo), fifaRanking: t.fifaRanking,
  };
}

const EMBED_DIMS: EmbeddingDim[] = [
  { key: 'attack', label: 'Attack rating' },
  { key: 'defense', label: 'Defense rating' },
  { key: 'elo', label: 'ELO strength' },
  { key: 'xg', label: 'xG / match' },
  { key: 'shots', label: 'Shots / match' },
  { key: 'creativity', label: 'Creativity (xA + key passes) / match' },
  { key: 'defwork', label: 'Defensive actions / match' },
  { key: 'progression', label: 'Progression / match' },
];

export function labData() {
  const eng = engine();
  const teams = getTeams();
  const labTeams = teams.map(toLabTeam).sort((a, b) => b.elo - a.elo);

  // ── Embedding style vectors ──
  // Aggregate squad stats per team, normalized per match played so teams with
  // more games aren't inflated. The three rating dims are always meaningful;
  // the player-derived dims fill in as the tournament is played.
  const byTeam = new Map<string, { xG: number; shots: number; xA: number; keyPasses: number; tackles: number; interceptions: number; prog: number }>();
  for (const p of getPlayerViews()) {
    let v = byTeam.get(p.teamId);
    if (!v) { v = { xG: 0, shots: 0, xA: 0, keyPasses: 0, tackles: 0, interceptions: 0, prog: 0 }; byTeam.set(p.teamId, v); }
    v.xG += p.stats.xG; v.shots += p.stats.shots; v.xA += p.stats.xA; v.keyPasses += p.stats.keyPasses;
    v.tackles += p.stats.tackles; v.interceptions += p.stats.interceptions;
    v.prog += p.stats.progressivePasses + p.stats.progressiveCarries;
  }
  const embeddingTeams: EmbeddingTeam[] = teams.map((t) => {
    const s = byTeam.get(t.id) ?? { xG: 0, shots: 0, xA: 0, keyPasses: 0, tackles: 0, interceptions: 0, prog: 0 };
    const pld = Math.max(eng.standingsByTeam.get(t.id)?.played ?? 0, 1);
    return {
      id: t.id, name: t.name, code: t.code, flag: t.flag, color: t.primaryColor, confederation: t.confederation,
      elo: Math.round(t.elo),
      vector: [
        t.attackRating, t.defenseRating, t.elo,
        s.xG / pld, s.shots / pld, (s.xA + s.keyPasses) / pld,
        (s.tackles + s.interceptions) / pld, s.prog / pld,
      ],
    };
  });

  // ── Sample matches for the heatmap + explainer (upcoming first, then recent) ──
  const refT = new Map(teams.map((t) => [t.id, t]));
  const mkMatch = (m: ReturnType<typeof getMatches>[number]): LabMatch | null => {
    const h = refT.get(m.homeTeamId), a = refT.get(m.awayTeamId);
    if (!h || !a) return null;
    const events: LabEvent[] = m.events
      .flatMap((e): LabEvent[] => {
        const homeSide = e.teamId === m.homeTeamId;
        const min = Math.min(120, e.minute + (e.addedTime ?? 0));
        if (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') return [{ minute: min, kind: 'goal', side: homeSide ? 'home' : 'away' }];
        if (e.type === 'OWN_GOAL') return [{ minute: min, kind: 'goal', side: homeSide ? 'away' : 'home' }]; // benefits the opponent
        if (e.type === 'RED_CARD' || e.type === 'SECOND_YELLOW') return [{ minute: min, kind: 'red', side: homeSide ? 'home' : 'away' }];
        return [];
      })
      .sort((x, y) => x.minute - y.minute);
    return { id: m.id, label: `${h.name} v ${a.name}`, stage: m.stage, kickoff: m.kickoff, status: m.status, home: toLabTeam(h), away: toLabTeam(a), homeScore: m.homeScore, awayScore: m.awayScore, events };
  };
  const upcoming = getMatches().filter((m) => m.status === 'SCHEDULED').sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 8);
  const recent = getMatches().filter((m) => m.status === 'FINISHED').sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 6);
  const live = getMatches().filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');
  const sampleMatches = [...live, ...upcoming, ...recent].map(mkMatch).filter((x): x is LabMatch => Boolean(x));
  // De-dup by id, cap.
  const seen = new Set<string>();
  const matches = sampleMatches.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).slice(0, 14);

  // ── Calibration pairs from the track record (3 one-vs-rest pairs per match) ──
  const tr = trackRecord();
  const calPairs: CalPair[] = [];
  for (const r of tr.rows) {
    (['H', 'D', 'A'] as const).forEach((cls) => calPairs.push({ p: r.probs[cls], y: r.actual === cls ? 1 : 0, cls }));
  }

  // ── Model residuals: predicted (expected) goals vs actual, per side, for
  // every finished match — shows where the goals model over/under-shoots. ──
  const residuals: Residual[] = [];
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const h = refT.get(m.homeTeamId), a = refT.get(m.awayTeamId);
    if (!h || !a) continue;
    const lh = expectedGoals(h, a, true), la = expectedGoals(a, h, false);
    residuals.push({ pred: Math.round(lh * 100) / 100, actual: m.homeScore, label: `${h.code} v ${a.code}`, side: 'home' });
    residuals.push({ pred: Math.round(la * 100) / 100, actual: m.awayScore, label: `${h.code} v ${a.code}`, side: 'away' });
  }
  const resN = residuals.length;
  const mae = resN ? residuals.reduce((s, r) => s + Math.abs(r.pred - r.actual), 0) / resN : 0;
  const bias = resN ? residuals.reduce((s, r) => s + (r.actual - r.pred), 0) / resN : 0;

  // Default team for the MC simulator: the top contender by title odds.
  const ranked = [...teams].sort((a, b) => (eng.forecasts.get(b.id)?.winTitle ?? 0) - (eng.forecasts.get(a.id)?.winTitle ?? 0));
  const defaultTeamId = ranked[0]?.id ?? labTeams[0]?.id ?? '';

  return {
    teams: labTeams,
    matches,
    embedding: { dims: EMBED_DIMS, teams: embeddingTeams },
    calibration: { pairs: calPairs, n: tr.n, brier: tr.brier, baselineBrier: tr.baselineBrier, skill: tr.skill, hitRate: tr.hitRate },
    residuals: { points: residuals, mae: Math.round(mae * 100) / 100, bias: Math.round(bias * 100) / 100, n: resN },
    defaultTeamId,
  };
}

export type LabData = ReturnType<typeof labData>;
