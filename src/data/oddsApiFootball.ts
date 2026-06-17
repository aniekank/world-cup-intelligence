import 'server-only';
import { normTeam, type MarketEvent } from './oddsApi';

/**
 * Betting-Edge odds from API-Football (direct api-sports.io host). This is wired
 * ONLY for the betting market comparison — it does NOT change the app's data
 * source (that stays SportMonks via DATA_SOURCE). It reads API_FOOTBALL_KEY and
 * is consumed solely through `getMarketEvents()` in oddsApi.ts.
 *
 * API-Football's /odds payload is keyed by API-Football fixture ids (which don't
 * match our SportMonks fixture ids) and carries no team names, so we first pull
 * the WC fixtures to map fixtureId → team names + kickoff, then emit the shared
 * `MarketEvent` shape that betting.ts joins by team + date. Cached on globalThis.
 */

const BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE = 1; // FIFA World Cup
const SEASON = 2026;
const TTL = 60 * 60 * 1000; // 1h — pre-match prices move slowly

interface AFFixturesResp {
  response: { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } } }[];
}
interface AFOddsResp {
  paging: { current: number; total: number };
  response: {
    fixture: { id: number };
    bookmakers: { name: string; bets: { id: number; name: string; values: { value: string; odd: string }[] }[] }[];
  }[];
}

const G = globalThis as unknown as {
  __afMkt?: MarketEvent[];
  __afMktAt?: number;
  __afMktPromise?: Promise<MarketEvent[]>;
};

async function afGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': key }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`api-football ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** De-vig the Match Winner (1X2) market across all books for one fixture. */
function devig(
  row: AFOddsResp['response'][number],
  meta: { home: string; away: string; date: string },
): MarketEvent | null {
  const probs: { home: number; draw: number; away: number }[] = [];
  const best = { home: 0, draw: 0, away: 0 };
  for (const bk of row.bookmakers ?? []) {
    const mw = bk.bets?.find((b) => b.id === 1 || /match winner/i.test(b.name));
    if (!mw) continue;
    let h = 0, d = 0, a = 0;
    for (const v of mw.values ?? []) {
      const od = Number(v.odd);
      if (!Number.isFinite(od) || od <= 1) continue;
      if (/home|^1$/i.test(v.value)) h = od;
      else if (/draw|^x$/i.test(v.value)) d = od;
      else if (/away|^2$/i.test(v.value)) a = od;
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
    home: normTeam(meta.home), away: normTeam(meta.away),
    homeRaw: meta.home, awayRaw: meta.away, commence: meta.date,
    market: { home: avg('home'), draw: avg('draw'), away: avg('away') }, best, books: probs.length,
  };
}

async function build(key: string): Promise<MarketEvent[]> {
  // 1) fixtures → fixtureId → { home, away, date }
  let meta = new Map<number, { home: string; away: string; date: string }>();
  try {
    const fx = await afGet<AFFixturesResp>(`/fixtures?league=${WC_LEAGUE}&season=${SEASON}`, key);
    for (const r of fx.response ?? []) {
      meta.set(r.fixture.id, { home: r.teams.home.name, away: r.teams.away.name, date: r.fixture.date });
    }
  } catch (e) {
    console.warn('[oddsApiFootball] fixtures fetch failed', e);
    return [];
  }
  // 2) odds (paginated) → MarketEvent[]
  const out: MarketEvent[] = [];
  let page = 1, total = 1;
  do {
    let resp: AFOddsResp;
    try {
      resp = await afGet<AFOddsResp>(`/odds?league=${WC_LEAGUE}&season=${SEASON}&page=${page}`, key);
    } catch (e) {
      console.warn('[oddsApiFootball] odds page failed', page, e);
      break;
    }
    total = resp.paging?.total ?? 1;
    for (const row of resp.response ?? []) {
      const m = meta.get(row.fixture.id);
      if (!m) continue;
      const ev = devig(row, m);
      if (ev) out.push(ev);
    }
    page++;
  } while (page <= total && page <= 12);
  console.log(`[oddsApiFootball] ${out.length} priced WC fixtures (books≈${out[0]?.books ?? 0})`);
  return out;
}

export async function fetchApiFootballMarket(): Promise<MarketEvent[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];
  const now = Date.now();
  if (G.__afMkt && G.__afMktAt && now - G.__afMktAt < TTL) return G.__afMkt;
  if (!G.__afMktPromise) {
    G.__afMktPromise = build(key)
      .then((m) => { G.__afMkt = m; G.__afMktAt = Date.now(); G.__afMktPromise = undefined; return m; })
      .catch((e) => { console.warn('[oddsApiFootball] build error', e); G.__afMktPromise = undefined; return G.__afMkt ?? []; });
  }
  return G.__afMktPromise;
}
