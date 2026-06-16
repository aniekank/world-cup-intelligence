import 'server-only';

/**
 * Bookmaker odds (Match Winner / 1X2) for the live World Cup, from API-Football.
 * For each fixture we compute the de-vigged consensus implied probability across
 * books and the best available decimal price per outcome. Used purely to compare
 * the model against the market — NOT a betting recommendation engine. Cached on
 * globalThis with a short refresh.
 */

const BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE = 1;
const SEASON = 2026;

export interface FixtureOdds {
  fixtureId: number;
  market: { home: number; draw: number; away: number }; // de-vigged consensus prob
  best: { home: number; draw: number; away: number }; // best decimal odds across books
  books: number;
}

const G = globalThis as unknown as { __wcOdds?: Map<number, FixtureOdds>; __wcOddsAt?: number; __wcOddsPromise?: Promise<Map<number, FixtureOdds>> };
const TTL = 5 * 60 * 1000;

interface AFOddsResp {
  response: {
    fixture: { id: number };
    bookmakers: { name: string; bets: { id: number; name: string; values: { value: string; odd: string }[] }[] }[];
  }[];
  paging: { current: number; total: number };
}

async function fetchPage(key: string, page: number): Promise<AFOddsResp> {
  const res = await fetch(`${BASE}/odds?league=${WC_LEAGUE}&season=${SEASON}&page=${page}`, {
    headers: { 'x-apisports-key': key },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`odds → ${res.status}`);
  return (await res.json()) as AFOddsResp;
}

async function build(key: string): Promise<Map<number, FixtureOdds>> {
  const map = new Map<number, FixtureOdds>();
  let page = 1;
  let total = 1;
  do {
    let resp: AFOddsResp;
    try {
      resp = await fetchPage(key, page);
    } catch {
      break;
    }
    total = resp.paging?.total ?? 1;
    for (const row of resp.response ?? []) {
      const probs: { home: number; draw: number; away: number }[] = [];
      const best = { home: 0, draw: 0, away: 0 };
      for (const bk of row.bookmakers ?? []) {
        const mw = bk.bets?.find((b) => b.id === 1 || /match winner/i.test(b.name));
        if (!mw) continue;
        const o = { home: 0, draw: 0, away: 0 };
        for (const v of mw.values) {
          const od = Number(v.odd);
          if (!Number.isFinite(od) || od <= 1) continue;
          if (/home|^1$/i.test(v.value)) o.home = od;
          else if (/draw|^x$/i.test(v.value)) o.draw = od;
          else if (/away|^2$/i.test(v.value)) o.away = od;
        }
        if (o.home && o.draw && o.away) {
          const raw = { home: 1 / o.home, draw: 1 / o.draw, away: 1 / o.away };
          const s = raw.home + raw.draw + raw.away;
          probs.push({ home: raw.home / s, draw: raw.draw / s, away: raw.away / s }); // de-vig
          best.home = Math.max(best.home, o.home);
          best.draw = Math.max(best.draw, o.draw);
          best.away = Math.max(best.away, o.away);
        }
      }
      if (probs.length) {
        const avg = (k: 'home' | 'draw' | 'away') => probs.reduce((a, p) => a + p[k], 0) / probs.length;
        map.set(row.fixture.id, {
          fixtureId: row.fixture.id,
          market: { home: avg('home'), draw: avg('draw'), away: avg('away') },
          best,
          books: probs.length,
        });
      }
    }
    page++;
  } while (page <= total && page <= 12);
  return map;
}

export async function getOddsMap(): Promise<Map<number, FixtureOdds>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return new Map();
  const now = Date.now();
  if (G.__wcOdds && G.__wcOddsAt && now - G.__wcOddsAt < TTL) return G.__wcOdds;
  if (!G.__wcOddsPromise) {
    G.__wcOddsPromise = build(key)
      .then((m) => {
        G.__wcOdds = m;
        G.__wcOddsAt = Date.now();
        G.__wcOddsPromise = undefined;
        return m;
      })
      .catch(() => new Map<number, FixtureOdds>());
  }
  return G.__wcOddsPromise;
}
