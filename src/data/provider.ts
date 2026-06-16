/**
 * Data-source abstraction. The app talks to a `DataProvider`, never directly to
 * a feed. The default `seed` provider runs the deterministic simulation engine
 * (zero infra). A real provider (e.g. football-data.org, Opta, StatsBomb) maps a
 * live feed into the same `DatasetSnapshot` shape — so swapping to real 2026
 * World Cup data is a one-line config change, not a rewrite.
 *
 * Selection is driven by DATA_SOURCE:
 *   seed         → simulation engine (default, offline)
 *   statsbomb    → StatsBomb open data (free, real, full shot-level, historical)
 *   footballdata → football-data.org (live 2026, requires FOOTBALL_DATA_API_KEY)
 *   apifootball  → API-Football (live 2026 + xG, requires API_FOOTBALL_KEY)
 */

import type { DatasetSnapshot } from '@/domain/types';

export interface DataProvider {
  readonly name: string;
  /** Whether this provider supplies shot-level/advanced metrics (xG, PPDA…). */
  readonly hasAdvancedMetrics: boolean;
  load(): Promise<DatasetSnapshot>;
}

export type DataSource = 'seed' | 'statsbomb' | 'footballdata' | 'apifootball';

export function resolveDataSource(): DataSource {
  const src = (process.env.DATA_SOURCE ?? 'seed').toLowerCase();
  if (src === 'statsbomb') return 'statsbomb';
  if (src === 'footballdata') return 'footballdata';
  if (src === 'apifootball') return 'apifootball';
  return 'seed';
}
