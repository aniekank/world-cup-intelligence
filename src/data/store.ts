/**
 * Repository layer. The running app uses the deterministic seeded dataset; in
 * production (DATA_SOURCE=postgres) these selectors would resolve against
 * Prisma. Everything is memoized at module scope so the dataset is generated
 * exactly once per server process.
 */

import { generateDataset } from './generate';
import type {
  DatasetSnapshot,
  Team,
  Player,
  PlayerStats,
  Match,
  Group,
  PlayerView,
  ID,
  Position,
} from '@/domain/types';

/**
 * The dataset cache lives on `globalThis`, not a module-level variable. Next.js
 * runs `instrumentation.ts` in a SEPARATE module instance from request handlers,
 * so a plain module variable set during the live-data bootstrap would be
 * invisible to pages. globalThis is shared across all instances in the process.
 */
const G = globalThis as unknown as {
  __wcCache?: DatasetSnapshot; // the active snapshot
  __wcSource?: string; // human label of the active source
  __wcActiveId?: string; // active tournament id
  __wcById?: Map<string, DatasetSnapshot>; // per-tournament snapshot cache
};

function byId(): Map<string, DatasetSnapshot> {
  if (!G.__wcById) G.__wcById = new Map();
  return G.__wcById;
}

/** The data source label actually serving the running app. */
export function getActiveSource(): string {
  return G.__wcSource ?? 'simulation';
}

/** The active tournament id (e.g. 'live-2026', 'men-2022'). */
export function getActiveTournamentId(): string {
  return G.__wcActiveId ?? 'simulation';
}

/** A previously-loaded snapshot for instant re-switching, if cached. */
export function getCachedTournament(id: string): DatasetSnapshot | undefined {
  return byId().get(id);
}

/** Provenance + capability flags for the active dataset (drives degradation). */
export function datasetMeta() {
  return (
    dataset().meta ?? { source: 'simulation', hasAdvancedMetrics: true, hasShotData: true }
  );
}

export function dataset(): DatasetSnapshot {
  if (!G.__wcCache) {
    G.__wcCache = generateDataset();
    G.__wcActiveId = 'simulation';
    G.__wcSource = 'simulation';
    byId().set('simulation', G.__wcCache);
  }
  return G.__wcCache;
}

/**
 * Make `snapshot` the active dataset, cache it under `id`, and invalidate all
 * derived indexes + the analytics engine. The whole app reads `dataset()`, so
 * this switches every page/route to the new tournament.
 */
export function setDataset(snapshot: DatasetSnapshot, source = 'live', id = 'live-2026'): void {
  byId().set(id, snapshot);
  G.__wcCache = snapshot;
  G.__wcSource = source;
  G.__wcActiveId = id;
  _teamIndex = null;
  _playerIndex = null;
  _statsIndex = null;
  _matchIndex = null;
  _percentileCache = null;
  // Invalidate the analytics engine snapshot (lives on globalThis too)
  (globalThis as unknown as { __wcEngine?: unknown }).__wcEngine = undefined;
}

// ── Indexes (built once) ─────────────────────────────────────
let _teamIndex: Map<ID, Team> | null = null;
let _playerIndex: Map<ID, Player> | null = null;
let _statsIndex: Map<ID, PlayerStats> | null = null;
let _matchIndex: Map<ID, Match> | null = null;

// The snapshot the indexes below were built from. instrumentation.ts runs in a
// SEPARATE module instance from the request handlers, so setDataset()'s in-instance
// invalidation can't reach a handler instance that already built its indexes from
// the startup-default simulation. Keying the indexes to the snapshot identity —
// which lives on globalThis and is shared across instances — makes every instance
// self-heal the instant the active snapshot swaps (live-load completion, or a
// tournament switch). Without this, getPlayers() returns the NEW snapshot's rows
// while getPlayer()/getTeam() look them up in a STALE index → every lookup misses
// and the whole app renders empty despite the data being present.
let _indexedSnap: DatasetSnapshot | null = null;

function syncIndexes(): void {
  const snap = dataset();
  if (_indexedSnap === snap) return;
  _teamIndex = new Map(snap.teams.map((t) => [t.id, t]));
  _playerIndex = new Map(snap.players.map((p) => [p.id, p]));
  _statsIndex = new Map(Object.entries(snap.playerStats));
  _matchIndex = new Map(snap.matches.map((m) => [m.id, m]));
  _percentileCache = null; // recomputed lazily against the new snapshot
  _indexedSnap = snap;
}

function teamIndex(): Map<ID, Team> {
  syncIndexes();
  return _teamIndex!;
}
function playerIndex(): Map<ID, Player> {
  syncIndexes();
  return _playerIndex!;
}
function statsIndex(): Map<ID, PlayerStats> {
  syncIndexes();
  return _statsIndex!;
}
function matchIndex(): Map<ID, Match> {
  syncIndexes();
  return _matchIndex!;
}

// ── Basic accessors ──────────────────────────────────────────
export const getCompetition = () => dataset().competition;
export const getTeams = (): Team[] => dataset().teams;
export const getTeam = (id: ID): Team | undefined => teamIndex().get(id);
export const getGroups = (): Group[] => dataset().groups;
export const getGroup = (id: ID): Group | undefined => dataset().groups.find((g) => g.id === id);
export const getPlayers = (): Player[] => dataset().players;
export const getPlayer = (id: ID): Player | undefined => playerIndex().get(id);
export const getPlayerStats = (id: ID): PlayerStats | undefined => statsIndex().get(id);
export const getMatches = (): Match[] => dataset().matches;
export const getMatch = (id: ID): Match | undefined => matchIndex().get(id);

