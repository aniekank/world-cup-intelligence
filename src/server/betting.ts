import 'server-only';
import { getActiveTournamentId, getMatches, getTeam } from '@/data/store';
import { engine } from '@/analytics';
import { getMarketEvents, normTeam, type MarketEvent } from '@/data/oddsApi';

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
  const events = isLive ? await getMarketEvents() : [];
  const eng = engine();

  // The market source (The Odds API) shares no id namespace with our fixtures
  // (SportMonks), so we join by unordered team pair, disambiguating same-pair
  // fixtures by nearest kickoff. Index every priced event by its team pair.
  const byPair = new Map<string, MarketEvent[]>();
  for (const e of events) {
    const k = [e.home, e.away].sort().join('|');
    const bucket = byPair.get(k);
    if (bucket) bucket.push(e);
    else byPair.set(k, [e]);
  }

  const rows: EdgeRow[] = [];
  const usedPairs = new Set<string>();
  for (const m of getMatches()) {
    if (m.status === 'FINISHED') continue;
    const pred = eng.predictions.get(m.id);
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!pred || !home || !away) continue;

    const hk = normTeam(home.name);
    const ak = normTeam(away.name);
    const pairKey = [hk, ak].sort().join('|');
    const cands = byPair.get(pairKey);
    const first = cands?.[0];
    if (!first) continue;
    usedPairs.add(pairKey);

    // disambiguate by nearest kickoff if a pair meets more than once (knockout rematch)
    const kickoffMs = Date.parse(m.kickoff);
    let e: MarketEvent = first;
    if (cands.length > 1 && Number.isFinite(kickoffMs)) {
      for (const c of cands) {
        if (Math.abs(Date.parse(c.commence) - kickoffMs) < Math.abs(Date.parse(e.commence) - kickoffMs)) e = c;
      }
    }

    // orient the market to OUR home/away (the book may list the pairing reversed)
    const direct = e.home === hk;
    const market = direct ? e.market : { home: e.market.away, draw: e.market.draw, away: e.market.home };
    const best = direct ? e.best : { home: e.best.away, draw: e.best.draw, away: e.best.home };

    const fixtureId = Number(m.id.replace('m-', ''));
    const mk = (side: 'home' | 'draw' | 'away', label: string, model: number, mkt: number, price: number): EdgeOutcome => ({
      label, side, model, market: mkt, odds: price, edge: model - mkt, ev: price > 0 ? model * price - 1 : -1,
    });
    const outcomes = [
      mk('home', `${home.code} win`, pred.homeWin, market.home, best.home),
      mk('draw', 'Draw', pred.draw, market.draw, best.draw),
      mk('away', `${away.code} win`, pred.awayWin, market.away, best.away),
    ];
    rows.push({
      matchId: m.id,
      fixtureId,
      kickoff: m.kickoff,
      home: { code: home.code, name: home.name, flag: home.flag },
      away: { code: away.code, name: away.name, flag: away.flag },
      books: e.books,
      outcomes,
      bestEv: Math.max(...outcomes.map((x) => x.ev)),
    });
  }

  // Surface market events that matched no fixture — usually a team-name spelling
  // the alias map in oddsApi.ts hasn't reconciled yet.
  if (events.length) {
    const unmatched = events.filter((e) => !usedPairs.has([e.home, e.away].sort().join('|')));
    if (unmatched.length) {
      console.warn('[betting] unmatched market events:', unmatched.map((e) => `${e.homeRaw} v ${e.awayRaw}`).join('; '));
    }
  }

  rows.sort((a, b) => b.bestEv - a.bestEv);
  return {
    isLive,
    hasMarket: events.length > 0,
    available: isLive && rows.length > 0,
    rows,
    valueBets: rows.filter((r) => r.bestEv > 0.02),
  };
}
