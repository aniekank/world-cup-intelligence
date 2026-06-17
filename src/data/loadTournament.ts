import 'server-only';
import { getTournament, type TournamentInfo } from './tournaments';
import { generateDataset } from './generate';
import { getCachedTournament, setDataset, getActiveTournamentId } from './store';
import type { DatasetSnapshot, Match, MatchEvent, EventType, Team } from '@/domain/types';

/** Map an API-Football event (type + detail) to our EventType. */
function mapEventType(apiType: string, detail: string): EventType {
  const t = apiType.toLowerCase();
  const d = detail.toLowerCase();
  if (t === 'goal') {
    if (d.includes('own')) return 'OWN_GOAL';
    if (d.includes('miss')) return 'PENALTY_MISS';
    if (d.includes('penalty')) return 'PENALTY_GOAL';
    return 'GOAL';
  }
  if (t === 'card') {
    if (d.includes('red')) return 'RED_CARD';
    if (d.includes('second')) return 'SECOND_YELLOW';
    return 'YELLOW_CARD';
  }
  if (t === 'subst') return 'SUBSTITUTION';
  return 'VAR'; // VAR decisions (e.g. "Goal Disallowed - offside") and anything else
}

/** Resolve raw fixture events to our MatchEvent model using the loaded squads. */
function mapFixtureEvents(
  matchId: string,
  raw: import('./providers/apiFootball').RawFixtureEvent[],
  home: Team | undefined,
  away: Team | undefined,
  playerByApi: Map<string, { id: string; teamId: string }>,
): MatchEvent[] {
  const norm = (s: string) => s.toLowerCase().trim();
  return raw.map((e, i) => {
    const player = e.playerApiId != null ? playerByApi.get(String(e.playerApiId)) : undefined;
    const related = e.assistApiId != null ? playerByApi.get(String(e.assistApiId)) : undefined;
    // Team from the scorer when we know them, else by matching the event's team name.
    const teamId =
      player?.teamId ??
      (home && norm(e.teamName) === norm(home.name)
        ? home.id
        : away && norm(e.teamName) === norm(away.name)
          ? away.id
          : home?.id ?? '');
    return {
      id: `${matchId}-e${i}`,
      matchId,
      minute: e.minute,
      addedTime: e.extra,
      type: mapEventType(e.apiType, e.detail),
      teamId,
      playerId: player?.id ?? null,
      relatedPlayerId: related?.id ?? null,
      detail: e.detail,
    };
  });
}

function sourceLabel(t: TournamentInfo): string {
  if (t.source === 'sportmonks') return 'SportMonks (live)';
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
  if ((t.source === 'apifootball' || t.source === 'sportmonks') && !isHealthyLive(snap)) {
    const withSquad = snap.teams.filter((x) => (x.squadIds?.length ?? 0) > 0).length;
    console.warn(`[data] Live feed incomplete (${snap.players.length} players, ${withSquad}/${snap.teams.length} squads) — serving the full simulation instead.`);
    const sim = generateDataset();
    setDataset(sim, 'Simulation (live feed unavailable)', 'simulation');
    return sim;
  }

  setDataset(snap, sourceLabel(t), id);
  return snap;
}

/** Window around kickoff in which a match is plausibly being played (minutes). */
const LIVE_WINDOW_BEFORE_MS = 10 * 60_000;
const LIVE_WINDOW_AFTER_MS = 150 * 60_000;

/**
 * Re-poll the fixtures feed and merge current status/score/minute into the
 * active live snapshot, so in-play games flip to LIVE and scores update without
 * re-fetching squads. Cheap: skips the API call entirely unless some match is
 * actually in its play window, and only swaps the snapshot when something
 * changed. Returns true if the dataset was updated. Safe to call on a timer.
 */
