import 'server-only';

/**
 * Bookmaker odds (1X2 / h2h) for the live World Cup, from The Odds API
 * (the-odds-api.com). Free tier ≈ 500 requests/month. We fetch the consensus
 * across books, de-vig it into an implied probability, and keep the best
 * available decimal price per outcome — purely to compare our model against the
 * market (NOT a betting recommendation).
 *
 * The Odds API has its own event ids and returns full team NAMES + a commence
 * time — it shares no id namespace with our fixtures (which come from
 * SportMonks). So consumers join by normalized team pair + kickoff date, via the
 * `normTeam` helper exported here. Cached on globalThis with an hourly refresh
 * to stay inside the free quota.
 *
 * Setup: create a free key at https://the-odds-api.com and set ODDS_API_KEY.
 * Optional overrides: ODDS_API_SPORT (default soccer_fifa_world_cup),
 * ODDS_API_REGIONS (default eu — 1 region = 1 quota credit per refresh).
 */

const BASE = 'https://api.the-odds-api.com/v4';
const TTL = 60 * 60 * 1000; // 1h — pre-match prices move slowly; keeps us inside the free quota

export interface MarketEvent {
  home: string; // normalized name key for event.home_team
  away: string; // normalized name key for event.away_team
  homeRaw: string;
  awayRaw: string;
  commence: string; // ISO kickoff per the market
  market: { home: number; draw: number; away: number }; // de-vigged consensus prob (home/draw/away as listed)
  best: { home: number; draw: number; away: number }; // best decimal price across books
  books: number;
}

interface OAOutcome { name: string; price: number }
interface OAMarket { key: string; outcomes: OAOutcome[] }
interface OABook { key: string; title: string; markets: OAMarket[] }
interface OAEvent { id: string; commence_time: string; home_team: string; away_team: string; bookmakers: OABook[] }
interface OASport { key: string; active: boolean; has_outrights: boolean }

const G = globalThis as unknown as {
  __wcMktEvents?: MarketEvent[];
  __wcMktAt?: number;
  __wcMktPromise?: Promise<MarketEvent[]>;
  __wcMktSport?: string;
};

/**
 * Canonical aliases for nations the two sources (API-Football odds ↔ SportMonks
 * fixtures) spell differently. Both sides are normalized through this map so the
 * team-pair join lands. Covers every divergent WC-2026 name.
 */
const ALIAS: Record<string, string> = {
  // United States
  usa: 'united states', 'united states of america': 'united states',
  // Korea
  'korea republic': 'south korea', korea: 'south korea', 'korea dpr': 'north korea',
  // Iran
  'ir iran': 'iran',
  // China (not in WC26, harmless)
  'china pr': 'china',
  // Ivory Coast
  'cote divoire': 'ivory coast', "cote d'ivoire": 'ivory coast',
  // Czechia
  czechia: 'czech republic',
  // Cape Verde
  'cabo verde': 'cape verde', 'cape verde islands': 'cape verde',
  // DR Congo (API-Football: "Congo DR")
  'congo dr': 'dr congo', 'democratic republic of the congo': 'dr congo', 'congo democratic republic': 'dr congo',
  // Türkiye
  'türkiye': 'turkey', turkiye: 'turkey',
  // UAE (not in WC26, harmless)
  uae: 'united arab emirates',
};

export function normTeam(s: string): string {
  const n = (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fa|national team|football team)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIAS[n] ?? n;
}

async function oaGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null; remaining: string | null }> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 3600 } });
  const remaining = res.headers.get('x-requests-remaining');
  if (!res.ok) return { ok: false, status: res.status, data: null, remaining };
  return { ok: true, status: res.status, data: (await res.json()) as T, remaining };
}

/** Resolve the active World Cup sport key (the slug can be season-specific). */
async function resolveSport(key: string): Promise<string | null> {
  if (G.__wcMktSport) return G.__wcMktSport;
  const configured = process.env.ODDS_API_SPORT || 'soccer_fifa_world_cup';
  const { ok, data } = await oaGet<OASport[]>(`/sports/?apiKey=${key}&all=true`);
  if (ok && data) {
    const exact = data.find((s) => s.key === configured && !s.has_outrights);
    const fuzzy = data.find((s) => /world_cup/.test(s.key) && /soccer/.test(s.key) && !s.has_outrights && s.active);
    const chosen = exact?.key || fuzzy?.key || configured;
    G.__wcMktSport = chosen;
    return chosen;
  }
  return configured; // fall back; the odds call will simply return empty if wrong
}

