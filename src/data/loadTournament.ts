import 'server-only';
import { getTournament, type TournamentInfo } from './tournaments';
import { generateDataset } from './generate';
import { getCachedTournament, setDataset, getActiveTournamentId, getMatches, getTeams } from './store';
import type { FixtureUpdate, RawFixtureEvent } from './providers/apiFootball';
import type { DatasetSnapshot, Match, MatchEvent, EventType, Team } from '@/domain/types';

/** Map an API-Football event (type + detail) to our EventType. */
function mapEventType(apiType: string, detail: string): EventType {
  // Tolerant of both API-Football ("Goal"/"Card"/"subst"/"Var") and SportMonks
  // ("Goal"/"Yellowcard"/"Redcard"/"Substitution") naming.
  const t = apiType.toLowerCase();
  const d = detail.toLowerCase();
  if (t.includes('goal')) {
    if (t.includes('own') || d.includes('own')) return 'OWN_GOAL';
    if (d.includes('miss')) return 'PENALTY_MISS';
    if (d.includes('penalty')) return 'PENALTY_GOAL';
    return 'GOAL';
  }
  if (t.includes('card') || t.includes('yellow') || t.includes('red')) {
    if (t.includes('red') || d.includes('red')) return 'RED_CARD';
    if (d.includes('second')) return 'SECOND_YELLOW';
    return 'YELLOW_CARD';
  }
  if (t.includes('subst')) return 'SUBSTITUTION';
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
  if (t.source === 'datahub') return `Archive · ${t.label}`;
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
  // Fill TV listings off the critical path (non-blocking) once live is active —
  // covers both boot and the runtime tournament switcher.
  if (id === 'live-2026' && !snap.matches.some((m) => m.tvListings?.length)) {
    void enrichLiveTvListings().catch(() => {});
  }
  if (id === 'live-2026' && !snap.matches.some((m) => m.h2h?.length)) {
    void enrichLiveH2H().catch(() => {});
  }
  if (id === 'live-2026' && !snap.teams.some((t) => t.coach?.career)) {
    void enrichLiveCoaches().catch(() => {});
  }
  if (id === 'live-2026' && !snap.matches.some((m) => (m.teamStats?.[m.homeTeamId]?.xG ?? 0) > 0)) {
    void enrichLiveXg().catch(() => {});
  }
  // Future matches (played after the frozen-overlay capture) carry no tactical
  // stats — fill them from API-Football off the critical path.
  if (id === 'live-2026' && snap.matches.some((m) => m.status === 'FINISHED' && !(m.teamStats?.[m.homeTeamId]?.possession))) {
    void enrichLiveMatchStats().catch(() => {});
  }
  // A fresh boot loads the raw provider aggregate (which lags a just-finished
  // match), so scorer tallies would read low until the periodic refresh happens.
  // Kick an immediate refresh so events backfill + the reconcile run within
  // seconds of boot, not minutes — otherwise every redeploy briefly shows stale
  // goal counts (e.g. Mbappé 4 instead of 6). (WC-055)
  if (id === 'live-2026') {
    void refreshLiveScores().catch(() => {});
  }
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
  // Resolve the live provider's fetchers by the active source. Skip for offline
  // sources (simulation / StatsBomb) — nothing to poll.
  const activeT = getTournament(getActiveTournamentId());
  const source = activeT?.source;
  let key: string | undefined;
  let fetchFixturesFn: () => Promise<FixtureUpdate[]>;
  let fetchEventsFn: (fixtureId: number) => Promise<RawFixtureEvent[]>;
  if (source === 'apifootball') {
    key = process.env.API_FOOTBALL_KEY;
    const m = await import('./providers/apiFootball');
    fetchFixturesFn = () => m.fetchApiFootballFixtures(key!);
    fetchEventsFn = (id) => m.fetchFixtureEvents(key!, id);
  } else if (source === 'sportmonks') {
    key = process.env.SPORTMONKS_KEY ?? process.env.SPORTSMONKS_KEY ?? process.env.SPORTMONK_KEY;
    const m = await import('./providers/sportmonks');
    fetchFixturesFn = () => m.fetchSportMonksFixtures(key!);
    fetchEventsFn = (id) => m.fetchSportMonksEvents(key!, id);
  } else {
    return false;
  }
  if (!key) return false;
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
    if (m.status !== 'FINISHED' && now > ko + LIVE_WINDOW_AFTER_MS) return true; // stale-live past its window → force-finish it (WC-057)
    if (m.status === 'FINISHED' && m.events.length === 0 && !eventsFetched.has(m.id)) return true; // backfill timeline once
    return false;
  });
  if (!needsRefresh) return false; // nothing in play and no timeline to backfill → no API call

  const byId = new Map((await fetchFixturesFn()).map((u) => [u.id, u]));

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
    // Newest matches first: a just-finished game (whose goals the scorer reconcile
    // needs, and whose aggregate lags) gets its events before older backfill. (WC-055)
    cur.matches.filter(wantEvents).sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 8).map(async (m) => {
      const fixtureId = Number(m.id.replace('m-', ''));
      if (!Number.isFinite(fixtureId)) return;
      const raw = await fetchEventsFn(fixtureId);
      eventsByMatch.set(m.id, mapFixtureEvents(m.id, raw, teamById.get(m.homeTeamId), teamById.get(m.awayTeamId), playerByApi));
      const status = byId.get(m.id)?.status ?? m.status;
      if (status === 'FINISHED') eventsFetched.add(m.id); // don't re-fetch a finished match, even if it had no events
    }),
  );

  let changed = 0;
  let statusChanged = false;
  let newlyFinished = false;
  const matches = cur.matches.map((m) => {
    const u = byId.get(m.id);
    const ev = eventsByMatch.get(m.id);
    // A match still flagged live long after its play window is stale feed data
    // (the provider lagged marking it finished, then we fell out of the refresh
    // window). Force it finished so it stops showing a phantom live clock. (WC-057)
    const staleLive = m.status !== 'FINISHED' && now > new Date(m.kickoff).getTime() + LIVE_WINDOW_AFTER_MS && (!u || u.status !== 'FINISHED');
    const scoreChanged =
      !!u && (u.status !== m.status || u.homeScore !== m.homeScore || u.awayScore !== m.awayScore || u.minute !== m.minute
        || u.livePhase !== m.livePhase || (u.penalties?.home ?? -1) !== (m.penalties?.home ?? -1) || (u.penalties?.away ?? -1) !== (m.penalties?.away ?? -1));
    if ((u && u.status !== m.status) || staleLive) statusChanged = true; // kickoff / full-time → forecasts worth rebuilding
    if ((u && u.status === 'FINISHED' && m.status !== 'FINISHED') || staleLive) newlyFinished = true; // → re-aggregate player stats
    const eventsChanged = !!ev && ev.length !== m.events.length;
    if (!scoreChanged && !eventsChanged && !staleLive) return m;
    changed++;
    return {
      ...m,
      ...(u
        ? {
            status: u.status,
            minute: u.minute,
            livePhase: u.livePhase,
            homeScore: u.homeScore,
            awayScore: u.awayScore,
            homeScoreHT: u.homeScoreHT,
            awayScoreHT: u.awayScoreHT,
            penalties: u.penalties,
          }
        : {}),
      // Coerce a stale-live match to finished (overrides a stale feed status). (WC-057)
      ...(staleLive ? { status: 'FINISHED' as const, minute: 90, livePhase: undefined } : {}),
      ...(ev ? { events: ev } : {}),
    };
  });
  if (!changed) return false;

  // Keep scorer tallies accurate: API-Football's aggregate lags/omits goals, so
  // reconcile against the accurate frozen SportMonks baseline plus live events for
  // matches played since (WC-055). A fresh players-array identity busts the
  // memoized player-view cache so the golden boot / scorer lists pick up the bump
  // (the detail page reads stats live and updates regardless).
  const { reconcileScorers } = await import('./providers/frozenOverlay');
  const recon = await reconcileScorers(matches, cur.players, cur.teams, cur.playerStats);
  const players = recon.changed ? cur.players.slice() : cur.players;

  // New snapshot object (not an in-place mutation) so the store's snapshot-keyed
  // indexes + analytics engine rebuild against the fresh scores.
  // Only rebuild the (expensive) forecast engine when a match status flips —
  // routine score/minute ticks reuse the cached engine so renders stay fast.
  setDataset({ ...cur, matches, players, playerStats: recon.playerStats, generatedAt: new Date().toISOString() }, sourceLabel(activeT!), getActiveTournamentId(), { rebuildEngine: statusChanged });
  console.log(`[data] Live refresh: ${changed} fixture(s) updated.`);

  // When a match has just FINISHED, the score/timeline updated above but the
  // per-player stat aggregates (goals, apps, xG…) are still frozen at the last
  // full fetch — so scorers' tallies and the golden boot would go stale until a
  // redeploy. Trigger a full background re-fetch to recompute them. Idempotent
  // and guarded against concurrent rebuilds; runs a few times a day at most.
  if (newlyFinished) void rebuildLiveSnapshot();

  return true;
}

