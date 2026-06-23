/**
 * Golden Boot projection.
 *
 * Projects each player's end-of-tournament goal total = goals so far + expected
 * future goals, where future goals = finishing-adjusted xG rate × projected
 * remaining minutes. Remaining minutes scale with how deep the player's team is
 * expected to advance (Monte Carlo reach probabilities → expected games left).
 * The win probability is a Poisson-race approximation across the contenders.
 */

import { poissonPmf } from './poisson';
import type { PlayerView, TeamForecast, GoldenBootProjection } from '@/domain/types';

/** Expected remaining matches for a team given its stage-reach probabilities. */
function expectedRemainingGames(f: TeamForecast | undefined, groupGamesLeft: number): number {
  if (!f) return groupGamesLeft;
  // Knockout games expected = sum of reach probabilities for each KO round
  const ko = f.reachR32 + f.reachR16 + f.reachQF + f.reachSF + f.reachFinal;
  return groupGamesLeft + ko;
}

export function projectGoldenBoot(
  players: PlayerView[],
  forecasts: Map<string, TeamForecast>,
  groupGamesLeftByTeam: Map<string, number>,
): GoldenBootProjection[] {
  const contenders = players
    .filter((p) => p.position !== 'GK' && (p.stats.goals > 0 || p.stats.xG > 1))
    .map((p) => {
      const f = forecasts.get(p.teamId);
      const remainGames = expectedRemainingGames(f, groupGamesLeftByTeam.get(p.teamId) ?? 0);
      const mins = Math.max(p.stats.minutes, 1);
      // Finishing-adjusted goal rate per 90: blend actual & expected. Regress the
      // denominator to a ~2-game sample (180') so a one-off burst — a sub who
      // scored in 30' — can't project a wild rate and leapfrog established
      // scorers. (WC-029)
      const goalRate90 = ((p.stats.goals * 0.55 + p.stats.xG * 0.45) / Math.max(mins, 180)) * 90;
      const projMinutesEach = Math.min(90, mins / Math.max(p.stats.appearances, 1));
      const futureGoals = goalRate90 * (remainGames * projMinutesEach) / 90;
      const projected = p.stats.goals + futureGoals;
      return {
        playerId: p.id,
        currentGoals: p.stats.goals,
        currentXG: Math.round(p.stats.xG * 10) / 10,
        projectedLambda: projected,
        projectedGoals: Math.round(projected * 10) / 10,
        projectedFinishRank: 0,
        winProbability: 0,
      };
    })
    .sort((a, b) => b.projectedLambda - a.projectedLambda);

  // Win probability via Poisson race over the top contenders
  const top = contenders.slice(0, 25);
  const maxGoals = 18;
  const winProbs = new Map<string, number>();
  top.forEach((c) => winProbs.set(c.playerId, 0));

  for (let g = 1; g <= maxGoals; g++) {
    top.forEach((c) => {
      const pExact = poissonPmf(g, c.projectedLambda);
      // P(all others strictly less than g) + tie-share for equal
      let pOthersBelow = 1;
      let tieCount = 0;
      for (const o of top) {
        if (o.playerId === c.playerId) continue;
        let pBelow = 0;
        for (let k = 0; k < g; k++) pBelow += poissonPmf(k, o.projectedLambda);
        pOthersBelow *= pBelow;
        tieCount += poissonPmf(g, o.projectedLambda);
      }
      winProbs.set(c.playerId, (winProbs.get(c.playerId) ?? 0) + pExact * pOthersBelow);
    });
  }

  // Normalize
  const total = [...winProbs.values()].reduce((a, b) => a + b, 0) || 1;

  return contenders
    .map((c) => ({
      playerId: c.playerId,
      currentGoals: c.currentGoals,
      currentXG: c.currentXG,
      projectedGoals: c.projectedGoals,
      projectedFinishRank: 0,
      winProbability: Math.round(((winProbs.get(c.playerId) ?? 0) / total) * 1000) / 1000,
    }))
    // Rank the race by goals actually scored (the real Golden Boot standings);
    // the projection and win probability ride alongside as the forecast, not the
    // sort key — so a low-minute player can never outrank the current leader.
    // Tie-break on projection, then xG, then win probability. (WC-029)
    .sort(
      (a, b) =>
        b.currentGoals - a.currentGoals ||
        b.projectedGoals - a.projectedGoals ||
        b.currentXG - a.currentXG ||
        b.winProbability - a.winProbability,
    )
    .map((c, i) => ({ ...c, projectedFinishRank: i + 1 }));
}