export async function refreshLiveScores(): Promise<boolean> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return false;
  // This in-play refresh is API-Football-specific. When live-2026 runs on
  // SportMonks (or anything else), skip it — the boot snapshot carries the data.
  if (getTournament(getActiveTournamentId())?.source !== 'apifootball') return false;
  const cur = getCachedTournament('live-2026');
  if (!cur) return false;

  const now = Date.now();
  // Track which finished matches we've already pulled a timeline for, so an
  // event-less match isn't re-fetched every tick. Lives on globalThis to survive
  // the module-instance split (same reason the dataset cache does).
  const g = globalThis as unknown as { __wcEventsFetched?: Set<string> };
  const eventsFetched = g.__wcEventsFetched ?? (g.__wcEventsFetched = new Set<string>());

  const needsRefresh = cur.matches.some((m) => {
    const ko = new Date(m.kickoff).getTime();
    const inWindow = now >= ko - LIVE_WINDOW_BEFORE_MS && now <= ko + LIVE_WINDOW_AFTER_MS;
    if (m.status !== 'FINISHED' && inWindow) return true; // in play or about to start
    if (m.status === 'FINISHED' && m.events.length === 0 && !eventsFetched.has(m.id)) return true; // backfill timeline once
    return false;
  });
  if (!needsRefresh) return false; // nothing in play and no timeline to backfill → no API call

  const { fetchApiFootballFixtures, fetchFixtureEvents } = await import('./providers/apiFootball');
  const byId = new Map((await fetchApiFootballFixtures(key)).map((u) => [u.id, u]));

  // Pull the timeline (goals, cards, subs, VAR) for matches that are in play or
  // just finished — a handful of extra calls at most.
  const teamById = new Map(cur.teams.map((t) => [t.id, t]));
  const playerByApi = new Map<string, { id: string; teamId: string }>();
  for (const p of cur.players) {
    const dash = p.id.indexOf('-');
    if (dash >= 0) playerByApi.set(p.id.slice(dash + 1), { id: p.id, teamId: p.teamId });
  }
  const wantEvents = (m: Match): boolean => {
    const status = byId.get(m.id)?.status ?? m.status;
    if (status === 'LIVE' || status === 'HALFTIME') return true; // always refresh a live timeline
    return status === 'FINISHED' && m.events.length === 0 && !eventsFetched.has(m.id); // one-time backfill
  };
  // Cap per tick so a backlog of finished matches backfills gradually, not in one
  // burst that could trip a per-minute rate limit.
  const eventsByMatch = new Map<string, MatchEvent[]>();
  await Promise.all(
    cur.matches.filter(wantEvents).slice(0, 8).map(async (m) => {
      const fixtureId = Number(m.id.replace('m-', ''));
      if (!Number.isFinite(fixtureId)) return;
      const raw = await fetchFixtureEvents(key, fixtureId);
      eventsByMatch.set(m.id, mapFixtureEvents(m.id, raw, teamById.get(m.homeTeamId), teamById.get(m.awayTeamId), playerByApi));
      const status = byId.get(m.id)?.status ?? m.status;
      if (status === 'FINISHED') eventsFetched.add(m.id); // don't re-fetch a finished match, even if it had no events
    }),
  );

  let changed = 0;
  const matches = cur.matches.map((m) => {
    const u = byId.get(m.id);
    const ev = eventsByMatch.get(m.id);
    const scoreChanged =
      !!u && (u.status !== m.status || u.homeScore !== m.homeScore || u.awayScore !== m.awayScore || u.minute !== m.minute);
    const eventsChanged = !!ev && ev.length !== m.events.length;
    if (!scoreChanged && !eventsChanged) return m;
    changed++;
    return {
      ...m,
      ...(u
        ? {
            status: u.status,
            minute: u.minute,
            homeScore: u.homeScore,
            awayScore: u.awayScore,
            homeScoreHT: u.homeScoreHT,
            awayScoreHT: u.awayScoreHT,
            penalties: u.penalties,
          }
        : {}),
      ...(ev ? { events: ev } : {}),
    };
  });
  if (!changed) return false;

  // New snapshot object (not an in-place mutation) so the store's snapshot-keyed
  // indexes + analytics engine rebuild against the fresh scores.
  setDataset({ ...cur, matches, generatedAt: new Date().toISOString() }, 'API-Football (live)', 'live-2026');
  console.log(`[data] Live refresh: ${changed} fixture(s) updated.`);
  return true;
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

  if (t.source === 'sportmonks') {
    const key = process.env.SPORTMONKS_KEY;
    if (!key) throw new Error('SPORTMONKS_KEY not set');
    const { fetchSportMonksSnapshot } = await import('./providers/sportmonks');
    return fetchSportMonksSnapshot(key);
  }

  if (t.source === 'apifootball') {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('API_FOOTBALL_KEY not set');
    const { fetchApiFootballSnapshot } = await import('./providers/apiFootball');
    return fetchApiFootballSnapshot(key);
  }

  throw new Error(`Unsupported source: ${t.source}`);
}
