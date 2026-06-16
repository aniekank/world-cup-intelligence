import 'server-only';

/**
 * Club affiliations for "Club Connections". Loads the precomputed player-id →
 * club map (src/data/cache/clubs.json, built by `npm run data:clubs` across ~30
 * leagues worldwide). World Cup squads share API-Football player ids, so they
 * join directly against this. Cached on globalThis.
 */

export interface ClubAffiliation {
  club: string;
  clubId: number;
  clubLogo: string;
  league: string;
  leagueShort: string;
  leagueColor: string;
  leagueFlag: string;
  country: string;
}

export interface LeagueStat {
  id: number;
  short: string;
  name: string;
  country: string;
  flag: string;
  color: string;
  clubs: number;
  players: number;
}

interface ClubsCache {
  generatedAt: string;
  leagues: LeagueStat[];
  map: Record<string, ClubAffiliation>;
}

const G = globalThis as unknown as {
  __wcClubs?: Map<number, ClubAffiliation>;
  __wcClubLeagues?: LeagueStat[];
  __wcClubsPromise?: Promise<void>;
};

async function load(): Promise<void> {
  try {
    const mod = await import('@/data/cache/clubs.json');
    const cache = ((mod as { default?: unknown }).default ?? mod) as unknown as ClubsCache;
    const m = new Map<number, ClubAffiliation>();
    for (const [id, aff] of Object.entries(cache.map)) m.set(Number(id), aff);
    G.__wcClubs = m;
    G.__wcClubLeagues = cache.leagues ?? [];
  } catch {
    G.__wcClubs = new Map();
    G.__wcClubLeagues = [];
  }
}

async function ensure(): Promise<void> {
  if (G.__wcClubs) return;
  if (!G.__wcClubsPromise) G.__wcClubsPromise = load();
  return G.__wcClubsPromise;
}

/** Player-id → club map (from the precomputed cache). */
export async function getClubMap(): Promise<Map<number, ClubAffiliation>> {
  await ensure();
  return G.__wcClubs ?? new Map();
}

/** Per-league coverage stats from the precompute. */
export async function getLeagueStats(): Promise<LeagueStat[]> {
  await ensure();
  return G.__wcClubLeagues ?? [];
}
