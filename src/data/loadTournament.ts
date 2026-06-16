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
/**
 * A live snapshot is "healthy" only when most teams actually have squads. The
 * API-Football feed can return the team/fixture skeleton while the heavier
 * per-team squad calls fail (rate-limit, key, or quota), leaving a hollow
 * dataset. We never serve that — see the fallback in activateTournament.
 */
function isHealthyLive(snap: DatasetSnapshot): boolean {
  const withSquad = snap.teams.filter((t) => (t.squadIds?.length ?? 0) > 0).length;
  return snap.teams.length > 0 && withSquad >= snap.teams.length * 0.8 && snap.players.length > 100;
}

export async function activateTournament(id: string): Promise<DatasetSnapshot> {
  const t = getTournament(id);
  if (!t) throw new Error(`Unknown tournament: ${id}`);
  const snap = getCachedTournament(id) ?? (await loadTournamentSnapshot(id));

  // If the live feed came back hollow, fall back to the complete built-in
  // simulation (no external calls, always fully populated) rather than serving
  // a broken dataset. It auto-upgrades to live on the next load once the feed
  // is healthy again. The hollow snapshot is intentionally NOT cached, so a
  // later switch re-fetches.
  if (t.source === 'apifootball' && !isHealthyLive(snap)) {
    const withSquad = snap.teams.filter((x) => (x.squadIds?.length ?? 0) > 0).length;
    console.warn(`[data] Live feed incomplete (${snap.players.length} players, ${withSquad}/${snap.teams.length} squads) — serving the full simulation instead.`);
    const sim = generateDataset();
    setDataset(sim, 'Simulation (live feed unavailable)', 'simulation');
    return sim;
  }

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
