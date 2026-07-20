import 'server-only';
import { getTournament, type TournamentInfo } from './tournaments';
import { generateDataset } from './generate';
import { getCachedTournament, setDataset, getActiveTournamentId, getMatches, getTeams } from './store';
import type { FixtureUpdate, RawFixtureEvent } from './providers/apiFootball';
import { pendingKnockoutTies, tournamentComplete } from '@/analytics/knockoutResults';
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

/**
 * In-repo pin of the completed tournament, produced by
 * src/data/freeze-final-snapshot.test.ts (FREEZE_EXPORT=1). Loaded the same way
 * the datahub archive editions are — a webpack-bundled JSON import — so the
 * frozen 2026 edition ships inside the build with no fs or feed dependency.
 */
async function loadFrozenFinalSnapshot(): Promise<DatasetSnapshot | null> {
  try {
    const mod = await import('./cache/wc2026-final.json');
    const snap = ((mod as { default?: unknown }).default ?? mod) as unknown as DatasetSnapshot;
    // Honour the pin only for a genuinely complete tournament — a stale partial
    // export must never mask a live one.
    if (!snap?.matches?.length || !tournamentComplete(snap.matches)) return null;
    console.log(`[data] Serving the FROZEN final snapshot (${snap.matches.length} matches, generated ${snap.generatedAt}) — no live feed needed.`);
    return snap;
  } catch {
    return null; // no pin bundled → normal live path
  }
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
  const isLive = t.source === 'apifootball' || t.source === 'sportmonks';
  const g = globalThis as { __wcLiveFromCache?: boolean };

  // FROZEN EDITION (task #38): once the tournament is complete, the final snapshot
  // is pinned in-repo and the live provider is never called again — the 2026
  // edition serves like the datahub archives, at zero feed cost. The pin is only
  // honoured if the file really holds a COMPLETE tournament (champion crowned),
  // so a stale partial export can never mask a live tournament.
  if (id === 'live-2026') {
    const frozen = await loadFrozenFinalSnapshot();
    if (frozen) {
      g.__wcLiveFromCache = false;
      setDataset(frozen, 'World Cup 2026 · Final (frozen)', id);
      return frozen;
    }
  }

  let snap: DatasetSnapshot | null = null;
  try {
    snap = getCachedTournament(id) ?? (await loadTournamentSnapshot(id));
  } catch (e) {
    if (!isLive) throw e; // non-live sources have nothing to fall back to
    console.warn('[data] Live snapshot load failed:', e);
  }

  // Live feed failed or came back hollow. Serve the last-known-good CACHED live
  // snapshot (real, if slightly stale) before dropping to the simulation — Render
  // wipes disk on deploy, so the cache lives in Upstash. Auto-upgrades to fresh
  // live once the feed heals (the refresh loop rebuilds). (WC-075/WC-057)
  if (isLive && (!snap || !isHealthyLive(snap))) {
    if (id === 'live-2026') {
      const { restoreLiveSnapshot } = await import('@/server/liveSnapshotCache');
      const cached = await restoreLiveSnapshot();
      if (cached) {
        g.__wcLiveFromCache = true;
        setDataset(cached, `Live · cached (updated ${new Date(cached.generatedAt).toISOString().slice(11, 16)} UTC)`, 'live-2026');
        console.log(`[data] Live feed unavailable — serving last-known-good snapshot from ${cached.generatedAt}.`);
        void refreshLiveScores().catch(() => {});
        return cached;
      }
    }
    const withSquad = (snap?.teams ?? []).filter((x) => (x.squadIds?.length ?? 0) > 0).length;
    console.warn(`[data] Live feed incomplete (${snap?.players.length ?? 0} players, ${withSquad}/${snap?.teams.length ?? 0} squads) — serving the full simulation instead.`);
    const sim = generateDataset();
    setDataset(sim, 'Simulation (live feed unavailable)', 'simulation');
    return sim;
  }

  if (!snap) throw new Error(`Tournament ${id} produced no snapshot`); // unreachable for non-live (catch re-throws); narrows the type
  g.__wcLiveFromCache = false; // fresh live data is active
  setDataset(snap, sourceLabel(t), id);
  // Stash this healthy live snapshot as last-known-good (throttled, best-effort). (WC-075)
  if (id === 'live-2026') {
    const { persistLiveSnapshot } = await import('@/server/liveSnapshotCache');
    void persistLiveSnapshot(snap);
  }
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

/** Window around kickoff in which a match is plausibly being played (minutes).
 *  A knockout tie that goes to extra time + penalties runs ~2.5-3h from kickoff
 *  (90 + stoppage + 30' ET + a long shootout + VAR/injury delays), so the "after"
 *  window is 3.5h — a match still live past that is genuinely stuck feed. (WC-071) */
const LIVE_WINDOW_BEFORE_MS = 10 * 60_000;
const LIVE_WINDOW_AFTER_MS = 210 * 60_000;

/**
 * Should a match still flagged live be force-finished as stale feed data? Yes only
 * once it's past its play window AND the live feed is NOT still reporting it live —
 * a tie in extra time or a penalty shootout legitimately runs long, and the feed
 * says so, so we must trust it rather than coerce a phantom 0-0 full-time. (WC-071)
 */
export function shouldForceFinish(
  matchStatus: Match['status'],
  kickoffMs: number,
  now: number,
  feedStatus: Match['status'] | undefined,
  windowMs: number = LIVE_WINDOW_AFTER_MS,
): boolean {
  if (matchStatus === 'FINISHED') return false;
  if (now <= kickoffMs + windowMs) return false;
  if (feedStatus === 'LIVE' || feedStatus === 'HALFTIME') return false; // genuinely in play (ET / pens)
  if (feedStatus === 'FINISHED') return false; // the normal update path finishes it
  return true; // feed dropped the match (or stuck pre-kickoff) past the window → stale
}

/**
 * A started match can't revert to "not started". True when a single feed reading
 * reports SCHEDULED for a match we already have live / at half-time within its
 * play window — almost certainly provider jitter (a transient NS/TBD). Honouring
 * it would flip the match to SCHEDULED and yank it out of the live view entirely
 * until the next good tick, which reads as "the live match vanished". So we ignore
 * that one reading and keep the in-play state. (WC-077)
 */
export function isSpuriousRevert(
  matchStatus: Match['status'],
  feedStatus: Match['status'] | undefined,
  withinWindow: boolean,
): boolean {
  return withinWindow && feedStatus === 'SCHEDULED' && (matchStatus === 'LIVE' || matchStatus === 'HALFTIME');
}

// The API-Football adapter sets a global back-off timestamp when it hits a
// rate/quota limit; honour it here so we don't keep re-fetching into a spent
// budget (a full snapshot fans out to ~60 requests). (WC-073)
const inApiBackoff = () => Date.now() < ((globalThis as { __wcApiBackoffUntil?: number }).__wcApiBackoffUntil ?? 0);

// Cadence for the bracket-gap probe and the new-fixture rebuild throttle. (WC-086)
const BRACKET_PROBE_MS = 30 * 60_000;
const knownMatchIds = (snap: { matches: Match[] }): Set<string> => new Set(snap.matches.map((m) => m.id));

/**
 * Re-poll the fixtures feed and merge current status/score/minute into the
 * active live snapshot, so in-play games flip to LIVE and scores update without
 * re-fetching squads. Cheap: skips the API call entirely unless some match is
 * actually in its play window, and only swaps the snapshot when something
 * changed. Returns true if the dataset was updated. Safe to call on a timer.
 */
export async function refreshLiveScores(): Promise<boolean> {
  if (inApiBackoff()) return false; // rate-limited recently — don't spend more budget (WC-073)
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
  // Bracket-gap probe (WC-086): when the results have determined a next-round tie
  // that the provider hasn't published as a fixture (API-Football lagged a day+
  // creating the second semi-final), nothing is "in play" for days — so the poll
  // above would never fire and the fixture could only arrive via the next finished
  // match or a redeploy. While such a gap exists, poll the (single-call) fixtures
  // feed at a low cadence so the new fixture is picked up within the half-hour.
  const gp = globalThis as { __wcBracketProbeAt?: number };
  const bracketGap = pendingKnockoutTies(cur.matches).length > 0;
  const probeDue = bracketGap && now - (gp.__wcBracketProbeAt ?? 0) >= BRACKET_PROBE_MS;
  if (!needsRefresh && !probeDue) return false; // nothing in play, no backfill, no bracket gap → no API call

  const updates = await fetchFixturesFn();
  if (probeDue) gp.__wcBracketProbeAt = now;
  // Fixtures we've never seen (a newly published next round) can't be merged by
  // the patch loop below — they need the full snapshot rebuild. Throttled so a
  // fixture the rebuild can't ingest (e.g. an unmapped team) can't spin it. (WC-086)
  if (updates.some((u) => !knownMatchIds(cur).has(u.id))) {
    const gr = globalThis as { __wcNewFixtureRebuildAt?: number };
    if (now - (gr.__wcNewFixtureRebuildAt ?? 0) >= BRACKET_PROBE_MS) {
      gr.__wcNewFixtureRebuildAt = now;
      console.log('[data] Feed contains fixture(s) not in the snapshot — rebuilding live snapshot.');
      void rebuildLiveSnapshot();
    }
  }
  const byId = new Map(updates.map((u) => [u.id, u]));

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
    const uRaw = byId.get(m.id);
    const ev = eventsByMatch.get(m.id);
    // Ignore a single glitchy "not started" reading for a match that's already in
    // play within its window — a started match can't un-start, and honouring it
    // would drop the match out of the live view. (WC-077)
    const withinWindow = now < new Date(m.kickoff).getTime() + LIVE_WINDOW_AFTER_MS;
    const u = uRaw && isSpuriousRevert(m.status, uRaw.status, withinWindow) ? undefined : uRaw;
    // A match still flagged live long after its play window is stale feed data
    // (the provider lagged marking it finished, then we fell out of the refresh
    // window). Force it finished so it stops showing a phantom live clock. (WC-057)
    // Uses the raw feed status so a genuine past-window drop still finishes.
    const staleLive = shouldForceFinish(m.status, new Date(m.kickoff).getTime(), now, uRaw?.status, LIVE_WINDOW_AFTER_MS);
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
  if (inApiBackoff()) return; // rate-limited — a full re-fetch is ~60 requests; skip it (WC-073)
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
      const rebuilt = { ...snap, matches, playerStats: recon.playerStats };
      setDataset(rebuilt, sourceLabel(t!), 'live-2026', { rebuildEngine: true });
      (globalThis as { __wcLiveFromCache?: boolean }).__wcLiveFromCache = false; // fresh full data replaced any cached snapshot (WC-075)
      const { persistLiveSnapshot } = await import('@/server/liveSnapshotCache');
      void persistLiveSnapshot(rebuilt); // refresh the last-known-good cache (WC-075)
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
      const { applyFrozenOverlay, deriveCleanSheets } = await import('./providers/frozenOverlay');
      const o = await applyFrozenOverlay(snap);
      const cs = deriveCleanSheets(snap); // API-Football has no clean-sheet field — derive from results (WC-065)
      console.log(`[data] Frozen overlay: ${o.feet} feet, ${o.stats} player stat lines, ${o.coaches} coaches, ${o.matches} match stat sets; ${cs} keeper clean-sheet tallies derived.`);
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