let rebuilding = false;
/**
 * Re-fetch the full live snapshot and swap it in — recomputing every player's
 * stats from all finished matches. Used after a match finishes (refreshLiveScores
 * only patches scores/timelines, not the aggregates). Best-effort: on any failure
 * the current snapshot is kept.
 */
export async function rebuildLiveSnapshot(): Promise<void> {
  if (rebuilding || getActiveTournamentId() !== 'live-2026') return;
  if (!process.env.API_FOOTBALL_KEY) return;
  rebuilding = true;
  try {
    // Re-fetch via the registry path (API-Football snapshot + frozen overlay).
    const snap = await loadTournamentSnapshot('live-2026');
    if (isHealthyLive(snap) && getActiveTournamentId() === 'live-2026') {
      const t = getTournament('live-2026');
      // Carry the backfilled event timelines from the current snapshot into the
      // fresh one (a re-fetch starts with empty events), so the goal reconcile and
      // the match timelines survive the rebuild. (WC-055)
      const prevEvents = new Map(getMatches().map((m) => [m.id, m.events]));
      const matches = snap.matches.map((m) => { const ev = prevEvents.get(m.id); return ev && ev.length ? { ...m, events: ev } : m; });
      const { reconcileScorers } = await import('./providers/frozenOverlay');
      const recon = await reconcileScorers(matches, snap.players, snap.teams, snap.playerStats);
      setDataset({ ...snap, matches, playerStats: recon.playerStats }, sourceLabel(t!), 'live-2026', { rebuildEngine: true });
      void enrichLiveTvListings().catch(() => {}); // no-op without a SportMonks key (graceful)
      void enrichLiveXg().catch(() => {}); // re-overlay real team xG (a fresh fetch drops it)
      void enrichLiveMatchStats().catch(() => {}); // tactical stats for matches past the freeze
      console.log('[data] Live snapshot rebuilt — player stats re-aggregated.');
    }
  } catch (e) {
    console.warn('[data] Live snapshot rebuild failed; keeping current snapshot.', e);
  } finally {
    rebuilding = false;
  }
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

  if (t.source === 'statsbomb' || t.source === 'datahub') {
    if (!t.cacheFile) throw new Error(`No cache file for ${id}`);
    // Variable dynamic import → webpack bundles all cache JSONs as a context.
    const mod = await import(`./cache/${t.cacheFile}`);
    return ((mod as { default?: unknown }).default ?? mod) as unknown as DatasetSnapshot;
  }

  if (t.source === 'sportmonks') {
    // Tolerate common key-name misspellings so a slip doesn't fall back to sim.
    const key = process.env.SPORTMONKS_KEY ?? process.env.SPORTSMONKS_KEY ?? process.env.SPORTMONK_KEY;
    if (!key) throw new Error('SPORTMONKS_KEY not set');
    const { fetchSportMonksSnapshot } = await import('./providers/sportmonks');
    return fetchSportMonksSnapshot(key);
  }

  if (t.source === 'apifootball') {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error('API_FOOTBALL_KEY not set');
    const { fetchApiFootballSnapshot } = await import('./providers/apiFootball');
    const snap = await fetchApiFootballSnapshot(key);
    // Overlay the frozen SportMonks gap data (foot, advanced player metrics,
    // coach careers, played-match tactical stats) — a synchronous in-memory
    // merge, no network. Future matches fall through to enrichLiveMatchStats.
    try {
      const { applyFrozenOverlay } = await import('./providers/frozenOverlay');
      const o = await applyFrozenOverlay(snap);
      console.log(`[data] Frozen overlay: ${o.feet} feet, ${o.stats} player stat lines, ${o.coaches} coaches, ${o.matches} match stat sets.`);
    } catch (e) {
      console.warn('[data] Frozen overlay skipped (non-fatal):', e);
    }
    return snap;
  }

  throw new Error(`Unsupported source: ${t.source}`);
}

