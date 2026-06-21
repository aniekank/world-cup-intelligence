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
  byKey?: Record<string, ClubAffiliation>;
}

const G = globalThis as unknown as {
  __wcClubs?: Map<number, ClubAffiliation>;
  __wcClubsByKey?: Map<string, ClubAffiliation>;
  __wcClubLeagues?: LeagueStat[];
  __wcClubsPromise?: Promise<void>;
};

/**
 * Cross-provider match keys: accent-stripped surname token(s) + birthdate.
 * Mirrors the keys built in scripts/fetch-clubs.mjs so World Cup squads
 * (SportMonks ids) join the API-Football club map by identity, not by a shared
 * id namespace. We try every name token except the given name (plus the last
 * token), so compound surnames match whichever token each provider treats as
 * the last name; the exact DOB keeps it precise. (WC-024)
 */
export function clubMatchKeys(name?: string | null, dob?: string | null): string[] {
  if (!name || !dob) return [];
  const toks = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s'-]/g, ' ').replace(/-/g, ' ').trim()
    .split(/\s+/).filter((t) => t.length > 1);
  if (!toks.length) return [];
  const set = new Set<string>();
  // Every token after the given name is a surname candidate…
  for (const t of toks.slice(1)) set.add(`${t}|${dob}`);
  // …and always the last token (covers single-token / surname-only names).
  set.add(`${toks[toks.length - 1]}|${dob}`);
  return [...set];
}

async function load(): Promise<void> {
  try {
    const mod = await import('@/data/cache/clubs.json');
    const cache = ((mod as { default?: unknown }).default ?? mod) as unknown as ClubsCache;
    const m = new Map<number, ClubAffiliation>();
    for (const [id, aff] of Object.entries(cache.map)) m.set(Number(id), aff);
    const k = new Map<string, ClubAffiliation>();
    for (const [key, aff] of Object.entries(cache.byKey ?? {})) k.set(key, aff);
    G.__wcClubs = m;
    G.__wcClubsByKey = k;
    G.__wcClubLeagues = cache.leagues ?? [];
  } catch {
    G.__wcClubs = new Map();
    G.__wcClubsByKey = new Map();
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

/** "surname|dob" → club map — the live join key for SportMonks squads. */
export async function getClubKeyMap(): Promise<Map<string, ClubAffiliation>> {
  await ensure();
  return G.__wcClubsByKey ?? new Map();
}

/** Per-league coverage stats from the precompute. */
export async function getLeagueStats(): Promise<LeagueStat[]> {
  await ensure();
  return G.__wcClubLeagues ?? [];
}
