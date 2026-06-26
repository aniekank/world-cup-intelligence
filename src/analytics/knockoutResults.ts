/**
 * Reconcile the Monte Carlo forecast with real knockout results.
 *
 * The simulation (`runSimulation`) projects the whole knockout from a seeded
 * bracket every run — it has no knowledge of who actually qualified or what's
 * already been played. Once real knockout fixtures exist (teams resolved), that
 * means a team already eliminated could still show a non-zero "reach the
 * semis" probability, and a confirmed qualifier could show < 100% to make the
 * round of 32.
 *
 * This pass pins down what is *known* from the real fixtures, per team:
 *   - didn't qualify (groups done, not in any R32 tie)      → all reach = 0
 *   - appears in a real fixture at round R                  → reached R = 1
 *   - won a real tie at round R                             → reached R+1 = 1
 *   - lost a real tie at round R (eliminated)              → reach beyond R = 0
 *   - won the final                                         → win title = 1
 * Rounds whose outcome is still open keep the model's simulated probability, so
 * a still-alive team's deeper-run odds remain a forecast — just one anchored to
 * reality for everything already decided.
 *
 * No-op before the knockouts exist (every fixture is still a group game or an
 * unresolved placeholder), so the pure pre-tournament forecast is untouched.
 */

import type { Match, Team, TeamForecast, MatchStage } from '@/domain/types';

// Round index along the knockout path. THIRD_PLACE is deliberately excluded —
// both its teams were already eliminated in the semis.
const ROUND_INDEX: Partial<Record<MatchStage, number>> = {
  R32: 0,
  R16: 1,
  QF: 2,
  SF: 3,
  FINAL: 4,
};

// reach field for "reached round r" (played a tie at that round).
const REACH_FIELD: (keyof TeamForecast)[] = [
  'reachR32',
  'reachR16',
  'reachQF',
  'reachSF',
  'reachFinal',
];

/** Winner of a finished knockout tie (penalties break a level score). null if undetermined. */
function knockoutWinner(m: Match): string | null {
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  const p = m.penalties;
  if (p) {
    if (p.home > p.away) return m.homeTeamId;
    if (p.away > p.home) return m.awayTeamId;
  }
  return null;
}

/**
 * Mutates `forecasts` in place to honour real knockout results. Safe to call
 * every engine rebuild; returns early (no change) until real knockout fixtures
 * with resolved teams appear.
 */
export function reconcileForecastsWithResults(
  forecasts: Map<string, TeamForecast>,
  matches: Match[],
  teamsArr: Team[],
): void {
  const koReal = matches.filter(
    (m) => ROUND_INDEX[m.stage] !== undefined && !!m.homeTeamId && !!m.awayTeamId,
  );
  // THIRD_PLACE is real but not on the reach path; keep it out of the bracket logic.
  const koPath = koReal.filter((m) => m.stage !== 'THIRD_PLACE');
  if (koPath.length === 0) return; // pre-knockouts → leave the pure forecast alone.

  // Teams that made the knockouts = everyone in a real round-of-32 tie.
  const qualified = new Set<string>();
  for (const m of koPath) {
    if (m.stage === 'R32') {
      qualified.add(m.homeTeamId);
      qualified.add(m.awayTeamId);
    }
  }
  // SportMonks fills R32 ties INCREMENTALLY as teams clinch, so a handful of real
  // R32 fixtures can exist while the group stage is still being played. The
  // qualified set is only the *complete* bracket once every group game is done —
  // until then a still-qualifying side (a group leader with a game in hand) must
  // keep its projection, never be zeroed for "not qualifying". (WC-038)
  const groupStageComplete = !matches.some((m) => m.stage === 'GROUP' && m.status !== 'FINISHED');
  const bracketKnown = groupStageComplete && qualified.size > 0;

  // Confirmed progress per team.
  const playedRound = new Map<string, number>(); // furthest round they appear in
  const wonRound = new Map<string, number>(); // furthest round they've won outright
  const eliminated = new Set<string>();
  let champion: string | null = null;

  for (const m of koPath) {
    const r = ROUND_INDEX[m.stage]!;
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      playedRound.set(id, Math.max(playedRound.get(id) ?? -1, r));
    }
    if (m.status !== 'FINISHED') continue;
    const winner = knockoutWinner(m);
    if (!winner) continue;
    const loser = winner === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    wonRound.set(winner, Math.max(wonRound.get(winner) ?? -1, r));
    eliminated.add(loser);
    if (m.stage === 'FINAL') champion = winner;
  }

  for (const t of teamsArr) {
    const f = forecasts.get(t.id);
    if (!f) continue;

    // Groups are over and this team isn't in the bracket → out of everything.
    if (bracketKnown && !qualified.has(t.id)) {
      f.reachR32 = 0;
      f.reachR16 = 0;
      f.reachQF = 0;
      f.reachSF = 0;
      f.reachFinal = 0;
      f.winTitle = 0;
      continue;
    }
    // Without a real R32 tie naming this team we can't assert anything yet.
    if (!qualified.has(t.id)) continue;

    f.reachR32 = 1; // confirmed in the knockouts

    const played = playedRound.get(t.id) ?? 0;
    const won = wonRound.get(t.id) ?? -1;
    const maxReached = Math.max(played, won >= 0 ? won + 1 : 0, 0);
    for (let r = 0; r <= maxReached; r++) {
      const field = REACH_FIELD[r];
      if (field) (f[field] as number) = 1;
    }

    if (eliminated.has(t.id)) {
      // Eliminated at their furthest-played round → nothing beyond it.
      for (let r = played + 1; r < REACH_FIELD.length; r++) {
        const field = REACH_FIELD[r];
        if (field) (f[field] as number) = 0;
      }
      f.winTitle = 0;
    }
    if (champion === t.id) f.winTitle = 1;
  }
}
