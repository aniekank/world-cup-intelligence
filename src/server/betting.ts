import 'server-only';
import { getActiveTournamentId, getMatches, getTeam } from '@/data/store';
import { engine } from '@/analytics';
import { getOddsMap } from '@/data/odds';

/**
 * Model-vs-market comparison for upcoming fixtures. Joins our Monte Carlo /
 * Poisson win probabilities to de-vigged bookmaker consensus + best price, and
 * computes the implied edge and expected value (EV) per outcome.
 *
 * This is an EDUCATIONAL comparison tool. The betting market is sharper than any
 * simple model; a positive-EV signal here means "our model disagrees with the
 * market", which is usually the model being wrong — not a profitable bet.
 */

export interface EdgeOutcome {
  label: string; // Home / Draw / Away
  side: 'home' | 'draw' | 'away';
  model: number; // model probability
  market: number; // de-vigged market probability
  odds: number; // best available decimal price
  edge: number; // model - market
  ev: number; // model*odds - 1
}

export interface EdgeRow {
  matchId: string;
  fixtureId: number;
  kickoff: string;
  home: { code: string; name: string; flag: string };
  away: { code: string; name: string; flag: string };
  books: number;
  outcomes: EdgeOutcome[];
  bestEv: number;
}

export async function bettingEdge() {
  const isLive = getActiveTournamentId() === 'live-2026';
  const odds = isLive ? await getOddsMap() : new Map();
  const eng = engine();

  const rows: EdgeRow[] = [];
  for (const m of getMatches()) {
    if (m.status === 'FINISHED') continue;
    const fixtureId = Number(m.id.replace('m-', ''));
    const o = odds.get(fixtureId);
    const pred = eng.predictions.get(m.id);
    if (!o || !pred) continue;
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) continue;

    const mk = (side: 'home' | 'draw' | 'away', label: string, model: number, market: number, price: number): EdgeOutcome => ({
      label, side, model, market, odds: price, edge: model - market, ev: price > 0 ? model * price - 1 : -1,
    });
    const outcomes = [
      mk('home', `${home.code} win`, pred.homeWin, o.market.home, o.best.home),
      mk('draw', 'Draw', pred.draw, o.market.draw, o.best.draw),
      mk('away', `${away.code} win`, pred.awayWin, o.market.away, o.best.away),
    ];
    rows.push({
      matchId: m.id,
      fixtureId,
      kickoff: m.kickoff,
      home: { code: home.code, name: home.name, flag: home.flag },
      away: { code: away.code, name: away.name, flag: away.flag },
      books: o.books,
      outcomes,
      bestEv: Math.max(...outcomes.map((x) => x.ev)),
    });
  }

  rows.sort((a, b) => b.bestEv - a.bestEv);
  return {
    isLive,
    available: isLive && rows.length > 0,
    rows,
    valueBets: rows.filter((r) => r.bestEv > 0.02),
  };
}