/**
 * Deferred TV-listings enrichment for the live edition. Run AFTER the live
 * snapshot is active (off the boot critical path), so a deploy lands on live
 * fast and the "Where to watch" panel fills in a beat later. Mutates the active
 * snapshot's match objects in place — force-dynamic match pages pick it up on
 * the next request. Best-effort: a failure just leaves listings empty.
 */
export async function enrichLiveTvListings(): Promise<void> {
  if (getActiveTournamentId() !== 'live-2026') return;
  const key = process.env.SPORTMONKS_KEY ?? process.env.SPORTSMONKS_KEY ?? process.env.SPORTMONK_KEY;
  if (!key) return;
  try {
    const { attachTvListings } = await import('./providers/sportmonks');
    await attachTvListings(getMatches(), key);
  } catch {
    /* listings stay empty — non-fatal */
  }
}

export async function enrichLiveH2H(): Promise<void> {
  if (getActiveTournamentId() !== 'live-2026') return;
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return;
  try {
    // API-Football h2h (was SportMonks) — survives the SportMonks cancellation.
    const { attachApiFootballH2H } = await import('./providers/apiFootball');
    const n = await attachApiFootballH2H(getMatches(), getTeams(), key);
    if (n > 0) console.log(`[data] Head-to-head attached to ${n} fixture(s) (API-Football).`);
  } catch {
    /* h2h stays absent — non-fatal */
  }
}

