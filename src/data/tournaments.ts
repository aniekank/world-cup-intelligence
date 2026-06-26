/**
 * Tournament registry — the catalogue of World Cups the platform can analyze.
 * The live edition streams from SportMonks; the four most recent past editions
 * load from precomputed StatsBomb open-data snapshots; every other World Cup
 * (1930 onward) loads from the bundled Fjelstul/datahub archive.
 * The active tournament is switchable at runtime (see src/data/store.ts).
 */

import datahubEditions from './datahub-editions.json';

export type TournamentSource = 'sportmonks' | 'apifootball' | 'statsbomb' | 'datahub' | 'simulation';

export interface TournamentInfo {
  id: string;
  label: string;
  short: string;
  year: number;
  gender: 'men' | 'women';
  host: string;
  source: TournamentSource;
  cacheFile?: string; // bundled snapshot filename (under src/data/cache)
  champion?: string;
  championFlag?: string;
  coverage: 'live' | 'full' | 'historical';
  blurb: string;
}

// Every other World Cup (1930–2015) from the Fjelstul database — results, scorers
// and squads only (pre-tracking era), so the UI degrades the advanced surfaces.
const HISTORICAL: TournamentInfo[] = (datahubEditions as Array<Omit<TournamentInfo, 'source'>>).map((e) => ({
  ...e,
  source: 'datahub',
}));

export const TOURNAMENTS: TournamentInfo[] = [
  {
    id: 'live-2026', label: 'World Cup 2026', short: '2026', year: 2026, gender: 'men',
    host: 'USA · Canada · Mexico', source: 'sportmonks', coverage: 'live',
    championFlag: '🏆', blurb: 'Live — 48 teams, in progress',
  },
  {
    id: 'men-2022', label: 'World Cup 2022', short: '2022', year: 2022, gender: 'men',
    host: 'Qatar', source: 'statsbomb', cacheFile: 'statsbomb-43-106.json',
    champion: 'Argentina', championFlag: '🇦🇷', coverage: 'full',
    blurb: 'Full event data · Messi’s crowning',
  },
  {
    id: 'men-2018', label: 'World Cup 2018', short: '2018', year: 2018, gender: 'men',
    host: 'Russia', source: 'statsbomb', cacheFile: 'statsbomb-43-3.json',
    champion: 'France', championFlag: '🇫🇷', coverage: 'full',
    blurb: 'Full event data · Mbappé arrives',
  },
  {
    id: 'women-2023', label: "Women's World Cup 2023", short: "W'23", year: 2023, gender: 'women',
    host: 'Australia · New Zealand', source: 'statsbomb', cacheFile: 'statsbomb-72-107.json',
    champion: 'Spain', championFlag: '🇪🇸', coverage: 'full',
    blurb: 'Full event data · Spain’s first title',
  },
  {
    id: 'women-2019', label: "Women's World Cup 2019", short: "W'19", year: 2019, gender: 'women',
    host: 'France', source: 'statsbomb', cacheFile: 'statsbomb-72-30.json',
    champion: 'United States', championFlag: '🇺🇸', coverage: 'full',
    blurb: 'Full event data · USA back-to-back',
  },
  {
    id: 'simulation', label: 'Simulated 2026', short: 'Sim', year: 2026, gender: 'men',
    host: 'USA · Canada · Mexico', source: 'simulation', coverage: 'full',
    championFlag: '🎲', blurb: 'Deterministic simulation · offline',
  },
  ...HISTORICAL,
];

export function getTournament(id: string): TournamentInfo | undefined {
  return TOURNAMENTS.find((t) => t.id === id);
}

/** Default active tournament implied by DATA_SOURCE at startup. */
export function defaultTournamentId(): string {
  // Tolerant matching so a spelling slip (e.g. "sportsmonks") doesn't silently
  // fall back to the simulation. 'monk' / 'apifoot' are distinctive enough.
  const src = (process.env.DATA_SOURCE ?? 'seed').toLowerCase().replace(/[^a-z]/g, '');
  if (src.includes('monk') || src.includes('apifoot') || src.includes('footballdata')) return 'live-2026';
  if (src.includes('statsbomb')) return 'men-2022';
  return 'simulation';
}
