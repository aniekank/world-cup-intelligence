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
  void (async () => {
    try {
      const { activateTournament } = await import('@/data/loadTournament');
      const snap = await activateTournament(id);
      console.log(`[data] Active tournament: ${snap.competition.name} [src=${snap.meta?.source ?? '?'}] — ${snap.teams.length} teams, ${snap.players.length} players, ${snap.matches.length} matches.`);
    } catch (err) {
      console.error('[data] Tournament load failed — staying on simulation:', err);
    }
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
        const { refreshLiveScores } = await import('@/data/loadTournament');
        await refreshLiveScores();
        const { getLiveMatches } = await import('@/data/store');
        live = getLiveMatches().length > 0;
        // Capture closing-line snapshots for Track Record Phase 2 (self-gated:
        // no-op unless Upstash is configured; internally throttled to ~18 min).
        const { snapshotUpcoming } = await import('@/server/predictionLog');
        await snapshotUpcoming();
      } catch (err) {
        console.error('[data] Live refresh failed:', err);
      } finally {
        setTimeout(() => void loop(), live ? LIVE_MS : IDLE_MS);
      }
    };
    setTimeout(() => void loop(), IDLE_MS);
  }
}
