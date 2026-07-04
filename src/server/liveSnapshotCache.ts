/**
 * Last-known-good live snapshot cache (WC-075).
 *
 * When the live feed is unavailable at boot (e.g. an API-Football quota outage),
 * the app otherwise falls all the way back to the placeholder simulation. Render
 * wipes the filesystem on every deploy, so a disk cache wouldn't survive the very
 * redeploy that triggers the failed boot — the only store that persists across
 * deploys is Upstash Redis, which the app already uses for the prediction log.
 *
 * So on every successful full live load we stash a gzip-compressed snapshot in
 * Redis, and on a failed boot we restore it (labelled "cached") instead of the
 * simulation — real, if slightly stale, data. Entirely gated on the Upstash env:
 * with no UPSTASH_REDIS_REST_URL/TOKEN every function is a graceful no-op.
 */
import type { DatasetSnapshot } from '@/domain/types';

// Load zlib at runtime, hidden from the bundler: instrumentation.ts (which pulls
// this in transitively) is compiled for the edge runtime too, where a static
// `import 'zlib'` fails to resolve. This only ever executes on the Node server. (WC-075)
type Zlib = typeof import('zlib');
// eslint-disable-next-line no-eval
const zlib = (): Zlib => (eval('require') as NodeRequire)('zlib');

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'livesnap:live-2026';
const TTL_SECONDS = 36 * 60 * 60; // expire after 36h — never serve ancient data (the sim is better than that)
const PERSIST_THROTTLE_MS = 5 * 60_000;

export const snapshotCacheConfigured = (): boolean => Boolean(URL && TOKEN);

async function redis(cmd: (string | number)[]): Promise<unknown> {
  if (!snapshotCacheConfigured()) return null;
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

// Serialize helpers — exported so the round-trip is hermetically testable.
export function encodeSnapshot(snap: DatasetSnapshot): string {
  return zlib().gzipSync(Buffer.from(JSON.stringify(snap))).toString('base64');
}
export function decodeSnapshot(blob: string): DatasetSnapshot {
  return JSON.parse(zlib().gunzipSync(Buffer.from(blob, 'base64')).toString('utf8')) as DatasetSnapshot;
}

const healthy = (s: DatasetSnapshot | null | undefined): boolean =>
  Boolean(s && s.teams?.length && s.players?.length && s.matches?.length);

let lastPersist = 0;
/** Stash a healthy live snapshot (throttled, best-effort). */
export async function persistLiveSnapshot(snap: DatasetSnapshot, now: number = Date.now()): Promise<void> {
  if (!snapshotCacheConfigured() || !healthy(snap)) return;
  if (now - lastPersist < PERSIST_THROTTLE_MS) return;
  lastPersist = now;
  try {
    await redis(['SET', KEY, encodeSnapshot(snap), 'EX', String(TTL_SECONDS)]);
  } catch {
    /* best-effort */
  }
}

/** Restore the last-known-good live snapshot, or null if none / not configured. */
export async function restoreLiveSnapshot(): Promise<DatasetSnapshot | null> {
  if (!snapshotCacheConfigured()) return null;
  try {
    const blob = (await redis(['GET', KEY])) as string | null;
    if (!blob) return null;
    const snap = decodeSnapshot(blob);
    return healthy(snap) ? snap : null;
  } catch {
    return null;
  }
}