export const getSquad = (teamId: ID): Player[] =>
  getPlayers().filter((p) => p.teamId === teamId);

export const getTeamMatches = (teamId: ID): Match[] =>
  getMatches()
    .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

export const getLiveMatches = (): Match[] =>
  getMatches().filter((m) => m.status === 'LIVE' || m.status === 'HALFTIME');

export const getFinishedMatches = (): Match[] =>
  getMatches().filter((m) => m.status === 'FINISHED');

// ── Per-90 & percentile engine ───────────────────────────────
// Percentiles are computed against positional peers with >=45 minutes so that
// scouting comparisons are apples-to-apples.

const PER90_METRICS: (keyof PlayerStats)[] = [
  'goals', 'assists', 'xG', 'xA', 'shots', 'shotsOnTarget', 'keyPasses',
  'progressivePasses', 'progressiveCarries', 'passesCompleted', 'tackles',
  'interceptions', 'ballRecoveries', 'pressuresApplied', 'touchesInBox',
];

function per90(stats: PlayerStats): Record<string, number> {
  const out: Record<string, number> = {};
  const mins = Math.max(stats.minutes, 1);
  for (const m of PER90_METRICS) {
    out[m] = Math.round(((stats[m] as number) / mins) * 90 * 100) / 100;
  }
  out.passAccuracy = stats.passes > 0 ? Math.round((stats.passesCompleted / stats.passes) * 1000) / 10 : 0;
  out.shotConversion = stats.shots > 0 ? Math.round((stats.goals / stats.shots) * 1000) / 10 : 0;
  out.xgPerShot = stats.shots > 0 ? Math.round((stats.xG / stats.shots) * 100) / 100 : 0;
  out.goalsMinusXg = Math.round((stats.goals - stats.xG) * 10) / 10;
  out.duelWinPct = stats.duelsTotal > 0 ? Math.round((stats.duelsWon / stats.duelsTotal) * 1000) / 10 : 0;
  return out;
}

let _percentileCache: Map<Position, Map<string, number[]>> | null = null;
function percentileTables(): Map<Position, Map<string, number[]>> {
  syncIndexes();
  if (_percentileCache) return _percentileCache;
  const byPos = new Map<Position, PlayerView['per90'][]>();
  for (const p of getPlayers()) {
    const st = getPlayerStats(p.id);
    if (!st || st.minutes < 45) continue;
    const arr = byPos.get(p.position) ?? [];
    arr.push(per90(st));
    byPos.set(p.position, arr);
  }
  const tables = new Map<Position, Map<string, number[]>>();
  byPos.forEach((rows, pos) => {
    const metricMap = new Map<string, number[]>();
    if (rows.length) {
      for (const key of Object.keys(rows[0]!)) {
        metricMap.set(
          key,
          rows.map((r) => r[key] ?? 0).sort((a, b) => a - b),
        );
      }
    }
    tables.set(pos, metricMap);
  });
  _percentileCache = tables;
  return tables;
}

function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 50;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

export function getPlayerView(id: ID): PlayerView | undefined {
  const player = getPlayer(id);
  if (!player) return undefined;
  const team = getTeam(player.teamId);
  if (!team) return undefined; // team not resolved (e.g. data mid-load) — omit rather than crash
  const stats = getPlayerStats(id) ?? emptyStatsFor(id);
  const p90 = per90(stats);
  const table = percentileTables().get(player.position);
  const percentiles: Record<string, number> = {};
  if (table) {
    for (const [key, val] of Object.entries(p90)) {
      const sorted = table.get(key);
      // Omit metrics the active data source doesn't provide (uniformly 0 across
      // the field) — their percentiles are meaningless and otherwise render as a
      // false "0th percentile" weakness (see WC-016).
      if (sorted && sorted.length && (sorted[0] !== 0 || sorted[sorted.length - 1] !== 0)) {
        percentiles[key] = percentileRank(sorted, val);
      }
    }
  }
  return {
    ...player,
    team: { id: team.id, name: team.name, code: team.code, flag: team.flag },
    stats,
    per90: p90,
    percentiles,
  };
}

export function getPlayerViews(): PlayerView[] {
  return getPlayers()
    .map((p) => getPlayerView(p.id)!)
    .filter(Boolean);
}

function emptyStatsFor(playerId: ID): PlayerStats {
  return {
    playerId, minutes: 0, appearances: 0, goals: 0, assists: 0, xG: 0, xA: 0,
    shots: 0, shotsOnTarget: 0, bigChancesCreated: 0, bigChancesMissed: 0,
    passes: 0, passesCompleted: 0, progressivePasses: 0, progressiveCarries: 0,
    keyPasses: 0, tackles: 0, interceptions: 0, ballRecoveries: 0, duelsWon: 0,
    duelsTotal: 0, pressuresApplied: 0, pressRegains: 0, touches: 0, touchesInBox: 0,
    yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsWon: 0, saves: 0,
    goalsConceded: 0, cleanSheets: 0, formIndex: 50,
  };
}