export async function enrichLiveCoaches(): Promise<void> {
  if (getActiveTournamentId() !== 'live-2026') return;
  const key = process.env.SPORTMONKS_KEY ?? process.env.SPORTSMONKS_KEY ?? process.env.SPORTMONK_KEY;
  if (!key) return;
  try {
    const { attachCoachCareers } = await import('./providers/sportmonks');
    await attachCoachCareers(getTeams(), key);
  } catch {
    /* coach careers stay absent — non-fatal */
  }
}

/**
 * Overlay REAL team xG from API-Football onto the live matches — SportMonks gates
 * xG behind a tier we don't have. Unlike the other enrichments this feeds the
 * analytics engine (standings xGFor/xGAgainst), so when it lands new values we
 * swap the snapshot to trigger an engine rebuild. Best-effort. (WC-049)
 */
export async function enrichLiveXg(): Promise<void> {
  if (getActiveTournamentId() !== 'live-2026') return;
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return;
  try {
    const { attachApiFootballXg } = await import('./providers/apiFootball');
    const n = await attachApiFootballXg(getMatches(), getTeams(), key);
    if (n > 0) {
      const snap = getCachedTournament('live-2026');
      const t = getTournament('live-2026');
      if (snap && t) {
        // New snapshot object → indexes + engine rebuild so standings xG updates.
        setDataset({ ...snap, generatedAt: new Date().toISOString() }, sourceLabel(t), 'live-2026', { rebuildEngine: true });
      }
      console.log(`[data] Real team xG attached to ${n} match(es) (API-Football).`);
    }
  } catch (e) {
    console.warn('[data] xG enrichment failed; xG stays absent.', e);
  }
}

/**
 * Fill per-match tactical stats (possession, shots, passes), formations and the
 * referee for FINISHED live matches that don't already carry them — i.e. games
 * played AFTER the SportMonks freeze, which have no frozen overlay row. Pulls
 * from API-Football's /fixtures/statistics + /fixtures/lineups. These are
 * display-only fields read by force-dynamic match pages, so we mutate in place
 * (no engine rebuild). Best-effort — a failure just leaves them absent.
 */
export async function enrichLiveMatchStats(): Promise<void> {
  if (getActiveTournamentId() !== 'live-2026') return;
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return;
  try {
    const { attachApiFootballMatchStats } = await import('./providers/apiFootball');
    const n = await attachApiFootballMatchStats(getMatches(), getTeams(), key);
    if (n > 0) console.log(`[data] Match tactical stats attached to ${n} match(es) (API-Football).`);
  } catch (e) {
    console.warn('[data] Match-stats enrichment failed; tactical stats stay absent.', e);
  }
}
