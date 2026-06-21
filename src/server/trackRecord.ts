import 'server-only';
import { getMatches, getTeam } from '@/data/store';
import { predictMatch } from '@/analytics/poisson';
import type { Team, Match } from '@/domain/types';

/**
 * Track record — does the model actually call results?
 *
 * For every finished match we take the model's pre-match probabilities
 * (predictMatch runs off the STATIC attack/defense ratings, which results never
 * mutate — only ELO does — so this is a fair pre-match read, not hindsight) and
 * score them against what happened: hit rate, multiclass Brier, log loss, all
 * versus a coin-flip baseline.
 *
 * This is the model-vs-actual half. The "did it beat the bookies?" half needs
 * the market's pre-match closing line stored per fixture — a durable-storage
 * job (Phase 2), since the live odds feed only carries upcoming games.
 */

type Outcome = 'H' | 'D' | 'A';

export interface TrackRow {
  match: Match;
  home: Team;
  away: Team;
  score: string;
  probs: { H: number; D: number; A: number };
  pick: Outcome;
  actual: Outcome;
  hit: boolean;
  brier: number;
  confidence: number; // model prob on its own pick
}

export function trackRecord() {
  const finished = getMatches()
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => (a.kickoff < b.kickoff ? 1 : -1)); // most recent first

  const rows: TrackRow[] = [];
  let brierSum = 0;
  let baselineSum = 0;
  let logloss = 0;

  for (const m of finished) {
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) continue;
    const pred = predictMatch(home, away);
    const probs = { H: pred.homeWin, D: pred.draw, A: pred.awayWin };
    const actual: Outcome = m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D';
    const pick: Outcome = probs.H >= probs.D && probs.H >= probs.A ? 'H' : probs.D >= probs.A ? 'D' : 'A';
    const hit = pick === actual;

    const outcomes: Outcome[] = ['H', 'D', 'A'];
    const brier = outcomes.reduce((s, o) => s + (probs[o] - (o === actual ? 1 : 0)) ** 2, 0);
    const baseline = outcomes.reduce((s, o) => s + (1 / 3 - (o === actual ? 1 : 0)) ** 2, 0);
    brierSum += brier;
    baselineSum += baseline;
    logloss += -Math.log(Math.max(probs[actual], 1e-6));

    rows.push({ match: m, home, away, score: `${m.homeScore}-${m.awayScore}`, probs, pick, actual, hit, brier, confidence: probs[pick] });
  }

  const n = rows.length;
  const correct = rows.filter((r) => r.hit).length;
  const brier = n ? brierSum / n : 0;
  const baselineBrier = n ? baselineSum / n : 0;

  // Highlights: most confident correct call, and the biggest miss.
  const bestCall = [...rows].filter((r) => r.hit).sort((a, b) => b.probs[b.actual] - a.probs[a.actual])[0] ?? null;
  const worstMiss = [...rows].filter((r) => !r.hit).sort((a, b) => b.brier - a.brier)[0] ?? null;

  return {
    n,
    correct,
    hitRate: n ? correct / n : 0,
    brier,
    baselineBrier,
    skill: baselineBrier > 0 ? (baselineBrier - brier) / baselineBrier : 0, // Brier skill score vs coin flip
    logloss: n ? logloss / n : 0,
    bestCall,
    worstMiss,
    rows,
  };
}
