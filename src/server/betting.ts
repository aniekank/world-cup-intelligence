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
  edge: number; // model - market (raw disagreement, always honest)
  ev: number; // expected value on the market-shrunk probability (see shrunkEv)
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

// Guardrails so the value list stays credible (see BUGS.md WC-022). Long odds mean
// the market is very confident, and a seeded Poisson's disagreement there is almost
// always model error, not signal. Left raw, EV = model*odds - 1 explodes on longshots
// (model 20% vs market 8% at 12.0 reads +140% EV and dominated the list — e.g. it
// surfaced "Iraq beat France" as the top pick). Two guards:
//   1. Shrink the model toward the de-vigged market as the price lengthens, so the
//      EV we display and rank on no longer balloons on longshots. The raw `edge`
//      (model - market) is kept untouched so the genuine disagreement still shows.
//   2. Never flag value on an outcome the model itself rates below MIN_MODEL_P.
const MIN_MODEL_P = 0.12;
const VALUE_THRESHOLD = 0.02;
function shrunkEv(model: number, market: number, odds: number): number {
  if (odds <= 0) return -1;
  const w = Math.max(0, Math.min(1, 1 - (odds - 2) / 10)); // 1.0 at evens → 0 by 12.0
  const p = market + (model - market) * w;
  return p * odds - 1;
}
const isValue = (o: EdgeOutcome): boolean => o.model >= MIN_MODEL_P && o.ev > VALUE_THRESHOLD;

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
      label, side, model, market: mkt, odds: price, edge: model - mkt, ev: shrunkEv(model, mkt, price),
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
    valueBets: rows.filter((r) => r.outcomes.some(isValue)),
  };
}