function devig(ev: OAEvent): MarketEvent | null {
  const probs: { home: number; draw: number; away: number }[] = [];
  const best = { home: 0, draw: 0, away: 0 };
  for (const bk of ev.bookmakers ?? []) {
    const mk = bk.markets?.find((m) => m.key === 'h2h');
    if (!mk) continue;
    let h = 0, d = 0, a = 0;
    for (const o of mk.outcomes ?? []) {
      const price = Number(o.price);
      if (!Number.isFinite(price) || price <= 1) continue;
      if (o.name === ev.home_team) h = price;
      else if (o.name === ev.away_team) a = price;
      else if (/draw|^x$|tie/i.test(o.name)) d = price;
    }
    if (h && d && a) {
      const raw = { home: 1 / h, draw: 1 / d, away: 1 / a };
      const s = raw.home + raw.draw + raw.away;
      probs.push({ home: raw.home / s, draw: raw.draw / s, away: raw.away / s });
      best.home = Math.max(best.home, h);
      best.draw = Math.max(best.draw, d);
      best.away = Math.max(best.away, a);
    }
  }
  if (!probs.length) return null;
  const avg = (k: 'home' | 'draw' | 'away') => probs.reduce((x, p) => x + p[k], 0) / probs.length;
  return {
    home: normTeam(ev.home_team), away: normTeam(ev.away_team),
    homeRaw: ev.home_team, awayRaw: ev.away_team, commence: ev.commence_time,
    market: { home: avg('home'), draw: avg('draw'), away: avg('away') }, best, books: probs.length,
  };
}

async function build(key: string): Promise<MarketEvent[]> {
  const sport = await resolveSport(key);
  if (!sport) return [];
  const regions = process.env.ODDS_API_REGIONS || 'eu';
  const { ok, status, data, remaining } = await oaGet<OAEvent[]>(
    `/sports/${sport}/odds/?apiKey=${key}&regions=${regions}&markets=h2h&oddsFormat=decimal`,
  );
  if (!ok || !data) {
    console.warn(`[oddsApi] odds fetch failed (HTTP ${status}) for sport=${sport}`);
    return [];
  }
  const out = data.map(devig).filter((e): e is MarketEvent => e !== null);
  console.log(`[oddsApi] ${out.length} priced events (sport=${sport}, books≈${out[0]?.books ?? 0}, quota left=${remaining ?? '?'})`);
  return out;
}

export async function getMarketEvents(): Promise<MarketEvent[]> {
  // Source preference for the Betting-Edge market: API-Football when a key is
  // configured (richer book consensus + larger quota), else The Odds API. Both
  // return the same MarketEvent[] shape, joined by betting.ts. This selection is
  // scoped to odds only — it does NOT affect the app's DATA_SOURCE.
  if (process.env.API_FOOTBALL_KEY) {
    try {
      const { fetchApiFootballMarket } = await import('./oddsApiFootball');
      const af = await fetchApiFootballMarket();
      if (af.length) return af;
    } catch (e) {
      console.warn('[market] API-Football odds unavailable, falling back to The Odds API', e);
    }
  }

  const key = process.env.ODDS_API_KEY;
  if (!key) return [];
  const now = Date.now();
  if (G.__wcMktEvents && G.__wcMktAt && now - G.__wcMktAt < TTL) return G.__wcMktEvents;
  if (!G.__wcMktPromise) {
    G.__wcMktPromise = build(key)
      .then((m) => {
        G.__wcMktEvents = m;
        G.__wcMktAt = Date.now();
        G.__wcMktPromise = undefined;
        return m;
      })
      .catch((e) => {
        console.warn('[oddsApi] build error', e);
        G.__wcMktPromise = undefined;
        return G.__wcMktEvents ?? [];
      });
  }
  return G.__wcMktPromise;
}
