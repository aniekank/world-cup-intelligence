/**
 * Server startup hook. Runs once before the app handles any request. Activates
 * the default tournament implied by DATA_SOURCE (live 2026, a historical
 * StatsBomb edition, or the simulation). Any failure logs and leaves the
 * deterministic simulation in place, so the app can never boot broken. The
 * active tournament is switchable at runtime via /api/tournament.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Don't load data during `next build` page-data collection — only at runtime.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { defaultTournamentId } = await import('@/data/tournaments');
  const id = defaultTournamentId();
  if (id === 'simulation') return; // lazy-generated on first access

  // Load in the BACKGROUND so the server starts serving immediately. Early
  // requests see the simulation until the real data swaps in (seconds later).
  // A loading flag (only for the live edition) lets the client show a "Loading
  // live data…" indicator during that window instead of silently rendering the
  // placeholder simulation.
  const g = globalThis as unknown as { __wcLiveLoading?: boolean; __wcLiveBooted?: boolean };
  const trackLoading = id === 'live-2026';
  if (trackLoading) g.__wcLiveLoading = true;
  void (async () => {
    const { activateTournament } = await import('@/data/loadTournament');
    // Retry a transient boot-time fetch failure before falling back to the
    // simulation. The refresh loop below keeps retrying after that, so a
    // SportMonks hiccup at boot can never strand the app on the placeholder. (WC-041)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const snap = await activateTournament(id);
        console.log(`[data] Active tournament: ${snap.competition.name} [src=${snap.meta?.source ?? '?'}] — ${snap.teams.length} teams, ${snap.players.length} players, ${snap.matches.length} matches.`);
        if (id === 'live-2026') g.__wcLiveBooted = true; // live data is in memory — recovery no longer needed
        break;
      } catch (err) {
        console.error(`[data] Tournament load attempt ${attempt}/3 failed:`, err);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
    if (trackLoading) g.__wcLiveLoading = false;
  })();

  // For the live edition, poll the fixtures feed so in-play games flip to LIVE
  // and scores update mid-tournament. The refresh itself no-ops (no API call)
  // unless a match is actually in its play window, so this is quota-cheap.
  //
  // Adaptive cadence: poll faster while a match is actually in play (tight,
  // up-to-the-minute scores) and slower otherwise (quota-cheap). Both are
  // env-tunable so the cadence can be changed without a redeploy. Floored at
  // 15s to stay well inside provider rate limits.
  if (id === 'live-2026') {
    const IDLE_MS = Math.max(15_000, Number(process.env.LIVE_REFRESH_MS ?? 60_000));
    const LIVE_MS = Math.max(15_000, Number(process.env.LIVE_REFRESH_LIVE_MS ?? 30_000));
    const loop = async () => {
      let live = false;
      try {
        const store = await import('@/data/store');
        const lt = await import('@/data/loadTournament');
        if (store.getActiveTournamentId() === 'live-2026') {
          await lt.refreshLiveScores();
        } else if (!g.__wcLiveBooted) {
          // Live's boot load hasn't succeeded yet — keep retrying so a failed boot
          // can't strand us on the simulation placeholder. (WC-041) But once live
          // HAS loaded at least once, a non-live active tournament means the user
          // deliberately switched to a past edition (or the sim sandbox) — leave
          // their choice alone, or the loop yanks them back to 2026 mid-browse. (WC-046)
          g.__wcLiveLoading = true;
          try {
            await lt.activateTournament('live-2026');
            g.__wcLiveBooted = true;
          } finally {
            g.__wcLiveLoading = false;
          }
        }
        // else: the user is browsing a past edition — do nothing this cycle.
        live = store.getLiveMatches().length > 0;
        // Capture closing-line snapshots for Track Record Phase 2 (self-gated:
        // no-op unless Upstash is configured; internally throttled to ~18 min).
        const { snapshotUpcoming } = await import('@/server/predictionLog');
        await snapshotUpcoming();
      } catch (err) {
        console.error('[data] Live refresh/recovery failed:', err);
      } finally {
        setTimeout(() => void loop(), live ? LIVE_MS : IDLE_MS);
      }
    };
    setTimeout(() => void loop(), IDLE_MS);
  }

  // Warm the cross-tournament "Through the Years" summary in the background so the
  // first visitor doesn't pay the one-time cost of parsing every archived edition
  // (~31 snapshots, 1930–2023). Memoized after this; best-effort.
  void (async () => {
    try {
      const { tournamentSummaries } = await import('@/server/history');
      await tournamentSummaries();
      const { warmKnockoutHistory } = await import('@/server/knockoutHistory');
      await warmKnockoutHistory(); // index past WCs for the live knockout-context panels
    } catch {
      /* non-fatal — the pages will compute it lazily on first visit */
    }
  })();
}
