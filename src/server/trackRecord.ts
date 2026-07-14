import 'server-only';
import { getMatches, getTeam, getCompetition } from '@/data/store';
import { predictMatch, hostAdvantageFor } from '@/analytics/poisson';
import { advanceProbabilities } from '@/lib/format';
import { getSnapshots, predLogConfigured } from './predictionLog';
import type { Team, Match } from '@/domain/types';

type Out = 'H' | 'D' | 'A';
const brierOf = (p: { H: number; D: number; A: number }, actual: Out) =>
  (['H', 'D', 'A'] as Out[]).reduce((s, o) => s + (p[o] - (o === actual ? 1 : 0)) ** 2, 0);

/**
 * Track record — does the model actually call results?
 *
 * PHASE-AWARE. A group game is a 3-way market (home / draw / away), so we grade
 * the model's pre-match H/D/A probabilities against the result. A knockout tie
 * has no draw — someone advances — so we grade the model's 2-way ADVANCE
 * probability (draw folded into each side's chance via `advanceProbabilities`,
 * WC-058) against who actually went through (penalty shootout included). Metrics
 * (hit rate, Brier, log loss, skill vs a per-match coin-flip baseline) aggregate
 * across both, and we bucket predictions by confidence for a calibration curve.
 *
 * predictMatch runs off the STATIC attack/defense ratings (results never mutate
 * them — only ELO does), so this is a fair pre-match read, not hindsight.
 */

export interface TrackCell {
  code: string; // team code, or "Draw"
  prob: number;
  pick: boolean;
  actual: boolean;
}
export interface TrackRow {
  match: Match;
  home: Team;
  away: Team;
  score: string;
  mode: 'result' | 'advance';
  cells: TrackCell[]; // 3 for a group game (H/D/A), 2 for a knockout (advance)
  pickLabel: string;
  actualLabel: string;
  hit: boolean;
  brier: number;
  confidence: number; // model prob on its own pick
}

const CALIB_BUCKETS = [
  { lo: 0.5, hi: 0.6 },
  { lo: 0.6, hi: 0.7 },
  { lo: 0.7, hi: 0.8 },
  { lo: 0.8, hi: 1.01 },
];

