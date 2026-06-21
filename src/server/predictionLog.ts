import 'server-only';
import { bettingEdge } from './betting';

/**
 * Closing-line snapshots for Track Record Phase 2 ("did it beat the bookies?").
 *
 * The market's pre-match price can't be reconstructed after kickoff (the odds
 * feed only carries upcoming games), so we capture each upcoming fixture's model
 * + de-vigged market probabilities to durable storage (Upstash Redis, via its
 * REST API) and keep overwriting until it kicks off — the last write is the
 * closing line. Finished fixtures are never touched, so their snapshot freezes.
 *
 * Entirely gated on env: with no UPSTASH_REDIS_REST_URL/TOKEN every function is a
 * clean no-op, so the app (and Track Record Phase 1) is unaffected.
 */

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const predLogConfigured = (): boolean => Boolean(URL && TOKEN);

type Three = { H: number; D: number; A: number };
export interface PredSnapshot {
  matchId: string;
  kickoff: string;
  model: Three;
  market: Three;
  updatedAt: string;
}

const KEY = (matchId: string) => `predlog:${matchId}`;

async function redis(cmd: (string | number)[]): Promise<unknown> {
  if (!predLogConfigured()) return null;
  try {
    const res = await fetch(URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: unknown };
    return j.result ?? null;
  } catch {
    return null;
  }
}

let lastSnap = 0;

/** Snapshot every upcoming fixture's model + market price. Guarded to ~18 min. */
export async function snapshotUpcoming(force = false): Promise<number> {
  if (!predLogConfigured()) return 0;
  const now = Date.now();
  if (!force && now - lastSnap < 18 * 60 * 1000) return 0;
  lastSnap = now;

  const edge = await bettingEdge();
  if (!edge.available) return 0;
  const stamp = new Date(now).toISOString();
  let written = 0;
  for (const r of edge.rows) {
    const o = (side: 'home' | 'draw' | 'away') => r.outcomes.find((x) => x.side === side);
    const h = o('home'), d = o('draw'), a = o('away');
    if (!h || !d || !a) continue;
    const snap: PredSnapshot = {
      matchId: r.matchId,
      kickoff: r.kickoff,
      model: { H: h.model, D: d.model, A: a.model },
      market: { H: h.market, D: d.market, A: a.market },
      updatedAt: stamp,
    };
    await redis(['SET', KEY(r.matchId), JSON.stringify(snap)]);
    written++;
  }
  return written;
}

/** Read every stored snapshot. */
export async function getSnapshots(): Promise<PredSnapshot[]> {
  if (!predLogConfigured()) return [];
  const keys = (await redis(['KEYS', 'predlog:*'])) as string[] | null;
  if (!keys || keys.length === 0) return [];
  const vals = (await redis(['MGET', ...keys])) as (string | null)[] | null;
  if (!vals) return [];
  const out: PredSnapshot[] = [];
  for (const v of vals) {
    if (!v) continue;
    try { out.push(JSON.parse(v) as PredSnapshot); } catch { /* skip */ }
  }
  return out;
}
