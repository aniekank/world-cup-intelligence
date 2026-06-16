import 'server-only';
import { getTournament, type TournamentInfo } from './tournaments';
import { generateDataset } from './generate';
import { getCachedTournament, setDataset } from './store';
import type { DatasetSnapshot } from '@/domain/types';

function sourceLabel(t: TournamentInfo): string {
  if (t.source === 'apifootball') return 'API-Football (live)';
  if (t.source === 'statsbomb') return `StatsBomb · ${t.label}`;
  return 'Simulation';
}

/**
 * Make a tournament the active dataset for the whole app. Uses the per-tournament
 * cache for instant re-switching; otherwise loads it. Returns the snapshot.
 */
export async function activateTournament(id: string): Promise<DatasetSnapshot> {
  const t = getTournament(id);
  if (!t) throw new Error(`Unknown tournament: ${id}`);
  const snap = getCachedTournament(id) ?? (await loadTournamentSnapshot(id));
  setDataset(snap, sourceLabel(t), id);
  return snap;
}

/**
 * Resolve a tournament id to its DatasetSnapshot. Simulation is generated;
 * historical editions load from precomputed StatsBomb caches; the live edition
 * fetches API-Football. Never called on the hot path — results are cached
 * per-tournament in the store.
 */
export async function loadTournamentSnapshot(id: string): Promise<DatasetSnapshot> {
  const t = getTournament(id);
  if (!t) throw new Error(`Unknown tournament: ${id}`);

  if (t.source === 'simulation') return generateDataset();

  if (t.source === 'statsbomb') {
    if (!t.cacheFile) throw new Error(`No cache file for ${id}`);
    // Variable dynamic import → webpack bundles all cache JSONs as a context.
    const mod = await import(`./cache/${t.cacheFile}`);
    return ((mod as { default?: unknown }).default ?? mod) as unknown as DatasetSnapshot;
  }

  if (t.source === 'apifootball') {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('API_FOOTBALL_KEY not set');
    const { fetchApiFootballSnapshot } = await import('./providers/apiFootball');
    return fetchApiFootballSnapshot(key);
  }

  throw new Error(`Unsupported source: ${t.source}`);
}