export function trackRecord() {
  const finished = getMatches()
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => (a.kickoff < b.kickoff ? 1 : -1)); // most recent first

  const rows: TrackRow[] = [];
  let brierSum = 0, baselineSum = 0, logloss = 0;
  const byPhase = { group: { n: 0, correct: 0 }, knockout: { n: 0, correct: 0 } };
  const calib = CALIB_BUCKETS.map((b) => ({ ...b, n: 0, hits: 0, sumConf: 0 }));

  for (const m of finished) {
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) continue;
    // Same neutral-venue treatment the live predictions use — hosts only. (WC-087)
    const pred = predictMatch(home, away, hostAdvantageFor(home, away, getCompetition().hostCountries));
    const isKO = m.stage !== 'GROUP';
    let row: TrackRow, brier: number, baseline: number, conf: number, hit: boolean;

    if (isKO) {
      // 2-way: which side advances (draw folded in). Actual = decided by the
      // scoreline, or the penalty shootout when level.
      const adv = advanceProbabilities({ homeWin: pred.homeWin, draw: pred.draw, awayWin: pred.awayWin });
      const advancer: 'home' | 'away' =
        m.homeScore > m.awayScore ? 'home'
        : m.awayScore > m.homeScore ? 'away'
        : m.penalties ? (m.penalties.home >= m.penalties.away ? 'home' : 'away')
        : adv.home >= adv.away ? 'home' : 'away';
      const pick: 'home' | 'away' = adv.home >= adv.away ? 'home' : 'away';
      hit = pick === advancer;
      conf = adv[pick];
      brier = (adv.home - (advancer === 'home' ? 1 : 0)) ** 2 + (adv.away - (advancer === 'away' ? 1 : 0)) ** 2;
      baseline = 0.5; // two-way coin flip: 2 × 0.25
      logloss += -Math.log(Math.max(adv[advancer], 1e-6));
      row = {
        match: m, home, away,
        score: `${m.homeScore}-${m.awayScore}${m.penalties ? ` (${m.penalties.home}-${m.penalties.away} p)` : ''}`,
        mode: 'advance',
        cells: [
          { code: home.code, prob: adv.home, pick: pick === 'home', actual: advancer === 'home' },
          { code: away.code, prob: adv.away, pick: pick === 'away', actual: advancer === 'away' },
        ],
        pickLabel: (pick === 'home' ? home : away).name, actualLabel: (advancer === 'home' ? home : away).name,
        hit, brier, confidence: conf,
      };
    } else {
      const probs = { H: pred.homeWin, D: pred.draw, A: pred.awayWin };
      const actual: Out = m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D';
      const pick: Out = probs.H >= probs.D && probs.H >= probs.A ? 'H' : probs.D >= probs.A ? 'D' : 'A';
      hit = pick === actual;
      conf = probs[pick];
      brier = (['H', 'D', 'A'] as Out[]).reduce((s, o) => s + (probs[o] - (o === actual ? 1 : 0)) ** 2, 0);
      baseline = (['H', 'D', 'A'] as Out[]).reduce((s, o) => s + (1 / 3 - (o === actual ? 1 : 0)) ** 2, 0);
      logloss += -Math.log(Math.max(probs[actual], 1e-6));
      const label = (o: Out) => (o === 'H' ? home.name : o === 'A' ? away.name : 'Draw');
      row = {
        match: m, home, away, score: `${m.homeScore}-${m.awayScore}`, mode: 'result',
        cells: [
          { code: home.code, prob: probs.H, pick: pick === 'H', actual: actual === 'H' },
          { code: 'Draw', prob: probs.D, pick: pick === 'D', actual: actual === 'D' },
          { code: away.code, prob: probs.A, pick: pick === 'A', actual: actual === 'A' },
        ],
        pickLabel: label(pick), actualLabel: label(actual),
        hit, brier, confidence: conf,
      };
    }

    brierSum += brier; baselineSum += baseline;
    const ph = isKO ? byPhase.knockout : byPhase.group;
    ph.n++; if (hit) ph.correct++;
    const bucket = calib.find((c) => conf >= c.lo && conf < c.hi);
    if (bucket) { bucket.n++; if (hit) bucket.hits++; bucket.sumConf += conf; }
    rows.push(row);
  }

  const n = rows.length;
  const correct = rows.filter((r) => r.hit).length;
  const brier = n ? brierSum / n : 0;
  const baselineBrier = n ? baselineSum / n : 0;
  const bestCall = [...rows].filter((r) => r.hit).sort((a, b) => b.confidence - a.confidence)[0] ?? null;
  const worstMiss = [...rows].filter((r) => !r.hit).sort((a, b) => b.brier - a.brier)[0] ?? null;
  const rate = (x: { n: number; correct: number }) => (x.n ? x.correct / x.n : 0);

  return {
    n,
    correct,
    hitRate: n ? correct / n : 0,
    brier,
    baselineBrier,
    skill: baselineBrier > 0 ? (baselineBrier - brier) / baselineBrier : 0, // Brier skill score vs a coin flip
    logloss: n ? logloss / n : 0,
    byPhase: {
      group: { ...byPhase.group, hitRate: rate(byPhase.group) },
      knockout: { ...byPhase.knockout, hitRate: rate(byPhase.knockout) },
    },
    // Reliability: within each confidence band, did the model hit as often as it claimed?
    calibration: calib
      .filter((c) => c.n > 0)
      .map((c) => ({ range: `${Math.round(c.lo * 100)}–${Math.round(Math.min(c.hi, 1) * 100)}%`, n: c.n, predicted: c.sumConf / c.n, observed: c.hits / c.n })),
    bestCall,
    worstMiss,
    rows,
    knockoutRows: rows.filter((r) => r.mode === 'advance'),
    groupRows: rows.filter((r) => r.mode === 'result'),
  };
}

export interface MarketRow {
  match: Match;
  home: Team;
  away: Team;
  score: string;
  actual: Out;
  modelBrier: number;
  marketBrier: number;
  modelBeat: boolean;
}

/**
 * Model vs the bookies — joins the stored pre-kickoff closing-line snapshots to
 * finished results. Needs Upstash configured + snapshots captured before those
 * games kicked off, so it builds up over the tournament (CLV can't be backfilled).
 */
export async function marketComparison() {
  if (!predLogConfigured()) return { configured: false, n: 0, rows: [] as MarketRow[], modelBrier: 0, marketBrier: 0, modelBeats: 0 };
  const snaps = new Map((await getSnapshots()).map((s) => [s.matchId, s]));
  const rows: MarketRow[] = [];
  let modelSum = 0, marketSum = 0, modelBeats = 0;
  for (const m of getMatches()) {
    if (m.status !== 'FINISHED') continue;
    const s = snaps.get(m.id);
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!s || !home || !away) continue;
    const actual: Out = m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D';
    const modelBrier = brierOf(s.model, actual);
    const marketBrier = brierOf(s.market, actual);
    modelSum += modelBrier; marketSum += marketBrier;
    const modelBeat = modelBrier < marketBrier;
    if (modelBeat) modelBeats++;
    rows.push({ match: m, home, away, score: `${m.homeScore}-${m.awayScore}`, actual, modelBrier, marketBrier, modelBeat });
  }
  const n = rows.length;
  rows.sort((a, b) => (a.match.kickoff < b.match.kickoff ? 1 : -1));
  return { configured: true, n, rows, modelBrier: n ? modelSum / n : 0, marketBrier: n ? marketSum / n : 0, modelBeats };
}
