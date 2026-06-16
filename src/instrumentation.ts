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
      console.log(`[data] Active tournament: ${snap.competition.name} — ${snap.teams.length} teams, ${snap.matches.length} matches.`);
    } catch (err) {
      console.error('[data] Tournament load failed — staying on simulation:', err);
    }
  })();
}
